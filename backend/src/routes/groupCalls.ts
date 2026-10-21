import { Router } from "express";
import { z } from "zod";
import type {
  DtlsParameters,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup/types";
import type { AuthRequest } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { accessibleChannel, lockChannel } from "../lib/access.js";
import { asyncRoute, HttpError, parse } from "../lib/http.js";
import { emitChannel, lockEventOrder } from "../lib/events.js";
import {
  joinSfu,
  leaveSfu,
  sfuAction,
  sfuEnabled,
  sfuReady,
} from "../lib/sfu.js";
import { callIce } from "../lib/ice.js";

export const groupCallsRouter = Router();
const fresh = () => new Date(Date.now() - 45000);
const codec = z
  .object({
    mimeType: z.string().max(80),
    clockRate: z.number().int().positive(),
    channels: z.number().int().min(1).max(8).optional(),
  })
  .passthrough();
const rtpShape = z
  .object({
    codecs: z.array(codec).min(1).max(32),
    headerExtensions: z.array(z.object({}).passthrough()).max(32).optional(),
  })
  .passthrough();
const mediaSchema = z
  .object({
    sessionId: z.uuid(),
    type: z.enum([
      "state",
      "transport",
      "connect",
      "produce",
      "consume",
      "resume",
      "restart-ice",
    ]),
    direction: z.enum(["send", "recv"]).optional(),
    transportId: z.uuid().optional(),
    producerId: z.uuid().optional(),
    consumerId: z.uuid().optional(),
    kind: z.enum(["audio", "video"]).optional(),
    dtlsParameters: z
      .custom<DtlsParameters>(
        (value) =>
          z
            .object({
              role: z.enum(["auto", "client", "server"]).optional(),
              fingerprints: z
                .array(
                  z
                    .object({
                      algorithm: z.string().max(32),
                      value: z.string().min(10).max(512),
                    })
                    .strict(),
                )
                .min(1)
                .max(8),
            })
            .strict()
            .safeParse(value).success,
      )
      .optional(),
    rtpParameters: z
      .custom<RtpParameters>((value) => rtpShape.safeParse(value).success)
      .optional(),
    rtpCapabilities: z
      .custom<RtpCapabilities>((value) => rtpShape.safeParse(value).success)
      .optional(),
  })
  .strict();

async function channelFor(req: AuthRequest, channelId: string) {
  const target = await prisma.channel.findFirst({
    where: {
      id: channelId,
      workspace: { members: { some: { userId: req.auth!.userId } } },
      isPrivate: true,
      members: { some: { userId: req.auth!.userId } },
      directKey: null,
    },
    select: { workspaceId: true },
  });
  if (!target) throw new HttpError(404, "Group conversation not found");
  req.auth!.workspaceId = target.workspaceId;
}
groupCallsRouter.get("/config", (_req, res) =>
  res.json({
    data: {
      enabled: sfuEnabled,
      available: sfuEnabled && sfuReady(),
      maximumParticipants: 12,
    },
  }),
);
groupCallsRouter.get(
  "/:channelId",
  asyncRoute(async (req: AuthRequest, res) => {
    await channelFor(req, req.params.channelId);
    const call = await prisma.groupCall.findFirst({
      where: {
        channelId: req.params.channelId,
        endedAt: null,
        participants: { some: { leftAt: null, lastSeenAt: { gt: fresh() } } },
      },
      select: {
        id: true,
        kind: true,
        participants: {
          where: { leftAt: null, lastSeenAt: { gt: fresh() } },
          select: { userId: true },
        },
      },
    });
    res.json({ data: call });
  }),
);
groupCallsRouter.post(
  "/:channelId/join",
  asyncRoute(async (req: AuthRequest, res) => {
    if (!sfuEnabled)
      throw new HttpError(503, "Group calling isn't configured on this server");
    if (!sfuReady())
      throw new HttpError(
        503,
        "The call server is reconnecting. Try again shortly.",
      );
    const input = parse(
      z
        .object({ kind: z.enum(["audio", "video"]), sessionId: z.uuid() })
        .strict(),
      req.body,
    );
    await channelFor(req, req.params.channelId);
    const result = await prisma.$transaction(async (tx) => {
      await lockEventOrder(tx);
      await lockChannel(tx, req.params.channelId);
      await accessibleChannel(req, req.params.channelId, tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`call-user:${req.auth!.userId}`}))`;
      if (
        await tx.call.findFirst({
          where: {
            status: { in: ["active", "ringing"] },
            expiresAt: { gt: new Date() },
            callerSeenAt: { gt: fresh() },
            OR: [
              { callerId: req.auth!.userId },
              { calleeId: req.auth!.userId },
            ],
          },
          select: { id: true },
        })
      )
        throw new HttpError(409, "Finish your current call first");
      if (
        await tx.groupCallParticipant.findFirst({
          where: {
            userId: req.auth!.userId,
            sessionId: { not: input.sessionId },
            leftAt: null,
            lastSeenAt: { gt: fresh() },
            call: { endedAt: null },
          },
        })
      )
        throw new HttpError(409, "You are already in a call on another device");
      const active = await tx.groupCall.findFirst({
        where: { channelId: req.params.channelId, endedAt: null },
      });
      const call =
        active ||
        (await tx.groupCall.create({
          data: { channelId: req.params.channelId, kind: input.kind },
        }));
      const count = await tx.groupCallParticipant.count({
        where: {
          callId: call.id,
          userId: { not: req.auth!.userId },
          leftAt: null,
          lastSeenAt: { gt: fresh() },
        },
      });
      if (count >= 12)
        throw new HttpError(409, "This call has reached its 12-person limit");
      await tx.groupCallParticipant.upsert({
        where: { callId_userId: { callId: call.id, userId: req.auth!.userId } },
        create: {
          callId: call.id,
          userId: req.auth!.userId,
          sessionId: input.sessionId,
        },
        update: {
          sessionId: input.sessionId,
          lastSeenAt: new Date(),
          leftAt: null,
        },
      });
      await emitChannel(tx, call.channelId, {
        type: "groupcall.updated",
        targetId: call.id,
        notify: !active,
        excludePushUserId: req.auth!.userId,
      });
      return call;
    });
    try {
      const media = await joinSfu(result.id, input.sessionId, req.auth!.userId);
      res.json({
        data: {
          id: result.id,
          nativeId: result.id,
          kind: result.kind,
          ...media,
          ...callIce(req.auth!.userId),
        },
      });
    } catch (error) {
      await prisma.groupCallParticipant.updateMany({
        where: { sessionId: input.sessionId, callId: result.id },
        data: { leftAt: new Date() },
      });
      throw error;
    }
  }),
);
groupCallsRouter.post(
  "/:id/media",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(mediaSchema, req.body);
    const participant = await prisma.groupCallParticipant.findFirst({
      where: {
        sessionId: input.sessionId,
        callId: req.params.id,
        userId: req.auth!.userId,
        leftAt: null,
        lastSeenAt: { gt: fresh() },
        call: { endedAt: null },
      },
      include: { call: true },
    });
    if (!participant) throw new HttpError(404, "Call participation not found");
    if (
      input.type === "produce" &&
      input.kind === "video" &&
      participant.call.kind !== "video"
    )
      throw new HttpError(400, "This group call supports audio only");
    await channelFor(req, participant.call.channelId);
    await prisma.groupCallParticipant.update({
      where: { sessionId: input.sessionId },
      data: { lastSeenAt: new Date() },
    });
    res.json({ data: await sfuAction(req.params.id, input.sessionId, input) });
  }),
);
groupCallsRouter.post(
  "/:id/leave",
  asyncRoute(async (req: AuthRequest, res) => {
    const { sessionId } = parse(
      z.object({ sessionId: z.uuid() }).strict(),
      req.body,
    );
    const record = await prisma.groupCallParticipant.findFirst({
      where: { sessionId, callId: req.params.id, userId: req.auth!.userId },
      include: { call: true },
    });
    if (!record) {
      res.status(204).end();
      return;
    }
    await prisma.$transaction(async (tx) => {
      await lockEventOrder(tx);
      await lockChannel(tx, record.call.channelId);
      await tx.groupCallParticipant.updateMany({
        where: { sessionId, userId: req.auth!.userId },
        data: { leftAt: new Date() },
      });
      if (
        !(await tx.groupCallParticipant.count({
          where: {
            callId: record.callId,
            leftAt: null,
            lastSeenAt: { gt: fresh() },
          },
        }))
      )
        await tx.groupCall.update({
          where: { id: record.callId },
          data: { endedAt: new Date() },
        });
      await emitChannel(tx, record.call.channelId, {
        type: "groupcall.updated",
        targetId: record.callId,
      });
    });
    await leaveSfu(req.params.id, sessionId);
    res.status(204).end();
  }),
);
