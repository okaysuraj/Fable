import { Router } from "express";
import { z } from "zod";
import type { Prisma, Call } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { accessibleChannel, lockChannel } from "../lib/access.js";
import { asyncRoute, HttpError, parse } from "../lib/http.js";

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
// No public STUN service is contacted by default. A LAN needs no provider.
const iceSchema = z
  .array(
    z
      .object({
        urls: z.union([z.string(), z.array(z.string()).min(1).max(4)]),
        username: z.string().optional(),
        credential: z.string().optional(),
      })
      .strict(),
  )
  .max(8);
const iceServers = parse(
  iceSchema,
  JSON.parse(process.env.WEBRTC_ICE_SERVERS || "[]"),
);
for (const server of iceServers) {
  for (const url of [server.urls].flat()) {
    if (!/^(stun|stuns|turn|turns):[^\s]+$/.test(url))
      throw new Error("WEBRTC_ICE_SERVERS contains an invalid ICE URL");
  }
}
function dto(call: Call) {
  return {
    id: call.id,
    channelId: call.channelId,
    callerId: call.callerId,
    calleeId: call.calleeId,
    kind: call.kind,
    status: call.status,
    offer: call.offer,
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
callsRouter.get("/config", (_req, res) => res.json({ data: { iceServers } }));
callsRouter.get(
  "/incoming",
  asyncRoute(async (req: AuthRequest, res) => {
    const result = await prisma.$transaction(async (tx) => {
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
      return tx.call.create({
        data: {
          ...input,
          callerId: req.auth!.userId,
          calleeId,
          expiresAt: new Date(Date.now() + 60000),
        },
      });
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
          action: z.enum(["poll", "answer", "end", "decline"]),
          answer: sdp.optional(),
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
      if (members !== 2)
        return tx.call.update({
          where: { id: call.id },
          data: { status: "ended", offer: null, answer: null },
        });
      if (input.action === "answer") {
        if (call.calleeId !== req.auth!.userId || !input.answer)
          throw new HttpError(403, "Only the recipient can answer a call");
        if (call.status === "active") {
          if (call.answer !== input.answer)
            throw new HttpError(
              409,
              "This call was answered on another device",
            );
          return call;
        }
        return tx.call.update({
          where: { id: call.id },
          data: {
            status: "active",
            answer: input.answer,
            calleeSeenAt: new Date(),
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          },
        });
      }
      if (input.action === "decline" && call.calleeId !== req.auth!.userId)
        throw new HttpError(403, "Only the recipient can decline");
      return tx.call.update({
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
    });
    res.json({ data: dto(result) });
  }),
);
