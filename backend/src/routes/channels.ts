import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { asyncRoute, HttpError, parse } from "../lib/http.js";
import {
  accessibleChannel,
  canManageChannel,
  channelScope,
  lockChannel,
  lockWorkspace,
  workspaceActor,
} from "../lib/access.js";
import { messagePage } from "../lib/messageHistory.js";
import { directoryPage, directoryQuery } from "../lib/directory.js";

import { channelMembersRouter } from "./channelMembers.js";

/** Room directory, metadata, read watermarks and pinned-message history. */
export const channelsRouter = Router();
channelsRouter.use(channelMembersRouter);
type ChannelRecord = {
  id: string;
  name: string;
  topic: string;
  type: string;
  isPrivate: boolean;
  createdById: string | null;
};
async function formatChannels(
  channels: ChannelRecord[],
  req: AuthRequest,
  db: Prisma.TransactionClient = prisma,
) {
  if (!channels.length) return [];
  const metrics = await db.$queryRaw<
    { id: string; memberCount: number; unreadCount: number; joined: boolean }[]
  >(Prisma.sql`
    SELECT c."id",
      (CASE WHEN c."isPrivate" THEN (SELECT count(*) FROM "ChannelMember" cm WHERE cm."channelId" = c."id")
        ELSE (SELECT count(*) FROM "WorkspaceMember" wm WHERE wm."workspaceId" = c."workspaceId") END)::int AS "memberCount",
      EXISTS(SELECT 1 FROM "ChannelMember" cm WHERE cm."channelId" = c."id" AND cm."userId" = ${req.auth!.userId}) AS "joined",
      (SELECT count(*) FROM "Message" m WHERE m."channelId" = c."id" AND m."deletedAt" IS NULL AND m."senderId" <> ${req.auth!.userId}
        AND (m."createdAt" > COALESCE((SELECT cm."lastReadAt" FROM "ChannelMember" cm WHERE cm."channelId" = c."id" AND cm."userId" = ${req.auth!.userId}), c."createdAt")
          OR EXISTS(SELECT 1 FROM "ChannelMember" cm WHERE cm."channelId" = c."id" AND cm."userId" = ${req.auth!.userId} AND cm."lastReadMessageId" IS NOT NULL AND m."createdAt" = cm."lastReadAt" AND m."id" > cm."lastReadMessageId")))::int AS "unreadCount"
    FROM "Channel" c WHERE c."id" IN (${Prisma.join(channels.map((channel) => channel.id))})
  `);
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));
  return channels.map((channel) => ({
    ...channel,
    memberCount: byId.get(channel.id)!.memberCount,
    unreadCount: byId.get(channel.id)!.unreadCount,
    activeCall: null,
    canManageChannel: canManageChannel(channel, req),
    canManageMembers: channel.isPrivate && canManageChannel(channel, req),
    canLeave:
      channel.isPrivate &&
      byId.get(channel.id)!.joined &&
      channel.createdById !== req.auth!.userId,
  }));
}
const channelSelect = {
  id: true,
  name: true,
  topic: true,
  type: true,
  isPrivate: true,
  createdById: true,
} as const;
channelsRouter.get(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const { limit, after, q } = parse(directoryQuery, req.query);
    const result = await prisma.$transaction(
      async (tx) => {
        req.auth!.workspaceRole = (
          await workspaceActor(tx, req, req.auth!.workspaceId!)
        ).role;
        const search: Prisma.ChannelWhereInput = q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { topic: { contains: q, mode: "insensitive" } },
              ],
            }
          : {};
        const scope: Prisma.ChannelWhereInput = {
          AND: [channelScope(req), search],
        };
        const cursor = after
          ? await tx.channel.findFirst({
              where: { AND: [scope, { id: after }] },
              select: { id: true, createdAt: true },
            })
          : null;
        if (after && !cursor)
          throw new HttpError(400, "Invalid channel cursor");
        const rows = await tx.channel.findMany({
          where: {
            AND: [
              scope,
              ...(cursor
                ? [
                    {
                      OR: [
                        { createdAt: { gt: cursor.createdAt } },
                        { createdAt: cursor.createdAt, id: { gt: cursor.id } },
                      ],
                    },
                  ]
                : []),
            ],
          },
          select: channelSelect,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: limit + 1,
        });
        const page = directoryPage(
          rows,
          limit,
          await tx.channel.count({ where: scope }),
          (row) => row.id,
        );
        return { ...page, data: await formatChannels(page.data, req, tx) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json(result);
  }),
);
channelsRouter.get(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const data = await prisma.$transaction(
      async (tx) => {
        const channel = await accessibleChannel(req, req.params.id, tx);
        req.auth!.workspaceRole = (
          await workspaceActor(tx, req, channel.workspaceId)
        ).role;
        const selected = await tx.channel.findUniqueOrThrow({
          where: { id: channel.id },
          select: channelSelect,
        });
        return (await formatChannels([selected], req, tx))[0];
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json({ data });
  }),
);
channelsRouter.post(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z
        .object({
          name: z
            .string()
            .trim()
            .min(1)
            .max(80)
            .regex(
              /^[a-z0-9][a-z0-9_-]*$/,
              "Use lowercase letters, numbers, hyphens or underscores",
            ),
          topic: z.string().trim().max(500).default(""),
          type: z.enum(["text", "audio", "video"]).default("text"),
          isPrivate: z.boolean().default(false),
        })
        .strict(),
      req.body,
    );
    const channel = await prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, req.auth!.workspaceId!, true);
      req.auth!.workspaceRole = (
        await workspaceActor(tx, req, req.auth!.workspaceId!)
      ).role;
      const created = await tx.channel.create({
        data: {
          ...input,
          workspaceId: req.auth!.workspaceId!,
          createdById: req.auth!.userId,
          members: { create: { userId: req.auth!.userId } },
        },
        select: channelSelect,
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: req.auth!.workspaceId!,
          actorId: req.auth!.userId,
          action: "channel.create",
          targetId: created.id,
        },
      });
      return (await formatChannels([created], req, tx))[0];
    });
    res.status(201).json({ data: channel });
  }),
);

async function managedChannel(
  tx: Prisma.TransactionClient,
  req: AuthRequest,
  id: string,
) {
  await lockChannel(tx, id);
  const channel = await accessibleChannel(req, id, tx);
  const actor = await workspaceActor(tx, req, channel.workspaceId);
  if (
    !["owner", "admin"].includes(actor.role) &&
    channel.createdById !== actor.userId
  )
    throw new HttpError(403, "Channel management permission required");
  req.auth!.workspaceRole = actor.role;
  return channel;
}

channelsRouter.patch(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z
        .object({
          name: z
            .string()
            .trim()
            .min(1)
            .max(80)
            .regex(
              /^[a-z0-9][a-z0-9_-]*$/,
              "Use lowercase letters, numbers, hyphens or underscores",
            )
            .optional(),
          topic: z.string().trim().max(500).optional(),
        })
        .strict()
        .refine(
          (value) => value.name !== undefined || value.topic !== undefined,
          "Provide a channel field",
        ),
      req.body,
    );
    const result = await prisma.$transaction(async (tx) => {
      const channel = await managedChannel(tx, req, req.params.id);
      const updated = await tx.channel.update({
        where: { id: channel.id },
        data: input,
        select: channelSelect,
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: channel.workspaceId,
          actorId: req.auth!.userId,
          action: "channel.update",
          targetId: channel.id,
        },
      });
      return (await formatChannels([updated], req, tx))[0];
    });
    res.json({ data: result });
  }),
);

channelsRouter.post(
  "/:id/transfer-ownership",
  asyncRoute(async (req: AuthRequest, res) => {
    const { userId } = parse(
      z.object({ userId: z.string().min(1).max(128) }).strict(),
      req.body,
    );
    const result = await prisma.$transaction(async (tx) => {
      const channel = await managedChannel(tx, req, req.params.id);
      if (channel.createdById === userId)
        throw new HttpError(400, "Choose another channel member");
      const target = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: channel.workspaceId, userId },
        },
      });
      if (!target) throw new HttpError(404, "Workspace member not found");
      if (
        channel.isPrivate &&
        !(await tx.channelMember.findUnique({
          where: { channelId_userId: { channelId: channel.id, userId } },
        }))
      )
        throw new HttpError(
          400,
          "The new owner must already belong to this private channel",
        );
      const updated = await tx.channel.update({
        where: { id: channel.id },
        data: { createdById: userId },
        select: channelSelect,
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: channel.workspaceId,
          actorId: req.auth!.userId,
          action: "channel.ownership.transfer",
          targetId: channel.id,
          metadata: { previousOwnerId: channel.createdById, userId },
        },
      });
      return (await formatChannels([updated], req, tx))[0];
    });
    res.json({ data: result });
  }),
);

channelsRouter.delete(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const { confirmName } = parse(
      z.object({ confirmName: z.string().min(1).max(80) }).strict(),
      req.body,
    );
    await prisma.$transaction(async (tx) => {
      const channel = await managedChannel(tx, req, req.params.id);
      if (confirmName !== channel.name)
        throw new HttpError(
          400,
          "Enter the exact channel name to confirm deletion",
        );
      await tx.auditEvent.create({
        data: {
          workspaceId: channel.workspaceId,
          actorId: req.auth!.userId,
          action: "channel.delete",
          targetId: channel.id,
        },
      });
      await tx.channel.delete({ where: { id: channel.id } });
    });
    res.status(204).end();
  }),
);
channelsRouter.get(
  "/:id/pins",
  asyncRoute(async (req: AuthRequest, res) => {
    res.json(await messagePage(req, req.params.id, true));
  }),
);
channelsRouter.post(
  "/:id/read",
  asyncRoute(async (req: AuthRequest, res) => {
    await prisma.$transaction(async (tx) => {
      await lockChannel(tx, req.params.id);
      const channel = await tx.channel.findFirst({
        where: { id: req.params.id, ...channelScope(req) },
      });
      if (!channel) throw new HttpError(404, "Channel not found");
      const { messageId } = parse(
        z.object({ messageId: z.string().min(1).max(128).optional() }).strict(),
        req.body ?? {},
      );
      let lastReadAt = new Date();
      if (messageId) {
        const message = await tx.message.findFirst({
          where: { id: messageId, channelId: channel.id },
          select: { createdAt: true },
        });
        if (!message)
          throw new HttpError(400, "Read cursor must belong to this channel");
        lastReadAt = message.createdAt;
      }
      // Administrative oversight alone does not enroll an administrator in a private room.
      if (
        channel.isPrivate &&
        !(await tx.channelMember.findUnique({
          where: {
            channelId_userId: {
              channelId: channel.id,
              userId: req.auth!.userId,
            },
          },
        }))
      )
        return;
      await tx.$executeRaw`
      INSERT INTO "ChannelMember" ("channelId", "userId", "lastReadAt", "lastReadMessageId") VALUES (${channel.id}, ${req.auth!.userId}, ${lastReadAt}, ${messageId || null})
      ON CONFLICT ("channelId", "userId") DO UPDATE SET
        "lastReadMessageId" = CASE
          WHEN EXCLUDED."lastReadAt" > "ChannelMember"."lastReadAt" THEN EXCLUDED."lastReadMessageId"
          WHEN EXCLUDED."lastReadAt" = "ChannelMember"."lastReadAt" THEN CASE
            WHEN "ChannelMember"."lastReadMessageId" IS NULL OR EXCLUDED."lastReadMessageId" IS NULL THEN NULL
            ELSE GREATEST("ChannelMember"."lastReadMessageId", EXCLUDED."lastReadMessageId") END
          ELSE "ChannelMember"."lastReadMessageId" END,
        "lastReadAt" = GREATEST("ChannelMember"."lastReadAt", EXCLUDED."lastReadAt")
    `;
    });
    res.status(204).end();
  }),
);
