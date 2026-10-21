import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { Prisma, Call } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { accessibleChannel, lockChannel } from "../lib/access.js";
import { asyncRoute, HttpError, parse } from "../lib/http.js";
import { emitUsers, lockEventOrder } from "../lib/events.js";
import { callIce } from "../lib/ice.js";

export const callsRouter = Router();
const live = ["ringing", "active"];
// Incoming calls follow the participant's authorized chats across all their groups.
const participantChannelScope = (
  req: AuthRequest,
): Prisma.ChannelWhereInput => ({
  workspace: { members: { some: { userId: req.auth!.userId } } },
  isPrivate: true,
  members: { some: { userId: req.auth!.userId } },
});
const sdp = z.string().min(10).max(48000).startsWith("v=0");
function dto(call: Call) {
  return {
    id: call.id,
    nativeId: call.nativeId,
    channelId: call.channelId,
    callerId: call.callerId,
    calleeId: call.calleeId,
    kind: call.kind,
    status: call.status,
    offer: call.offer,
    offerHash: call.offer
      ? createHash("sha256").update(call.offer).digest("hex")
      : null,
    answer: call.answer,
    createdAt: call.createdAt.toISOString(),
  };
}
async function expire(tx: Prisma.TransactionClient, userId: string) {
  // Purge SDP as soon as a call ends. A crashed participant cannot remain busy indefinitely.
  await tx.call.updateMany({
    where: {
      AND: [
        { OR: [{ callerId: userId }, { calleeId: userId }] },
        { status: { in: live } },
        {
          OR: [
            { expiresAt: { lt: new Date() } },
            { callerSeenAt: { lt: new Date(Date.now() - 45000) } },
            {
              status: "active",
              calleeSeenAt: { lt: new Date(Date.now() - 45000) },
            },
          ],
        },
      ],
    },
    data: { status: "ended", offer: null, answer: null },
  });
}
callsRouter.get("/config", (req: AuthRequest, res) =>
  res.json({ data: callIce(req.auth!.userId) }),
);
callsRouter.get(
  "/incoming",
  asyncRoute(async (req: AuthRequest, res) => {
    const result = await prisma.$transaction(async (tx) => {
      await lockEventOrder(tx);
      await expire(tx, req.auth!.userId);
      return tx.call.findFirst({
        where: {
          calleeId: req.auth!.userId,
          status: "ringing",
          channel: participantChannelScope(req),
        },
        orderBy: { createdAt: "desc" },
      });
    });
    const caller = result
      ? await prisma.user.findUnique({
          where: { id: result.callerId },
          select: { name: true },
        })
      : null;
    res.json({
      data: result ? dto(result) : null,
      callerName: caller?.name ?? null,
    });
  }),
);
callsRouter.get(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const call = await prisma.call.findFirst({
      where: {
        id: req.params.id,
        channel: participantChannelScope(req),
        OR: [{ callerId: req.auth!.userId }, { calleeId: req.auth!.userId }],
      },
    });
    if (!call) throw new HttpError(404, "Call not found");
    res.json({ data: dto(call) });
  }),
);
callsRouter.post(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z
        .object({
          channelId: z.string().min(1).max(128),
          kind: z.enum(["audio", "video"]),
          offer: sdp,
        })
        .strict(),
      req.body,
    );
    const result = await prisma.$transaction(async (tx) => {
      await lockEventOrder(tx);
      await lockChannel(tx, input.channelId);
      const channel = await accessibleChannel(req, input.channelId, tx);
      if (!channel.directKey)
        throw new HttpError(
          400,
          "Start a direct conversation to call a person",
        );
      const participants = await tx.channelMember.findMany({
        where: {
          channelId: channel.id,
          user: { memberships: { some: { workspaceId: channel.workspaceId } } },
        },
        select: { userId: true },
        take: 3,
      });
      if (participants.length !== 2)
        throw new HttpError(409, "Both people must still belong to this group");
      const calleeId = participants.find(
        (p) => p.userId !== req.auth!.userId,
      )!.userId;
      const userIds = [req.auth!.userId, calleeId].sort();
      for (const id of userIds) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`call-user:${id}`}))`;
        await expire(tx, id);
      }
      if (
        await tx.call.findFirst({
          where: {
            status: { in: live },
            OR: [{ callerId: { in: userIds } }, { calleeId: { in: userIds } }],
          },
          select: { id: true },
        })
      )
        throw new HttpError(409, "One of you is already in a call");
      if (
        await tx.groupCallParticipant.findFirst({
          where: {
            userId: { in: userIds },
            leftAt: null,
            lastSeenAt: { gt: new Date(Date.now() - 45000) },
            call: { endedAt: null },
          },
          select: { userId: true },
        })
      )
        throw new HttpError(409, "One of you is already in a group call");
      const call = await tx.call.create({
        data: {
          ...input,
          callerId: req.auth!.userId,
          calleeId,
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      await emitUsers(tx, userIds, {
        type: "call.updated",
        targetId: call.id,
        channelId: channel.id,
        workspaceId: channel.workspaceId,
        notify: true,
        excludePushUserId: req.auth!.userId,
      });
      return call;
    });
    res.status(201).json({ data: dto(result) });
  }),
);
callsRouter.post(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z
        .object({
          action: z.enum([
            "poll",
            "answer",
            "end",
            "decline",
            "restart",
            "request-restart",
          ]),
          answer: sdp.optional(),
          offer: sdp.optional(),
          offerHash: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .optional(),
        })
        .strict(),
      req.body,
    );
    const target = await prisma.call.findFirst({
      where: {
        id: req.params.id,
        channel: participantChannelScope(req),
        OR: [{ callerId: req.auth!.userId }, { calleeId: req.auth!.userId }],
      },
      select: { channelId: true, channel: { select: { workspaceId: true } } },
    });
    if (!target) throw new HttpError(404, "Call not found");
    // Resolve the workspace from the authorized call rather than the open conversation.
    req.auth!.workspaceId = target.channel.workspaceId;
    const result = await prisma.$transaction(async (tx) => {
      await lockEventOrder(tx);
      await lockChannel(tx, target.channelId);
      await accessibleChannel(req, target.channelId, tx);
      await expire(tx, req.auth!.userId);
      const call = await tx.call.findUniqueOrThrow({
        where: { id: req.params.id },
      });
      if (!live.includes(call.status)) return call;
      // Workspace removal revokes signaling for both people and ends the call.
      const members = await tx.workspaceMember.count({
        where: {
          workspaceId: req.auth!.workspaceId!,
          userId: { in: [call.callerId, call.calleeId] },
        },
      });
      if (members !== 2) {
        const ended = await tx.call.update({
          where: { id: call.id },
          data: { status: "ended", offer: null, answer: null },
        });
        await emitUsers(tx, [call.callerId, call.calleeId], {
          type: "call.updated",
          targetId: call.id,
          channelId: call.channelId,
          workspaceId: req.auth!.workspaceId,
        });
        return ended;
      }
      if (input.action === "answer") {
        if (call.calleeId !== req.auth!.userId || !input.answer)
          throw new HttpError(403, "Only the recipient can answer a call");
        if (
          !call.offer ||
          input.offerHash !==
            createHash("sha256").update(call.offer).digest("hex")
        )
          throw new HttpError(
            409,
            "Call setup changed; reconnect to the latest offer",
          );
        if (call.status === "active" && call.answer !== null) {
          if (call.answer !== input.answer)
            throw new HttpError(
              409,
              "This call was answered on another device",
            );
          return call;
        }
        const accepted = await tx.call.update({
          where: { id: call.id },
          data: {
            status: "active",
            answer: input.answer,
            calleeSeenAt: new Date(),
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          },
        });
        await emitUsers(tx, [call.callerId, call.calleeId], {
          type: "call.updated",
          targetId: call.id,
          channelId: call.channelId,
          workspaceId: req.auth!.workspaceId,
        });
        return accepted;
      }
      if (input.action === "restart" || input.action === "request-restart") {
        if (call.status !== "active")
          throw new HttpError(409, "Only an active call can reconnect");
        if (
          input.action === "restart" &&
          (call.callerId !== req.auth!.userId || !input.offer)
        )
          throw new HttpError(403, "Only the caller can publish a new offer");
        if (
          input.action === "request-restart" &&
          call.calleeId !== req.auth!.userId
        )
          throw new HttpError(
            403,
            "Only the recipient can request a reconnect",
          );
        if (
          input.action === "restart" &&
          (!call.offer ||
            input.offerHash !==
              createHash("sha256").update(call.offer).digest("hex"))
        )
          throw new HttpError(
            409,
            "Call setup changed; retry the latest connection",
          );
        const reconnecting = await tx.call.update({
          where: { id: call.id },
          data: {
            ...(input.action === "restart"
              ? { offer: input.offer, callerSeenAt: new Date() }
              : { calleeSeenAt: new Date() }),
            answer: null,
          },
        });
        await emitUsers(tx, [call.callerId, call.calleeId], {
          type: "call.updated",
          targetId: call.id,
          channelId: call.channelId,
          workspaceId: req.auth!.workspaceId,
        });
        return reconnecting;
      }
      if (input.action === "decline" && call.calleeId !== req.auth!.userId)
        throw new HttpError(403, "Only the recipient can decline");
      const updated = await tx.call.update({
        where: { id: call.id },
        data:
          input.action === "poll"
            ? call.callerId === req.auth!.userId
              ? { callerSeenAt: new Date() }
              : { calleeSeenAt: new Date() }
            : {
                status: input.action === "decline" ? "declined" : "ended",
                offer: null,
                answer: null,
              },
      });
      if (input.action !== "poll")
        await emitUsers(tx, [call.callerId, call.calleeId], {
          type: "call.updated",
          targetId: call.id,
          channelId: call.channelId,
          workspaceId: req.auth!.workspaceId,
        });
      return updated;
    });
    res.json({ data: dto(result) });
  }),
);
