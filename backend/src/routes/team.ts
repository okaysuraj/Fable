/** Page public workspace profiles and resolve retained authors in bounded batches. */
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { asyncRoute, HttpError, parse } from "../lib/http.js";
import { formatUser, publicUserSelect } from "../lib/access.js";
import { directoryPage, directoryQuery } from "../lib/directory.js";

export const teamRouter = Router();
teamRouter.post(
  "/profiles",
  asyncRoute(async (req: AuthRequest, res) => {
    const { userIds } = parse(
      z
        .object({ userIds: z.array(z.string().min(1).max(128)).max(100) })
        .strict(),
      req.body,
    );
    const ids = [...new Set(userIds)];
    if (!ids.length) {
      res.json({ data: [] });
      return;
    }
    // A retained message window can reference authors outside the visible directory
    // page. Fetch only requested public profiles inside actual tenant membership.
    const users = await prisma.user.findMany({
      where: {
        id: { in: ids },
        memberships: {
          some: {
            workspaceId: req.auth!.workspaceId,
            workspace: { members: { some: { userId: req.auth!.userId } } },
          },
        },
      },
      select: publicUserSelect,
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    res.json({
      data: ids.flatMap((id) => {
        const user = byId.get(id);
        return user ? [formatUser(user)] : [];
      }),
    });
  }),
);
teamRouter.get(
  "/members",
  asyncRoute(async (req: AuthRequest, res) => {
    const { limit, after, q } = parse(directoryQuery, req.query);
    const result = await prisma.$transaction(
      async (tx) => {
        const scope: Prisma.WorkspaceMemberWhereInput = {
          workspaceId: req.auth!.workspaceId,
          workspace: { members: { some: { userId: req.auth!.userId } } },
          ...(q
            ? {
                user: {
                  OR: [
                    { name: { contains: q, mode: "insensitive" } },
                    { handle: { contains: q, mode: "insensitive" } },
                  ],
                },
              }
            : {}),
        };
        const cursor = after
          ? await tx.workspaceMember.findFirst({
              where: { AND: [scope, { userId: after }] },
              select: { userId: true, createdAt: true },
            })
          : null;
        if (after && !cursor) throw new HttpError(400, "Invalid member cursor");
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
          data: page.data.map((row) => ({
            ...formatUser(row.user),
            workspaceRole: row.role,
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json(result);
  }),
);
