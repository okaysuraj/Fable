import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { asyncRoute, HttpError, parse, identifier } from "../lib/http.js";
import { directoryPage, directoryQuery } from "../lib/directory.js";
import {
  lockWorkspace,
  workspaceActor,
  isAdministratorRole,
} from "../lib/access.js";

import { workspaceInvitationsRouter } from "./workspaceInvitations.js";
import { workspaceMembersRouter } from "./workspaceMembers.js";

/** Workspace directory, creation, metadata and administration activity. */
export const workspaceRouter = Router();
// Mount named resources before /:id so they cannot be mistaken for workspace IDs.
workspaceRouter.use(workspaceInvitationsRouter);
workspaceRouter.use(workspaceMembersRouter);
const workspaceInput = z
  .object({ name: z.string().trim().min(1).max(100) })
  .strict();

workspaceRouter.get(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const { limit, after, q } = parse(directoryQuery, req.query);
    const result = await prisma.$transaction(
      async (tx) => {
        const scope: Prisma.WorkspaceMemberWhereInput = {
          userId: req.auth!.userId,
          ...(q
            ? { workspace: { name: { contains: q, mode: "insensitive" } } }
            : {}),
        };
        const cursor = after
          ? await tx.workspaceMember.findFirst({
              where: { AND: [scope, { workspaceId: after }] },
              select: { workspaceId: true, createdAt: true },
            })
          : null;
        if (after && !cursor)
          throw new HttpError(400, "Invalid workspace cursor");
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
                          workspaceId: { gt: cursor.workspaceId },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
          include: { workspace: { select: { id: true, name: true } } },
          orderBy: [{ createdAt: "asc" }, { workspaceId: "asc" }],
          take: limit + 1,
        });
        const page = directoryPage(
          rows,
          limit,
          await tx.workspaceMember.count({ where: scope }),
          (row) => row.workspaceId,
        );
        return {
          ...page,
          data: page.data.map((row) => ({ ...row.workspace, role: row.role })),
          currentWorkspaceId: req.auth!.workspaceId || null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json(result);
  }),
);

workspaceRouter.post(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const { name } = parse(workspaceInput, req.body);
    const workspace = await prisma.$transaction(async (tx) => {
      const created = await tx.workspace.create({
        data: {
          name,
          members: { create: { userId: req.auth!.userId, role: "owner" } },
        },
        select: { id: true, name: true },
      });
      await tx.channel.create({
        data: {
          workspaceId: created.id,
          name: "general",
          createdById: req.auth!.userId,
          members: { create: { userId: req.auth!.userId } },
        },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: created.id,
          actorId: req.auth!.userId,
          action: "workspace.create",
          targetId: created.id,
        },
      });
      return created;
    });
    res.status(201).json({ data: { ...workspace, role: "owner" } });
  }),
);

workspaceRouter.get(
  "/audit",
  asyncRoute(async (req: AuthRequest, res) => {
    const { limit, before } = parse(
      z
        .object({
          limit: z.coerce.number().int().min(1).max(100).default(50),
          before: identifier.optional(),
        })
        .strict(),
      req.query,
    );
    const result = await prisma.$transaction(
      async (tx) => {
        const actor = await workspaceActor(tx, req, req.auth!.workspaceId!);
        if (!isAdministratorRole(actor.role))
          throw new HttpError(
            403,
            "Workspace administrator permission required",
          );
        const cursor = before
          ? await tx.auditEvent.findFirst({
              where: { id: before, workspaceId: actor.workspaceId },
              select: { id: true, createdAt: true },
            })
          : null;
        if (before && !cursor) throw new HttpError(400, "Invalid audit cursor");
        const rows = await tx.auditEvent.findMany({
          where: {
            workspaceId: actor.workspaceId,
            ...(cursor
              ? {
                  OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                  ],
                }
              : {}),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: limit + 1,
        });
        const data = rows.slice(0, limit);
        return {
          data,
          hasMore: rows.length > limit,
          nextCursor: rows.length > limit ? data.at(-1)!.id : null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json(result);
  }),
);

workspaceRouter.get(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const id = parse(identifier, req.params.id);
    const row = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId: id, userId: req.auth!.userId },
      },
      include: { workspace: { select: { id: true, name: true } } },
    });
    if (!row) throw new HttpError(404, "Workspace not found");
    res.json({ data: { ...row.workspace, role: row.role } });
  }),
);

workspaceRouter.patch(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const id = parse(identifier, req.params.id);
    const { name } = parse(workspaceInput, req.body);
    const result = await prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, id);
      const actor = await workspaceActor(tx, req, id);
      if (!isAdministratorRole(actor.role))
        throw new HttpError(403, "Workspace administrator permission required");
      const workspace = await tx.workspace.update({
        where: { id },
        data: { name },
        select: { id: true, name: true },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: id,
          actorId: actor.userId,
          action: "workspace.rename",
          targetId: id,
        },
      });
      return { ...workspace, role: actor.role };
    });
    res.json({ data: result });
  }),
);
