import { prisma, sqlTable } from "./prisma.js";
import { AuthRequest } from "./auth.js";
import { HttpError } from "./http.js";
import {
  lockWorkspace,
  workspaceActor,
  isAdministratorRole,
} from "./access.js";

/** Revocation and voluntary departure have different ownership/privacy safeguards. */
export async function removeWorkspaceMember(
  req: AuthRequest,
  id: string,
  userId: string,
  leaving: boolean,
) {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '10000ms'`;
      // Serialize removals across different workspaces for the same person before
      // taking the workspace lock; otherwise two simultaneous leaves can strand them.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('membership-user'), hashtext(${userId}))`;
      await lockWorkspace(tx, id);
      const actor = await workspaceActor(tx, req, id);
      const target = await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: id, userId } },
      });
      if (!target) throw new HttpError(404, "Workspace member not found");
      if (!leaving && userId === actor.userId)
        throw new HttpError(
          400,
          "Use Leave workspace to remove your own membership",
        );
      if (
        !leaving &&
        (!isAdministratorRole(actor.role) ||
          (actor.role === "admin" && target.role !== "member"))
      )
        throw new HttpError(403, "You cannot remove this workspace member");
      if (target.role === "owner")
        throw new HttpError(
          409,
          "Transfer workspace ownership before leaving or removing the owner",
        );
      if (
        leaving &&
        (await tx.workspaceMember.count({ where: { userId } })) <= 1
      )
        throw new HttpError(
          409,
          "Create or join another workspace before leaving your last workspace",
        );
      if (
        leaving &&
        (await tx.channel.findFirst({
          where: { workspaceId: id, createdById: userId },
          select: { id: true },
        }))
      )
        throw new HttpError(
          409,
          "Transfer ownership of your channels before leaving this workspace",
        );
      if (!leaving) {
        // An administrator must be able to revoke membership even when the person
        // owns private rooms. Reassign only to a remaining actual room participant;
        // an empty private room stays private and retains its content with no creator.
        // SQL returns aggregate counts, never an unbounded array or private names.
        const [privateOwnership] = await tx.$queryRaw<
          { reassigned: number; detached: number }[]
        >`
        WITH changed AS (
          UPDATE ${sqlTable("Channel")} c SET "createdById" = (
            SELECT cm."userId" FROM ${sqlTable("ChannelMember")} cm
            INNER JOIN ${sqlTable("WorkspaceMember")} wm ON wm."userId" = cm."userId" AND wm."workspaceId" = c."workspaceId"
            WHERE cm."channelId" = c."id" AND cm."userId" <> ${userId}
            ORDER BY cm."createdAt" ASC, cm."userId" ASC LIMIT 1
          ), "updatedAt" = CURRENT_TIMESTAMP
          WHERE c."workspaceId" = ${id} AND c."createdById" = ${userId} AND c."isPrivate" = true
          RETURNING c."createdById"
        ) SELECT count(*) FILTER (WHERE "createdById" IS NOT NULL)::int AS "reassigned",
          count(*) FILTER (WHERE "createdById" IS NULL)::int AS "detached" FROM changed
      `;
        const publicDetached = await tx.channel.updateMany({
          where: { workspaceId: id, createdById: userId, isPrivate: false },
          data: { createdById: null },
        });
        if (
          privateOwnership.reassigned ||
          privateOwnership.detached ||
          publicDetached.count
        ) {
          await tx.auditEvent.create({
            data: {
              workspaceId: id,
              actorId: actor.userId,
              action: "workspace.member.channel-ownership.reconcile",
              targetId: userId,
              metadata: {
                privateReassigned: privateOwnership.reassigned,
                privateDetached: privateOwnership.detached,
                publicDetached: publicDetached.count,
              },
            },
          });
        }
      }
      await tx.channelMember.deleteMany({
        where: { userId, channel: { workspaceId: id } },
      });
      await tx.workspaceMember.delete({
        where: { workspaceId_userId: { workspaceId: id, userId } },
      });
      await tx.auditEvent.create({
        data: {
          workspaceId: id,
          actorId: actor.userId,
          action: leaving
            ? "workspace.member.leave"
            : "workspace.member.remove",
          targetId: userId,
        },
      });
    },
    { timeout: 15000, maxWait: 5000 },
  );
}
