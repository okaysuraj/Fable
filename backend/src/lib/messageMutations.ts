import { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { AuthRequest } from "./auth.js";
import { HttpError } from "./http.js";
import { channelScope, lockChannel } from "./access.js";
import { formatMessages, messageInclude } from "./messages.js";
import { emitChannel, lockEventOrder } from "./events.js";

type CodeSnippet = { language: string; code: string };
type MessageMutation =
  | {
      type: "edit";
      expectedVersion: number;
      content: string;
      codeSnippet?: CodeSnippet | null;
    }
  | { type: "delete"; expectedVersion: number }
  | { type: "pin"; expectedVersion: number; isPinned: boolean }
  | { type: "react"; icon: string };

/** Recheck access under the room lock and commit each mutation with its durable change. */
export async function mutateMessage(req: AuthRequest, input: MessageMutation) {
  const operation = input.type;
  const target = await prisma.message.findFirst({
    where: { id: req.params.id, channel: channelScope(req) },
    select: { channelId: true },
  });
  if (!target) throw new HttpError(404, "Message not found");
  return prisma.$transaction(async (tx) => {
    await lockEventOrder(tx);
    await lockChannel(tx, target.channelId);
    const message = await tx.message.findFirst({
      where: { id: req.params.id, channel: channelScope(req) },
    });
    if (!message) throw new HttpError(404, "Message not found");
    if (message.deletedAt) throw new HttpError(410, "Message was deleted");
    const membership = await tx.workspaceMember.findUniqueOrThrow({
      where: {
        workspaceId_userId: {
          workspaceId: req.auth!.workspaceId!,
          userId: req.auth!.userId,
        },
      },
    });
    req.auth!.workspaceRole = membership.role;
    const admin = ["owner", "admin"].includes(membership.role);
    if (operation === "edit" && message.senderId !== req.auth!.userId)
      throw new HttpError(403, "Only the author can edit this message");
    if (
      operation === "delete" &&
      message.senderId !== req.auth!.userId &&
      !admin
    )
      throw new HttpError(
        403,
        "Only the author or workspace administrator can delete this message",
      );
    if ("expectedVersion" in input && input.expectedVersion !== message.version)
      throw new HttpError(409, "Message changed; refresh before trying again");
    const codeUnchanged =
      input.type !== "edit" ||
      input.codeSnippet === undefined ||
      (input.codeSnippet === null && message.codeSnippet === null) ||
      (input.codeSnippet != null &&
        typeof message.codeSnippet === "object" &&
        message.codeSnippet !== null &&
        !Array.isArray(message.codeSnippet) &&
        message.codeSnippet.language === input.codeSnippet.language &&
        message.codeSnippet.code === input.codeSnippet.code);
    if (
      (operation === "pin" && input.isPinned === message.isPinned) ||
      (operation === "edit" &&
        input.content === message.content &&
        codeUnchanged)
    ) {
      const unchanged = await tx.message.findUniqueOrThrow({
        where: { id: message.id },
        include: messageInclude,
      });
      return (await formatMessages([unchanged], req, tx))[0];
    }
    let data: Prisma.MessageUpdateInput = { version: { increment: 1 } };
    if (operation === "edit") {
      const code =
        input.codeSnippet === undefined
          ? message.codeSnippet
          : input.codeSnippet;
      if (
        !input.content &&
        !code &&
        !(await tx.mediaAsset.count({ where: { messageId: message.id } }))
      )
        throw new HttpError(400, "Message content is required");
      data = {
        ...data,
        content: input.content,
        editedAt: new Date(),
        ...(input.codeSnippet === undefined
          ? {}
          : {
              codeSnippet:
                input.codeSnippet === null ? Prisma.DbNull : input.codeSnippet,
            }),
      };
    }
    if (operation === "delete") {
      await tx.mediaAsset.deleteMany({ where: { messageId: message.id } });
      await tx.reaction.deleteMany({ where: { messageId: message.id } });
      data = {
        ...data,
        content: "",
        codeSnippet: Prisma.DbNull,
        voiceNote: Prisma.DbNull,
        attachments: Prisma.DbNull,
        isPinned: false,
        deletedAt: new Date(),
      };
    }
    if (operation === "pin") data.isPinned = input.isPinned;
    if (operation === "react") {
      const key = {
        messageId: message.id,
        userId: req.auth!.userId,
        icon: input.icon,
      };
      const existing = await tx.reaction.findUnique({
        where: { messageId_userId_icon: key },
      });
      if (existing) await tx.reaction.delete({ where: { id: existing.id } });
      else await tx.reaction.create({ data: key });
    }
    const updated = await tx.message.update({
      where: { id: message.id },
      data,
      include: messageInclude,
    });
    await tx.messageChange.create({
      data: { channelId: message.channelId, messageId: message.id },
    });
    await emitChannel(tx, message.channelId, {
      type: "message.updated",
      targetId: message.id,
    });
    return (await formatMessages([updated], req, tx))[0];
  });
}
