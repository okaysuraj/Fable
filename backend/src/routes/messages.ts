/** Validate message HTTP inputs and delegate consistent reads and transactional mutations. */
import { Router } from "express";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { asyncRoute, HttpError, parse } from "../lib/http.js";
import {
  accessibleChannel,
  channelScope,
  lockChannel,
  workspaceActor,
} from "../lib/access.js";
import {
  formatMessage,
  formatMessages,
  messageInclude,
  reactionIcons,
} from "../lib/messages.js";
import { messagePage } from "../lib/messageHistory.js";
import { mutateMessage } from "../lib/messageMutations.js";
import { searchMessages } from "../lib/search.js";

export const messagesRouter = Router();
const codeSchema = z
  .object({
    language: z.string().min(1).max(40),
    code: z.string().min(1).max(20000),
  })
  .strict();
const versionSchema = z.number().int().min(1).max(2147483647);
messagesRouter.get(
  "/search",
  asyncRoute(async (req: AuthRequest, res) => {
    res.json(await searchMessages(req));
  }),
);
messagesRouter.get(
  "/:channelId/changes",
  asyncRoute(async (req: AuthRequest, res) => {
    const { after, limit } = parse(
      z
        .object({
          after: z
            .string()
            .refine(
              (value) =>
                /^\d{1,19}$/.test(value) &&
                BigInt(value) <= 9223372036854775807n,
              "Invalid change cursor",
            )
            .default("0"),
          limit: z.coerce.number().int().min(1).max(100).default(100),
        })
        .strict(),
      req.query,
    );
    const result = await prisma.$transaction(
      async (tx) => {
        await accessibleChannel(req, req.params.channelId, tx);
        req.auth!.workspaceRole = (
          await workspaceActor(tx, req, req.auth!.workspaceId!)
        ).role;
        const checkpoint = await tx.messageChange.aggregate({
          where: { channelId: req.params.channelId },
          _max: { sequence: true },
        });
        if (BigInt(after) > (checkpoint._max.sequence || 0n))
          throw new HttpError(
            409,
            "Change cursor is invalid for this channel; reload history",
          );
        const rows = await tx.messageChange.findMany({
          where: {
            channelId: req.params.channelId,
            sequence: { gt: BigInt(after) },
          },
          orderBy: { sequence: "asc" },
          take: limit + 1,
          select: { sequence: true, messageId: true },
        });
        const page = rows.slice(0, limit);
        const ids = [...new Set(page.map((row) => row.messageId))];
        const messages = ids.length
          ? await tx.message.findMany({
              where: { channelId: req.params.channelId, id: { in: ids } },
              include: messageInclude,
            })
          : [];
        const byId = new Map(messages.map((message) => [message.id, message]));
        return {
          channelId: req.params.channelId,
          data: await formatMessages(
            ids.map((id) => byId.get(id)!),
            req,
            tx,
          ),
          changeCursor: (page.at(-1)?.sequence || BigInt(after)).toString(),
          hasMore: rows.length > limit,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json(result);
  }),
);
messagesRouter.get(
  "/:channelId",
  asyncRoute(async (req: AuthRequest, res) => {
    res.json(await messagePage(req, req.params.channelId));
  }),
);
messagesRouter.get(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const data = await prisma.$transaction(
      async (tx) => {
        req.auth!.workspaceRole = (
          await workspaceActor(tx, req, req.auth!.workspaceId!)
        ).role;
        const channels = await tx.channel.findMany({
          where: channelScope(req),
          select: {
            id: true,
            messages: {
              include: messageInclude,
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 50,
            },
          },
          take: 20,
        });
        const formatted = await formatMessages(
          channels.flatMap((channel) => channel.messages),
          req,
          tx,
        );
        const byId = new Map(formatted.map((message) => [message.id, message]));
        return Object.fromEntries(
          channels.map((channel) => [
            channel.id,
            channel.messages.reverse().map((message) => byId.get(message.id)!),
          ]),
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    res.json({ data, bounded: true });
  }),
);
const createSchema = z
  .object({
    channelId: z.string().min(1).max(128),
    content: z.string().trim().max(10000).default(""),
    codeSnippet: codeSchema.optional(),
    clientMutationId: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    voiceNote: z.unknown().optional(),
    attachments: z.unknown().optional(),
  })
  .strict();
messagesRouter.post(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(createSchema, req.body);
    if (input.voiceNote != null || input.attachments != null)
      throw new HttpError(
        501,
        "Media storage and recording are not configured",
      );
    if (!input.content && !input.codeSnippet)
      throw new HttpError(400, "Message content is required");
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          content: input.content,
          codeSnippet: input.codeSnippet || null,
        }),
      )
      .digest("hex");
    const result = await prisma.$transaction(async (tx) => {
      await lockChannel(tx, input.channelId);
      const channel = await tx.channel.findFirst({
        where: { id: input.channelId, ...channelScope(req) },
      });
      if (!channel) throw new HttpError(404, "Channel not found");
      req.auth!.workspaceRole = (
        await workspaceActor(tx, req, channel.workspaceId)
      ).role;
      if (channel.type !== "text")
        throw new HttpError(400, "Messages require a text channel");
      if (input.clientMutationId) {
        const existing = await tx.message.findUnique({
          where: {
            channelId_senderId_clientMutationId: {
              channelId: input.channelId,
              senderId: req.auth!.userId,
              clientMutationId: input.clientMutationId,
            },
          },
          include: messageInclude,
        });
        if (existing) {
          if (existing.clientMutationHash !== fingerprint)
            throw new HttpError(
              409,
              "This message request key was already used with different content",
            );
          return {
            data: (await formatMessages([existing], req, tx))[0],
            created: false,
          };
        }
      }
      const message = await tx.message.create({
        data: {
          channelId: input.channelId,
          senderId: req.auth!.userId,
          content: input.content,
          ...(input.codeSnippet ? { codeSnippet: input.codeSnippet } : {}),
          ...(input.clientMutationId
            ? {
                clientMutationId: input.clientMutationId,
                clientMutationHash: fingerprint,
              }
            : {}),
        },
        include: messageInclude,
      });
      await tx.messageChange.create({
        data: { channelId: message.channelId, messageId: message.id },
      });
      return { data: formatMessage(message, req), created: true };
    });
    res.status(result.created ? 201 : 200).json({ data: result.data });
  }),
);

messagesRouter.patch(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z
        .object({
          content: z.string().trim().max(10000),
          expectedVersion: versionSchema,
          codeSnippet: codeSchema.nullable().optional(),
        })
        .strict(),
      req.body,
    );
    res.json({ data: await mutateMessage(req, { type: "edit", ...input }) });
  }),
);
messagesRouter.delete(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z.object({ expectedVersion: versionSchema }).strict(),
      req.body,
    );
    res.json({ data: await mutateMessage(req, { type: "delete", ...input }) });
  }),
);
messagesRouter.put(
  "/:id/pin",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z
        .object({ isPinned: z.boolean(), expectedVersion: versionSchema })
        .strict(),
      req.body,
    );
    res.json({ data: await mutateMessage(req, { type: "pin", ...input }) });
  }),
);
messagesRouter.post(
  "/:id/reactions",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z.object({ icon: z.enum(reactionIcons) }).strict(),
      req.body,
    );
    res.json({ data: await mutateMessage(req, { type: "react", ...input }) });
  }),
);
