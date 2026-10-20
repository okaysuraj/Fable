/** Address-book matching accepts numbers only; it never stores the uploaded address book. */
import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import type { AuthRequest } from "../lib/auth.js";
import { asyncRoute, HttpError, parse } from "../lib/http.js";
import { lockWorkspace, publicUserSelect, formatUser } from "../lib/access.js";
import { createAuthenticatedLimiter } from "../lib/rateLimits.js";
import { channelSelect, formatChannels } from "./channels.js";

export const contactsRouter = Router();
contactsRouter.post("/match", createAuthenticatedLimiter({ limit: 12 }), asyncRoute(async (req: AuthRequest, res) => {
  const { numbers } = parse(z.object({ numbers: z.array(z.string().regex(/^\+[1-9]\d{6,14}$/)).max(500) }).strict(), req.body);
  if (!numbers.length) { res.json({ data: [] }); return; }
  const matches = await prisma.user.findMany({ where: { id: { not: req.auth!.userId }, phoneNumber: { in: [...new Set(numbers)] }, account: { isNot: null } }, select: { ...publicUserSelect, phoneNumber: true }, take: 501 });
  // A self-entered number is not proof of identity. Ambiguous numbers never match a contact.
  const counts = new Map<string, number>();
  for (const user of matches) if (user.phoneNumber) counts.set(user.phoneNumber, (counts.get(user.phoneNumber) ?? 0) + 1);
  res.json({ data: matches.filter((user) => user.phoneNumber && counts.get(user.phoneNumber) === 1).map(formatUser) });
}));

contactsRouter.post("/direct", createAuthenticatedLimiter({ limit: 20 }), asyncRoute(async (req: AuthRequest, res) => {
  const { userId } = parse(z.object({ userId: z.string().min(1).max(128) }).strict(), req.body);
  if (userId === req.auth!.userId) throw new HttpError(400, "Choose another person");
  const key = createHash("sha256").update(JSON.stringify(["contacts", ...[req.auth!.userId, userId].sort()])).digest("hex");
  const workspaceId = "pair_space_" + key;
  const data = await prisma.$transaction(async (tx) => {
    await lockWorkspace(tx, workspaceId);
    const target = await tx.user.findFirst({ where: { id: userId, account: { isNot: null } }, select: { id: true } });
    if (!target) throw new HttpError(404, "This contact is unavailable");
    await tx.workspace.upsert({ where: { id: workspaceId }, update: {}, create: { id: workspaceId, name: "Direct conversation", members: { create: [req.auth!.userId, userId].map((id) => ({ userId: id, role: "member" })) } } });
    await tx.workspaceMember.createMany({ data: [req.auth!.userId, userId].map((id) => ({ workspaceId, userId: id, role: "member" })), skipDuplicates: true });
    const channel = await tx.channel.upsert({ where: { directKey: key }, update: {}, create: { workspaceId, name: "dm-" + key, directKey: key, isPrivate: true, members: { create: [req.auth!.userId, userId].map((id) => ({ userId: id })) } }, select: channelSelect });
    return (await formatChannels([channel], req, tx))[0];
  });
  res.json({ data });
}));
