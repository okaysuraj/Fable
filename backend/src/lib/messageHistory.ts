import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma.js";
import { AuthRequest } from "./auth.js";
import { HttpError, parse } from "./http.js";
import { accessibleChannel, workspaceActor } from "./access.js";
import { formatMessages, messageInclude } from "./messages.js";

/** Read history and pins against one snapshot and its durable synchronization checkpoint. */
const pageSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.string().min(1).max(128).optional(),
    after: z.string().min(1).max(128).optional(),
    around: z.string().min(1).max(128).optional(),
  })
  .strict()
  .refine(
    (input) =>
      [input.before, input.after, input.around].filter(Boolean).length <= 1,
    "Use only one message cursor direction",
  );

export async function messagePage(
  req: AuthRequest,
  channelId: string,
  pinned = false,
) {
  const { limit, before, after, around } = parse(pageSchema, req.query);
  if (pinned && around)
    throw new HttpError(
      400,
      "Around cursors are only supported for message history",
    );
  return prisma.$transaction(
    async (tx) => {
      await accessibleChannel(req, channelId, tx);
      req.auth!.workspaceRole = (
        await workspaceActor(tx, req, req.auth!.workspaceId!)
      ).role;
      // Capture BEFORE reading rows: later commits will be replayed by the changes feed.
      const checkpoint = await tx.messageChange.aggregate({
        where: { channelId },
        _max: { sequence: true },
      });
      // Cursor lookup includes tombstones and unpinned rows so removing a pin does not
      // strand a reader on a previous archive page.
      const cursorId = before || after || around;
      const cursor = cursorId
        ? await tx.message.findFirst({
            where: { id: cursorId, channelId },
            select: { createdAt: true, id: true },
          })
        : undefined;
      if (cursorId && !cursor)
        throw new HttpError(
          around ? 404 : 400,
          around ? "Message not found" : "Invalid message cursor",
        );
      const scope: Prisma.MessageWhereInput = {
        channelId,
        ...(pinned ? { isPinned: true, deletedAt: null } : {}),
      };
      const lower = (edge: {
        createdAt: Date;
        id: string;
      }): Prisma.MessageWhereInput => ({
        OR: [
          { createdAt: { lt: edge.createdAt } },
          { createdAt: edge.createdAt, id: { lt: edge.id } },
        ],
      });
      const higher = (edge: {
        createdAt: Date;
        id: string;
      }): Prisma.MessageWhereInput => ({
        OR: [
          { createdAt: { gt: edge.createdAt } },
          { createdAt: edge.createdAt, id: { gt: edge.id } },
        ],
      });
      let page;
      let hasMore = false;
      if (around && cursor) {
        const olderLimit = Math.floor((limit - 1) / 2);
        const newerLimit = limit - 1 - olderLimit;
        const older = olderLimit
          ? await tx.message.findMany({
              where: { AND: [scope, lower(cursor)] },
              include: messageInclude,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: olderLimit,
            })
          : [];
        const center = await tx.message.findUniqueOrThrow({
          where: { id: cursor.id },
          include: messageInclude,
        });
        const newer = newerLimit
          ? await tx.message.findMany({
              where: { AND: [scope, higher(cursor)] },
              include: messageInclude,
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              take: newerLimit,
            })
          : [];
        page = [...older.reverse(), center, ...newer];
      } else {
        const rows = await tx.message.findMany({
          where: {
            AND: [
              scope,
              ...(cursor ? [after ? higher(cursor) : lower(cursor)] : []),
            ],
          },
          include: messageInclude,
          orderBy: [
            { createdAt: after ? "asc" : "desc" },
            { id: after ? "asc" : "desc" },
          ],
          take: limit + 1,
        });
        hasMore = rows.length > limit;
        page = rows.slice(0, limit);
        if (!after) page.reverse();
      }
      const oldest = page[0] || cursor;
      const newest = page.at(-1) || cursor;
      const hasOlder =
        !!oldest &&
        !!(await tx.message.findFirst({
          where: { AND: [scope, lower(oldest)] },
          select: { id: true },
        }));
      const hasNewer =
        !!newest &&
        !!(await tx.message.findFirst({
          where: { AND: [scope, higher(newest)] },
          select: { id: true },
        }));
      if (around) hasMore = hasOlder;
      return {
        channelId,
        data: await formatMessages(page, req, tx),
        total: page.length,
        hasMore,
        nextCursor: hasMore ? (after ? page.at(-1)!.id : page[0]!.id) : null,
        hasOlder,
        hasNewer,
        olderCursor: hasOlder ? oldest!.id : null,
        newerCursor: hasNewer ? newest!.id : null,
        changeCursor: (checkpoint._max.sequence || 0n).toString(),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
