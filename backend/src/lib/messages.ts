/** Project database messages into public DTOs and aggregate only the visible reaction counts. */
import { Prisma } from "@prisma/client";
import { AuthRequest } from "./auth.js";
import { formatUser, isWorkspaceAdmin, publicUserSelect } from "./access.js";
import { prisma } from "./prisma.js";

export const reactionIcons = [
  "sparkle",
  "heart",
  "check",
  "thumbs-up",
  "laugh",
  "eyes",
  "👎",
  "😂",
  "‼️",
  "❓",
  "❤️",
  "👍",
  "🎉",
  "😮",
  "😢",
  "🔥",
  "🙏",
  "😍",
] as const;
export const messageInclude = {
  sender: { select: publicUserSelect },
  assets: { select: { id: true, name: true, mimeType: true, size: true } },
} as const;
export type MessageWithRelations = Prisma.MessageGetPayload<{
  include: typeof messageInclude;
}>;
type ReactionSummary = { icon: string; count: number; reactedByMe: boolean };
export function formatMessage(
  message: MessageWithRelations,
  req: AuthRequest,
  reactions: ReactionSummary[] = [],
) {
  const active = !message.deletedAt;
  return {
    id: message.id,
    channelId: message.channelId,
    sender: formatUser(message.sender),
    timestamp: message.createdAt.toISOString(),
    createdAt: message.createdAt.toISOString(),
    content: active ? message.content : "",
    replyToId: active ? message.replyToId : null,
    codeSnippet: active ? message.codeSnippet : null,
    voiceNote: null,
    attachments: active ? message.assets : [],
    isPinned: active && message.isPinned,
    reactions: active ? reactions : [],
    version: message.version,
    updatedAt: message.updatedAt.toISOString(),
    editedAt: message.editedAt?.toISOString() || null,
    deletedAt: message.deletedAt?.toISOString() || null,
    canEdit: active && message.senderId === req.auth!.userId,
    canDelete:
      active &&
      (message.senderId === req.auth!.userId || isWorkspaceAdmin(req)),
    canPin: active,
  };
}

// Only selected, already-authorized message IDs enter this query. PostgreSQL reduces
// participants to the supported emoji rows per message; Node never loads individual reactions.
// Mutation callers pass their transaction so counts and the returned version agree.
export async function formatMessages(
  messages: MessageWithRelations[],
  req: AuthRequest,
  db: Prisma.TransactionClient = prisma,
) {
  const ids = messages
    .filter((message) => !message.deletedAt)
    .map((message) => message.id);
  const summaries = ids.length
    ? await db.$queryRaw<
        (ReactionSummary & { messageId: string })[]
      >(Prisma.sql`
    SELECT r."messageId", r."icon", count(*)::int AS "count",
      bool_or(r."userId" = ${req.auth!.userId}) AS "reactedByMe"
    FROM "Reaction" r
    WHERE r."messageId" IN (${Prisma.join(ids)}) AND r."icon" IN (${Prisma.join(reactionIcons)})
    GROUP BY r."messageId", r."icon" ORDER BY r."messageId", r."icon"
  `)
    : [];
  const byMessage = new Map<string, ReactionSummary[]>();
  for (const { messageId, ...reaction } of summaries) {
    const group = byMessage.get(messageId) || [];
    group.push(reaction);
    byMessage.set(messageId, group);
  }
  return messages.map((message) =>
    formatMessage(message, req, byMessage.get(message.id)),
  );
}
