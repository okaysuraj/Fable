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
  formatUser,
  lockChannel,
  publicUserSelect,
  workspaceActor,
} from "../lib/access.js";
import { directoryPage, directoryQuery } from "../lib/directory.js";

/** Authorized private-room rosters and workspace member candidates. */
export const channelMembersRouter = Router();

function memberData(
  user: Parameters<typeof formatUser>[0],
  role: string,
  joinedAt: Date,
  channel: { createdById: string | null; isPrivate: boolean },
  req: AuthRequest,
) {
  return {
    ...formatUser(user),
    channelRole: channel.createdById === user.id ? "creator" : "member",
    workspaceRole: role,
    joinedAt: joinedAt.toISOString(),
    canRemove:
      channel.isPrivate &&
      channel.createdById !== user.id &&
      (canManageChannel(channel, req) || user.id === req.auth!.userId),
  };
}
channelMembersRouter.get(
  "/:id/members",
  asyncRoute(async (req: AuthRequest, res) => {
    const { limit, after, q } = parse(directoryQuery, req.query);
    const result = await prisma.$transaction(
      async (tx) => {
        const channel = await accessibleChannel(req, req.params.id, tx);
        req.auth!.workspaceRole = (
          await workspaceActor(tx, req, channel.workspaceId)
        ).role;
        const search: Prisma.UserWhereInput = q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { handle: { contains: q, mode: "insensitive" } },
              ],
            }
          : {};
        if (channel.isPrivate) {
          const scope: Prisma.ChannelMemberWhereInput = {
            channelId: channel.id,
            user: {
              AND: [
                search,
                { memberships: { some: { workspaceId: channel.workspaceId } } },
              ],
            },
          };
          const cursor = after
            ? await tx.channelMember.findFirst({
                where: { AND: [scope, { userId: after }] },
                select: { createdAt: true, userId: true },
              })
            : null;
          if (after && !cursor)
            throw new HttpError(400, "Invalid channel member cursor");
          const rows = await tx.channelMember.findMany({
            where: {
              AND: [
                scope,
                ...(cursor
                  ? [
                      {
                        OR: [
                          { createdAt: { gt: cursor.createdAt } },
                          {
                            createdAt: cursor.createdAt,
                            userId: { gt: cursor.userId },
                          },
                        ],
                      },
                    ]
                  : []),
              ],
            },
            orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
            select: {
              userId: true,
              createdAt: true,
              user: {
                select: {
                  ...publicUserSelect,
                  memberships: {
                    where: { workspaceId: channel.workspaceId },
                    select: { role: true },
                  },
                },
              },
            },
            take: limit + 1,
          });
          const page = directoryPage(
            rows,
            limit,
            await tx.channelMember.count({ where: scope }),
            (row) => row.userId,
          );
          return {
            ...page,
            data: page.data.map((row) =>
              memberData(
                row.user,
                row.user.memberships[0].role,
                row.createdAt,
                channel,
                req,
              ),
            ),
            canManageMembers: canManageChannel(channel, req),
          };
        }
        const scope: Prisma.WorkspaceMemberWhereInput = {
          workspaceId: channel.workspaceId,
          user: search,
        };
        const cursor = after
          ? await tx.workspaceMember.findFirst({
              where: { AND: [scope, { userId: after }] },
              select: { createdAt: true, userId: true },
            })
          : null;
        if (after && !cursor)
          throw new HttpError(400, "Invalid channel member cursor");
        const rows = await tx.workspaceMember.findMany({
          where: {
            AND: [
              scope,
              ...(cursor
                ? [
                    {
                      OR: [
                        { createdAt: { gt: cursor.createdAt } },
                        {
                          createdAt: cursor.createdAt,
                          userId: { gt: cursor.userId },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
          orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
          select: {
            userId: true,
            role: true,
            createdAt: true,
            user: { select: publicUserSelect },
          },
          take: limit + 1,
        });
        const page = directoryPage(
          rows,
          limit,
          await tx.workspaceMember.count({ where: scope }),
          (row) => row.userId,
        );
        return {
          ...page,
          data: page.data.map((row) =>
            memberData(row.user, row.role, row.createdAt, channel, req),
          ),
          canManageMembers: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json(result);
  }),
);
channelMembersRouter.get(
  "/:id/member-candidates",
  asyncRoute(async (req: AuthRequest, res) => {
    const { limit, after, q } = parse(directoryQuery, req.query);
    const result = await prisma.$transaction(
      async (tx) => {
        const channel = await accessibleChannel(req, req.params.id, tx);
        req.auth!.workspaceRole = (
          await workspaceActor(tx, req, channel.workspaceId)
        ).role;
        if (!channel.isPrivate)
          throw new HttpError(
            400,
            "Public channels already include all workspace members",
          );
        if (!canManageChannel(channel, req))
          throw new HttpError(403, "Channel management permission required");
        const scope: Prisma.WorkspaceMemberWhereInput = {
          workspaceId: channel.workspaceId,
          user: {
            channels: { none: { channelId: channel.id } },
            ...(q
              ? {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { handle: { contains: q, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
        };
        const cursor = after
          ? await tx.workspaceMember.findFirst({
              where: { AND: [scope, { userId: after }] },
              select: { createdAt: true, userId: true },
            })
          : null;
        if (after && !cursor)
          throw new HttpError(400, "Invalid candidate cursor");
        const rows = await tx.workspaceMember.findMany({
          where: {
            AND: [
              scope,
              ...(cursor
                ? [
                    {
                      OR: [
                        { createdAt: { gt: cursor.createdAt } },
                        {
                          createdAt: cursor.createdAt,
                          userId: { gt: cursor.userId },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
          orderBy: [{ createdAt: "asc" }, { userId: "asc" }],
          select: { userId: true, user: { select: publicUserSelect } },
          take: limit + 1,
        });
        const page = directoryPage(
          rows,
          limit,
          await tx.workspaceMember.count({ where: scope }),
          (row) => row.userId,
        );
        return { ...page, data: page.data.map((row) => formatUser(row.user)) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json(result);
  }),
);
channelMembersRouter.post(
  "/:id/members",
  asyncRoute(async (req: AuthRequest, res) => {
    const { userId } = parse(
      z.object({ userId: z.string().min(1).max(128) }).strict(),
      req.body,
    );
    const result = await prisma.$transaction(async (tx) => {
      await lockChannel(tx, req.params.id);
      const channel = await tx.channel.findFirst({
        where: { id: req.params.id, ...channelScope(req) },
      });
      if (!channel) throw new HttpError(404, "Channel not found");
      if (!channel.isPrivate)
        throw new HttpError(
          400,
          "Public channels already include all workspace members",
        );
      const actor = await tx.workspaceMember.findUniqueOrThrow({
        where: {
          workspaceId_userId: {
            workspaceId: channel.workspaceId,
            userId: req.auth!.userId,
          },
        },
      });
      req.auth!.workspaceRole = actor.role;
      if (
        !["owner", "admin"].includes(actor.role) &&
        channel.createdById !== req.auth!.userId
      )
        throw new HttpError(403, "Channel management permission required");
      const target = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId: channel.workspaceId, userId },
        },
        include: { user: { select: publicUserSelect } },
      });
      if (!target) throw new HttpError(404, "Workspace member not found");
      const existing = await tx.channelMember.findUnique({
        where: { channelId_userId: { channelId: channel.id, userId } },
      });
      const membership =
        existing ||
        (await tx.channelMember.create({
          data: { channelId: channel.id, userId },
        }));
      if (!existing)
        await tx.auditEvent.create({
          data: {
            workspaceId: channel.workspaceId,
            actorId: req.auth!.userId,
            action: "channel.member.add",
            targetId: userId,
            metadata: { channelId: channel.id },
          },
        });
      return {
        data: memberData(
          target.user,
          target.role,
          membership.createdAt,
          channel,
          req,
        ),
        created: !existing,
      };
    });
    res.status(result.created ? 201 : 200).json({ data: result.data });
  }),
);
channelMembersRouter.delete(
  "/:id/members/:userId",
  asyncRoute(async (req: AuthRequest, res) => {
    await prisma.$transaction(async (tx) => {
      await lockChannel(tx, req.params.id);
      const channel = await tx.channel.findFirst({
        where: { id: req.params.id, ...channelScope(req) },
      });
      if (!channel) throw new HttpError(404, "Channel not found");
      if (!channel.isPrivate)
        throw new HttpError(
          400,
          "Public channels inherit workspace membership",
        );
      const actor = await tx.workspaceMember.findUniqueOrThrow({
        where: {
          workspaceId_userId: {
            workspaceId: channel.workspaceId,
            userId: req.auth!.userId,
          },
        },
      });
      const manager =
        ["owner", "admin"].includes(actor.role) ||
        channel.createdById === req.auth!.userId;
      if (!manager && req.params.userId !== req.auth!.userId)
        throw new HttpError(403, "Channel management permission required");
      if (req.params.userId === channel.createdById)
        throw new HttpError(
          409,
          "The channel creator cannot leave or be removed before ownership is transferred",
        );
      const removed = await tx.channelMember.deleteMany({
        where: { channelId: channel.id, userId: req.params.userId },
      });
      if (!removed.count) throw new HttpError(404, "Channel member not found");
      await tx.auditEvent.create({
        data: {
          workspaceId: channel.workspaceId,
          actorId: req.auth!.userId,
          action: manager ? "channel.member.remove" : "channel.member.leave",
          targetId: req.params.userId,
          metadata: { channelId: channel.id },
        },
      });
    });
    res.status(204).end();
  }),
);
