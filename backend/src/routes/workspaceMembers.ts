import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { asyncRoute, HttpError, parse, identifier } from "../lib/http.js";
import { lockWorkspace, workspaceActor } from "../lib/access.js";
import { removeWorkspaceMember } from "../lib/workspaceMembership.js";

/** Workspace roles, ownership transfer and membership removal. */
export const workspaceMembersRouter = Router();

workspaceMembersRouter.patch(
  "/:id/members/:userId",
  asyncRoute(async (req: AuthRequest, res) => {
    const id = parse(identifier, req.params.id);
    const userId = parse(identifier, req.params.userId);
    const { role } = parse(
      z.object({ role: z.enum(["admin", "member"]) }).strict(),
      req.body,
    );
    const result = await prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, id);
      const actor = await workspaceActor(tx, req, id);
      if (actor.role !== "owner")
        throw new HttpError(403, "Only the workspace owner can change roles");
      const target = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: id, userId } },
      });
      if (!target) throw new HttpError(404, "Workspace member not found");
      if (target.role === "owner")
        throw new HttpError(409, "Transfer ownership to change the owner role");
      const updated = await tx.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId: id, userId } },
        data: { role },
        select: { userId: true, workspaceId: true, role: true },
      });
      if (target.role !== role)
        await tx.auditEvent.create({
          data: {
            workspaceId: id,
            actorId: actor.userId,
            action: "workspace.member.role",
            targetId: userId,
            metadata: { previousRole: target.role, role },
          },
        });
      return updated;
    });
    res.json({ data: result });
  }),
);

workspaceMembersRouter.post(
  "/:id/transfer-ownership",
  asyncRoute(async (req: AuthRequest, res) => {
    const id = parse(identifier, req.params.id);
    const { userId } = parse(
      z.object({ userId: identifier }).strict(),
      req.body,
    );
    const result = await prisma.$transaction(async (tx) => {
      await lockWorkspace(tx, id);
      const actor = await workspaceActor(tx, req, id);
      if (actor.role !== "owner")
        throw new HttpError(
          403,
          "Only the workspace owner can transfer ownership",
        );
      if (userId === actor.userId)
        throw new HttpError(400, "Choose another workspace member");
      const target = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: id, userId } },
      });
      if (!target) throw new HttpError(404, "Workspace member not found");
      await tx.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId: id, userId } },
        data: { role: "owner" },
      });
      await tx.workspaceMember.update({
        where: {
          workspaceId_userId: { workspaceId: id, userId: actor.userId },
        },
        data: { role: "admin" },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: id,
          actorId: actor.userId,
          action: "workspace.ownership.transfer",
          targetId: userId,
        },
      });
      return tx.workspace.findUniqueOrThrow({
        where: { id },
        select: { id: true, name: true },
      });
    });
    res.json({ data: { ...result, role: "admin" } });
  }),
);

workspaceMembersRouter.delete(
  "/:id/members/:userId",
  asyncRoute(async (req: AuthRequest, res) => {
    await removeWorkspaceMember(
      req,
      parse(identifier, req.params.id),
      parse(identifier, req.params.userId),
      false,
    );
    res.status(204).end();
  }),
);

workspaceMembersRouter.post(
  "/:id/leave",
  asyncRoute(async (req: AuthRequest, res) => {
    parse(z.object({}).strict(), req.body ?? {});
    await removeWorkspaceMember(
      req,
      parse(identifier, req.params.id),
      req.auth!.userId,
      true,
    );
    res.status(204).end();
  }),
);
