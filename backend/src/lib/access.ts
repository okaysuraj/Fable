import { Prisma } from "@prisma/client";
import { AuthRequest } from "./auth.js";
import { HttpError } from "./http.js";
import { prisma } from "./prisma.js";

export function channelScope(req: AuthRequest): Prisma.ChannelWhereInput {
  const userId = req.auth!.userId;
  return {
    workspaceId: req.auth!.workspaceId,
    workspace: { members: { some: { userId } } },
    OR: [{ isPrivate: false }, { members: { some: { userId } } }],
  };
}

export function isWorkspaceAdmin(req: AuthRequest) {
  return ["owner", "admin"].includes(req.auth!.workspaceRole!);
}
export function canManageChannel(
  channel: { createdById: string | null },
  req: AuthRequest,
) {
  return isWorkspaceAdmin(req) || channel.createdById === req.auth!.userId;
}

// Every channel write first takes a shared workspace lock. Membership/role
// mutations take the exclusive form, so access cannot be revoked mid-write.
// Always acquire workspace before channel to keep lock ordering consistent.
export async function lockWorkspace(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  shared = false,
) {
  if (shared)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext('workspace'), hashtext(${workspaceId}))`;
  else
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('workspace'), hashtext(${workspaceId}))`;
}

export async function lockChannel(
  tx: Prisma.TransactionClient,
  channelId: string,
) {
  const channel = await tx.channel.findUnique({
    where: { id: channelId },
    select: { workspaceId: true },
  });
  if (channel) await lockWorkspace(tx, channel.workspaceId, true);
  // Preserve the existing channel key so old/new deployments still serialize
  // message-change sequence allocation while the new workspace gate rolls out.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`channel:${channelId}`}))`;
}

export async function workspaceActor(
  tx: Prisma.TransactionClient,
  req: AuthRequest,
  workspaceId: string,
) {
  if (workspaceId !== req.auth!.workspaceId)
    throw new HttpError(404, "Workspace not found");
  const membership = await tx.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: req.auth!.userId } },
  });
  if (!membership) throw new HttpError(404, "Workspace not found");
  return membership;
}

export async function accessibleChannel(
  req: AuthRequest,
  id: string,
  db: Prisma.TransactionClient = prisma,
) {
  const channel = await db.channel.findFirst({
    where: { id, ...channelScope(req) },
  });
  if (!channel) throw new HttpError(404, "Channel not found");
  return channel;
}

export const publicUserSelect = {
  id: true,
  name: true,
  handle: true,
  monogram: true,
  role: true,
  status: true,
  statusText: true,
  avatarColor: true,
  photoVersion: true,
  photoMimeType: true,
  lastSeenAt: true,
} as const;

export function formatUser(user: {
  id: string;
  name: string;
  handle: string;
  monogram: string;
  role: string;
  status: string;
  statusText: string | null;
  avatarColor: string | null;
  lastSeenAt: Date | null;
  photoVersion?: number;
  photoMimeType?: string | null;
}) {
  const { lastSeenAt, photoMimeType, ...profile } = user;
  return {
    ...profile,
    ...(photoMimeType !== undefined
      ? { photoVersion: photoMimeType ? user.photoVersion : 0 }
      : {}),
    status:
      lastSeenAt && Date.now() - lastSeenAt.getTime() < 120000
        ? "online"
        : "offline",
  };
}

export function isAdministratorRole(role: string): boolean {
  return role === "owner" || role === "admin";
}
