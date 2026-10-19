/** Search the authorized server history with query-bound cursors and a database deadline. */
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { AuthRequest } from "./auth.js";
import { accessibleChannel, workspaceActor } from "./access.js";
import { HttpError, parse } from "./http.js";
import { formatMessages, messageInclude } from "./messages.js";
import { prisma } from "./prisma.js";

const searchQuery = z
  .object({
    q: z.string().trim().min(2).max(120),
    channelId: z.string().min(1).max(128).optional(),
    after: z
      .string()
      .min(1)
      .max(2048)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
const cursorSchema = z
  .object({
    workspaceId: z.string().min(1).max(128),
    channelId: z.string().min(1).max(128).nullable(),
    q: z.string().min(2).max(120),
    at: z.string().datetime(),
    id: z.string().min(1).max(128),
  })
  .strict();

export async function searchMessages(req: AuthRequest) {
  const { q: input, channelId, after, limit } = parse(searchQuery, req.query);
  const q = input.replace(/\s+/g, " ").toLowerCase();
  let cursor: z.infer<typeof cursorSchema> | undefined;
  if (after) {
    try {
      cursor = parse(
        cursorSchema,
        JSON.parse(Buffer.from(after, "base64url").toString("utf8")),
      );
    } catch {
      throw new HttpError(400, "Invalid search cursor");
    }
    if (
      cursor.workspaceId !== req.auth!.workspaceId ||
      cursor.channelId !== (channelId || null) ||
      cursor.q !== q
    )
      throw new HttpError(400, "Search cursor does not match this query");
  }
  return prisma.$transaction(
    async (tx) => {
      req.auth!.workspaceRole = (
        await workspaceActor(tx, req, req.auth!.workspaceId!)
      ).role;
      if (channelId) await accessibleChannel(req, channelId, tx);
      await tx.$executeRaw`SET LOCAL statement_timeout = '2500ms'`;
      // Authorization is part of the SQL itself, before sorting or pagination.
      // The expression matches the partial GIN index in the reviewed migration.
      const rows = await tx.$queryRaw<
        { id: string; createdAt: Date }[]
      >(Prisma.sql`
      SELECT m."id", m."createdAt" FROM "Message" m
      INNER JOIN "Channel" c ON c."id" = m."channelId"
      WHERE c."workspaceId" = ${req.auth!.workspaceId!} AND m."deletedAt" IS NULL
        AND EXISTS (SELECT 1 FROM "WorkspaceMember" wm WHERE wm."workspaceId" = c."workspaceId" AND wm."userId" = ${req.auth!.userId})
        AND (c."isPrivate" = false OR EXISTS (SELECT 1 FROM "ChannelMember" cm WHERE cm."channelId" = c."id" AND cm."userId" = ${req.auth!.userId}))
        AND to_tsvector('simple', m."content" || ' ' || COALESCE(m."codeSnippet"->>'code', '')) @@ plainto_tsquery('simple', ${q})
        ${channelId ? Prisma.sql`AND c."id" = ${channelId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND (m."createdAt", m."id") < (${new Date(cursor.at)}, ${cursor.id})` : Prisma.empty}
      ORDER BY m."createdAt" DESC, m."id" DESC LIMIT ${limit + 1}
    `);
      const page = rows.slice(0, limit);
      const records = page.length
        ? await tx.message.findMany({
            where: { id: { in: page.map((row) => row.id) } },
            include: {
              ...messageInclude,
              channel: { select: { id: true, name: true } },
            },
          })
        : [];
      const byId = new Map(records.map((row) => [row.id, row]));
      const ordered = page.map((row) => byId.get(row.id)!);
      const messages = await formatMessages(ordered, req, tx);
      const last = page.at(-1);
      const nextCursor =
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({
                workspaceId: req.auth!.workspaceId,
                channelId: channelId || null,
                q,
                at: last.createdAt.toISOString(),
                id: last.id,
              }),
            ).toString("base64url")
          : null;
      return {
        data: messages.map((message, index) => ({
          message,
          channel: ordered[index].channel,
        })),
        hasMore: rows.length > limit,
        nextCursor,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
