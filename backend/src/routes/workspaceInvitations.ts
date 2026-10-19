import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { asyncRoute, HttpError, parse, identifier } from "../lib/http.js";
import {
  lockWorkspace,
  workspaceActor,
  isAdministratorRole,
} from "../lib/access.js";
import { createHash, randomBytes } from "node:crypto";
import { directoryPage, directoryQuery } from "../lib/directory.js";

/** Email-bound invitations. Secrets are disclosed once and stored only as hashes. */
export const workspaceInvitationsRouter = Router();

workspaceInvitationsRouter.get(
  "/invitations",
  asyncRoute(async (req: AuthRequest, res) => {
    const { limit, after, q } = parse(directoryQuery, req.query);
    const result = await prisma.$transaction(
      async (tx) => {
        const actor = await workspaceActor(tx, req, req.auth!.workspaceId!);
        if (!isAdministratorRole(actor.role))
          throw new HttpError(
            403,
            "Workspace administrator permission required",
          );
        const scope: Prisma.InvitationWhereInput = {
          workspaceId: actor.workspaceId,
          ...(q ? { email: { contains: q, mode: "insensitive" } } : {}),
        };
        const cursor = after
          ? await tx.invitation.findFirst({
              where: { AND: [scope, { id: after }] },
              select: { id: true, createdAt: true },
            })
          : null;
        if (after && !cursor)
          throw new HttpError(400, "Invalid invitation cursor");
        const rows = await tx.invitation.findMany({
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
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: limit + 1,
          select: {
            id: true,
            email: true,
            expiresAt: true,
            acceptedAt: true,
            createdAt: true,
          },
        });
        const page = directoryPage(
          rows,
          limit,
          await tx.invitation.count({ where: scope }),
          (row) => row.id,
        );
        const now = Date.now();
        return {
          ...page,
          data: page.data.map((row) => ({
            ...row,
            status: row.acceptedAt
              ? "accepted"
              : row.expiresAt.getTime() <= now
                ? "expired"
                : "pending",
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json(result);
  }),
);

workspaceInvitationsRouter.post(
  "/invitations",
  asyncRoute(async (req: AuthRequest, res) => {
    const { email } = parse(
      z
        .object({ email: z.string().trim().toLowerCase().email().max(254) })
        .strict(),
      req.body,
    );
    const token = randomBytes(32).toString("base64url");
    const invitation = await prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, req.auth!.workspaceId!);
      const actor = await workspaceActor(tx, req, req.auth!.workspaceId!);
      if (!isAdministratorRole(actor.role))
        throw new HttpError(
          403,
          "Only workspace administrators can invite members",
        );
      if (
        await tx.workspaceMember.findFirst({
          where: {
            workspaceId: actor.workspaceId,
            user: { account: { email } },
          },
          select: { userId: true },
        })
      )
        throw new HttpError(409, "This person is already a workspace member");
      if (
        await tx.invitation.findFirst({
          where: {
            workspaceId: actor.workspaceId,
            email,
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        })
      )
        throw new HttpError(
          409,
          "An invitation is already pending; revoke it before creating another",
        );
      const created = await tx.invitation.create({
        data: {
          workspaceId: actor.workspaceId,
          email,
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
        select: { id: true, email: true, expiresAt: true },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: "workspace.invitation.create",
          targetId: created.id,
        },
      });
      return created;
    });
    // The bearer secret is returned only at creation. Listings never expose it.
    res.status(201).json({ data: { ...invitation, token } });
  }),
);

workspaceInvitationsRouter.delete(
  "/invitations/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const id = parse(identifier, req.params.id);
    await prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, req.auth!.workspaceId!);
      const actor = await workspaceActor(tx, req, req.auth!.workspaceId!);
      if (!isAdministratorRole(actor.role))
        throw new HttpError(403, "Workspace administrator permission required");
      const invitation = await tx.invitation.findFirst({
        where: { id, workspaceId: actor.workspaceId },
      });
      if (!invitation) throw new HttpError(404, "Invitation not found");
      if (invitation.acceptedAt)
        throw new HttpError(
          409,
          "Accepted invitations cannot be revoked; manage the member instead",
        );
      await tx.invitation.delete({ where: { id } });
      await tx.auditEvent.create({
        data: {
          workspaceId: actor.workspaceId,
          actorId: actor.userId,
          action: "workspace.invitation.revoke",
          targetId: id,
        },
      });
    });
    res.status(204).end();
  }),
);

workspaceInvitationsRouter.post(
  "/join",
  asyncRoute(async (req: AuthRequest, res) => {
    const { token } = parse(
      z.object({ token: z.string().min(32).max(128) }).strict(),
      req.body,
    );
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const found = await prisma.invitation.findUnique({
      where: { tokenHash },
      select: { workspaceId: true },
    });
    if (!found) throw new HttpError(400, "Invitation is invalid or expired");
    const membership = await prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, found.workspaceId);
      const invite = await tx.invitation.findUnique({ where: { tokenHash } });
      if (
        !invite ||
        invite.email !== req.auth!.email ||
        invite.acceptedAt ||
        invite.expiresAt <= new Date()
      )
        throw new HttpError(400, "Invitation is invalid or expired");
      const claimed = await tx.invitation.updateMany({
        where: {
          id: invite.id,
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new HttpError(409, "Invitation was already accepted");
      const member = await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: req.auth!.userId,
          },
        },
        create: { workspaceId: invite.workspaceId, userId: req.auth!.userId },
        update: {},
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: invite.workspaceId,
          actorId: req.auth!.userId,
          action: "workspace.invitation.accept",
          targetId: invite.id,
        },
      });
      return member;
    });
    res.json({ data: membership });
  }),
);
