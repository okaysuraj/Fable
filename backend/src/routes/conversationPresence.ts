import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { accessibleChannel, lockChannel } from "../lib/access.js";
import { asyncRoute, parse } from "../lib/http.js";

/** Expiring typing leases and aggregated read progress never imply device delivery. */
export const conversationPresenceRouter = Router();
conversationPresenceRouter.post(
  "/:id/typing",
  asyncRoute(async (req: AuthRequest, res) => {
    const { typing } = parse(
      z.object({ typing: z.boolean() }).strict(),
      req.body,
    );
    await prisma.$transaction(async (tx) => {
      await lockChannel(tx, req.params.id);
      const channel = await accessibleChannel(req, req.params.id, tx);
      await tx.channelMember.upsert({
        where: {
          channelId_userId: { channelId: channel.id, userId: req.auth!.userId },
        },
        create: {
          channelId: channel.id,
          userId: req.auth!.userId,
          lastReadAt: channel.createdAt,
          typingUntil: typing ? new Date(Date.now() + 6000) : null,
        },
        update: { typingUntil: typing ? new Date(Date.now() + 6000) : null },
      });
    });
    res.status(204).end();
  }),
);
conversationPresenceRouter.get(
  "/:id/presence",
  asyncRoute(async (req: AuthRequest, res) => {
    const data = await prisma.$transaction(
      async (tx) => {
        const channel = await accessibleChannel(req, req.params.id, tx);
        const typing = await tx.channelMember.findMany({
          where: {
            channelId: channel.id,
            userId: { not: req.auth!.userId },
            typingUntil: { gt: new Date() },
            user: {
              memberships: { some: { workspaceId: channel.workspaceId } },
            },
          },
          select: { user: { select: { id: true, name: true } } },
          take: 8,
          orderBy: { userId: "asc" },
        });
        const message = await tx.message.findFirst({
          where: {
            channelId: channel.id,
            senderId: req.auth!.userId,
            deletedAt: null,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, createdAt: true },
        });
        const counts = message
          ? await tx.$queryRaw<{ readCount: number }[]>(Prisma.sql`
      SELECT count(*)::int AS "readCount" FROM "ChannelMember" cm
      JOIN "WorkspaceMember" wm ON wm."userId" = cm."userId" AND wm."workspaceId" = ${channel.workspaceId}
      WHERE cm."channelId" = ${channel.id} AND cm."userId" <> ${req.auth!.userId}
      AND cm."lastReadMessageId" IS NOT NULL
      AND (cm."lastReadAt" > ${message.createdAt} OR (cm."lastReadAt" = ${message.createdAt} AND cm."lastReadMessageId" >= ${message.id}))
    `)
          : [];
        return {
          typing: typing.map((row) => row.user),
          receipt: message
            ? { messageId: message.id, readCount: counts[0]?.readCount || 0 }
            : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json({ data });
  }),
);
