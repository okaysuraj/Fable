import { Router } from "express";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma, sqlTable } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { asyncRoute, HttpError, parse } from "../lib/http.js";
import {
  accessibleChannel,
  channelScope,
  lockChannel,
  lockWorkspace,
  workspaceActor,
  publicUserSelect,
  formatUser,
} from "../lib/access.js";
import { messagePage } from "../lib/messageHistory.js";
import { directoryPage, directoryQuery } from "../lib/directory.js";

import { channelMembersRouter } from "./channelMembers.js";
import { conversationPresenceRouter } from "./conversationPresence.js";

/** Room directory, metadata, read watermarks and pinned-message history. */
export const channelsRouter = Router();
channelsRouter.use(channelMembersRouter);
channelsRouter.use(conversationPresenceRouter);
type ChannelRecord = {
  id: string;
  workspaceId: string;
  name: string;
  topic: string;
  type: string;
  isPrivate: boolean;
  createdById: string | null;
  directKey: string | null;
};
export async function formatChannels(
  channels: ChannelRecord[],
  req: AuthRequest,
  db: Prisma.TransactionClient = prisma,
) {
  if (!channels.length) return [];
  const metrics = await db.$queryRaw<
    { id: string; memberCount: number; unreadCount: number; joined: boolean }[]
  >(Prisma.sql`
    SELECT c."id",
      (CASE WHEN c."isPrivate" THEN (SELECT count(*) FROM ${sqlTable("ChannelMember")} cm WHERE cm."channelId" = c."id")
        ELSE (SELECT count(*) FROM ${sqlTable("WorkspaceMember")} wm WHERE wm."workspaceId" = c."workspaceId") END)::int AS "memberCount",
      EXISTS(SELECT 1 FROM ${sqlTable("ChannelMember")} cm WHERE cm."channelId" = c."id" AND cm."userId" = ${req.auth!.userId}) AS "joined",
      (SELECT count(*) FROM ${sqlTable("Message")} m WHERE m."channelId" = c."id" AND m."deletedAt" IS NULL AND m."senderId" <> ${req.auth!.userId}
        AND (m."createdAt" > COALESCE((SELECT cm."lastReadAt" FROM ${sqlTable("ChannelMember")} cm WHERE cm."channelId" = c."id" AND cm."userId" = ${req.auth!.userId}), c."createdAt")
          OR EXISTS(SELECT 1 FROM ${sqlTable("ChannelMember")} cm WHERE cm."channelId" = c."id" AND cm."userId" = ${req.auth!.userId} AND cm."lastReadMessageId" IS NOT NULL AND m."createdAt" = cm."lastReadAt" AND m."id" > cm."lastReadMessageId")))::int AS "unreadCount"
    FROM ${sqlTable("Channel")} c WHERE c."id" IN (${Prisma.join(channels.map((channel) => channel.id))})
  `);
  const byId = new Map(metrics.map((metric) => [metric.id, metric]));
  const memberships = await db.workspaceMember.findMany({
    where: {
      workspaceId: {
        in: [...new Set(channels.map((channel) => channel.workspaceId))],
      },
      userId: req.auth!.userId,
    },
    select: { workspaceId: true, role: true },
  });
  const roles = new Map(
    memberships.map((membership) => [membership.workspaceId, membership.role]),
  );
  const mayManage = (
    channel: Pick<ChannelRecord, "createdById" | "workspaceId">,
  ) =>
    channel.createdById === req.auth!.userId ||
    ["owner", "admin"].includes(roles.get(channel.workspaceId) ?? "");
  const peers = await db.channelMember.findMany({
    where: {
      channelId: { in: channels.filter((c) => c.directKey).map((c) => c.id) },
      userId: { not: req.auth!.userId },
    },
    select: { channelId: true, user: { select: publicUserSelect } },
  });
  const previews = await db.channel.findMany({
    where: { id: { in: channels.map((c) => c.id) } },
    select: {
      id: true,
      messages: {
        where: { deletedAt: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: {
          content: true,
          createdAt: true,
          assets: { select: { name: true }, take: 1 },
        },
      },
    },
  });
  return channels.map(({ directKey, ...channel }) => ({
    ...channel,
    name: directKey
      ? peers.find((p) => p.channelId === channel.id)?.user.name ||
        "Direct conversation"
      : channel.name,
    isDirect: Boolean(directKey),
    peer: directKey
      ? (() => {
          const peer = peers.find(
            (person) => person.channelId === channel.id,
          )?.user;
          return peer ? formatUser(peer) : null;
        })()
      : null,
    lastMessage: (() => {
      const message = previews.find((row) => row.id === channel.id)
        ?.messages[0];
      return message
        ? {
            text: message.content || message.assets[0]?.name || "Code snippet",
            timestamp: message.createdAt.toISOString(),
          }
        : null;
    })(),
    memberCount: byId.get(channel.id)!.memberCount,
    unreadCount: byId.get(channel.id)!.unreadCount,
    activeCall: null,
    canManageChannel: !directKey && mayManage(channel),
    canManageMembers: !directKey && channel.isPrivate && mayManage(channel),
    canLeave:
      !directKey &&
      channel.isPrivate &&
      byId.get(channel.id)!.joined &&
      channel.createdById !== req.auth!.userId,
  }));
}
export const channelSelect = {
  id: true,
  workspaceId: true,
  name: true,
  topic: true,
  type: true,
  isPrivate: true,
  createdById: true,
  directKey: true,
} as const;
channelsRouter.get(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const { limit, after, q, allWorkspaces } = parse(
      directoryQuery.extend({ allWorkspaces: z.enum(["true"]).optional() }),
      req.query,
    );
    const result = await prisma.$transaction(
      async (tx) => {
        if (!allWorkspaces)
          req.auth!.workspaceRole = (
            await workspaceActor(tx, req, req.auth!.workspaceId!)
          ).role;
        const search: Prisma.ChannelWhereInput = q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { topic: { contains: q, mode: "insensitive" } },
                {
                  directKey: { not: null },
                  members: {
                    some: {
                      userId: { not: req.auth!.userId },
                      user: { name: { contains: q, mode: "insensitive" } },
                    },
                  },
                },
              ],
            }
          : {};
        const scope: Prisma.ChannelWhereInput = {
          AND: [
            allWorkspaces
              ? {
                  workspace: {
                    members: { some: { userId: req.auth!.userId } },
                  },
                  OR: [
                    { isPrivate: false },
                    { members: { some: { userId: req.auth!.userId } } },
                  ],
                }
              : channelScope(req),
            search,
          ],
        };
        const cursor = after
          ? await tx.channel.findFirst({
              where: { AND: [scope, { id: after }] },
              select: { id: true, lastMessageAt: true },
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
                        { lastMessageAt: { lt: cursor.lastMessageAt } },
                        {
                          lastMessageAt: cursor.lastMessageAt,
                          id: { lt: cursor.id },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
          select: channelSelect,
          orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
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
// A pair has one direct conversation per workspace. The workspace gate serializes
// creation with membership changes and concurrent requests from either participant.
channelsRouter.post(
  "/direct",
  asyncRoute(async (req: AuthRequest, res) => {
    const { userId } = parse(
      z.object({ userId: z.string().min(1).max(128) }).strict(),
      req.body,
    );
    if (userId === req.auth!.userId)
      throw new HttpError(400, "Choose another person");
    const result = await prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, req.auth!.workspaceId!);
      await workspaceActor(tx, req, req.auth!.workspaceId!);
      const target = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: req.auth!.workspaceId!, userId },
        },
      });
      if (!target) throw new HttpError(404, "Person not found in this group");
      const key = createHash("sha256")
        .update(
          JSON.stringify([
            req.auth!.workspaceId,
            ...[userId, req.auth!.userId].sort(),
          ]),
        )
        .digest("hex");
      const channel = await tx.channel.upsert({
        where: { directKey: key },
        update: {},
        create: {
          workspaceId: req.auth!.workspaceId!,
          name: `dm-${key}`,
          directKey: key,
          isPrivate: true,
          members: { create: [{ userId }, { userId: req.auth!.userId }] },
        },
        select: channelSelect,
      });
      // Rejoining a workspace can restore the same pair; never enroll a third person.
      await tx.channelMember.createMany({
        data: [userId, req.auth!.userId].map((id) => ({
          channelId: channel.id,
          userId: id,
        })),
        skipDuplicates: true,
      });
      return (await formatChannels([channel], req, tx))[0];
    });
    res.json({ data: result });
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
  "/groups",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z
        .object({
          name: z.string().trim().min(1).max(80),
          memberIds: z.array(z.string().min(1).max(128)).min(1).max(99),
          clientMutationId: z.string().min(8).max(128),
        })
        .strict(),
      req.body,
    );
    const members = [...new Set(input.memberIds)]
      .filter((id) => id !== req.auth!.userId)
      .sort();
    if (!members.length)
      throw new HttpError(400, "Select at least one other person");
    const digest = createHash("sha256")
      .update(JSON.stringify([req.auth!.userId, input.clientMutationId]))
      .digest("hex");
    const id = "group_" + digest;
    const workspaceId = "group_space_" + digest;
    const data = await prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, workspaceId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('group-create'), hashtext(${id}))`;
      const existing = await tx.channel.findUnique({
        where: { id },
        include: { members: { select: { userId: true } } },
      });
      if (existing) {
        const membership = await tx.workspaceMember.findUnique({
          where: {
            workspaceId_userId: { workspaceId, userId: req.auth!.userId },
          },
        });
        const enrolled = existing.members.some(
          (member) => member.userId === req.auth!.userId,
        );
        if (!membership || !enrolled)
          throw new HttpError(404, "This group is no longer accessible");
        const existingMembers = existing.members
          .map((member) => member.userId)
          .filter((member) => member !== req.auth!.userId)
          .sort();
        if (
          existing.name !== input.name ||
          JSON.stringify(existingMembers) !== JSON.stringify(members)
        )
          throw new HttpError(
            409,
            "This group request was already used. Reopen New Group to start a different group.",
          );
        return (await formatChannels([existing], req, tx))[0];
      }
      const count = await tx.user.count({
        where: { id: { in: members }, account: { isNot: null } },
      });
      if (count !== members.length)
        throw new HttpError(
          400,
          "Some selected people are no longer available. Refresh your contacts.",
        );
      await tx.workspace.create({
        data: {
          id: workspaceId,
          name: input.name,
          members: {
            create: [req.auth!.userId, ...members].map((userId) => ({
              userId,
              role: userId === req.auth!.userId ? "owner" : "member",
            })),
          },
        },
      });
      const created = await tx.channel.create({
        data: {
          id,
          workspaceId,
          createdById: req.auth!.userId,
          name: input.name,
          isPrivate: true,
          type: "text",
          members: {
            create: [req.auth!.userId, ...members].map((userId) => ({
              userId,
            })),
          },
        },
        select: channelSelect,
      });
      await tx.auditEvent.create({
        data: {
          workspaceId,
          actorId: req.auth!.userId,
          action: "channel.create",
          targetId: created.id,
        },
      });
      return (await formatChannels([created], req, tx))[0];
    });
    res.status(201).json({ data });
  }),
);

channelsRouter.post(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z
        .object({
          name: z.string().trim().min(1).max(80),
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
  if (channel.directKey)
    throw new HttpError(403, "Direct conversation membership is fixed");
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
          name: z.string().trim().min(1).max(80).optional(),
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
      INSERT INTO ${sqlTable("ChannelMember")} ("channelId", "userId", "lastReadAt", "lastReadMessageId") VALUES (${channel.id}, ${req.auth!.userId}, ${lastReadAt}, ${messageId || null})
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
