/** Verified session provisioning is idempotent; ordinary logout stays client-side. */
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireFirebaseAuth, requireAuth, AuthRequest } from "../lib/auth.js";
import { firebaseAuth } from "../lib/firebase.js";
import { asyncRoute, HttpError, parse } from "../lib/http.js";
import { formatUser, publicUserSelect } from "../lib/access.js";
import { authenticatedLimiter } from "../lib/rateLimits.js";

export const authRouter = Router();
authRouter.post(["/register", "/login"], (_req, res) => {
  res.status(410).json({
    error:
      "Use Firebase email/password authentication and verify your email, then create /api/auth/session",
  });
});

authRouter.post(
  "/session",
  requireFirebaseAuth,
  asyncRoute(async (req: AuthRequest, res) => {
    const identity = req.firebaseUser!;
    const email = identity.email!.trim().toLowerCase();
    let account = await prisma.account.findUnique({
      where: { firebaseUid: identity.uid },
      include: { user: { select: publicUserSelect } },
    });
    if (!account) {
      const name =
        (typeof identity.name === "string"
          ? identity.name.trim()
          : email.split("@")[0]
        ).slice(0, 80) || "Member";
      const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
      const base =
        name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 32) || "member";
      const words = name.split(/\s+/);
      const monogram = (
        words[0].slice(0, 1) +
        (words.length > 1
          ? words[words.length - 1].slice(0, 1)
          : words[0].slice(1, 2))
      ).toUpperCase();
      try {
        account = await prisma.$transaction(async (tx) => {
          // Do not silently link old/local accounts by email; UID is the identity boundary.
          const legacy = await tx.account.findUnique({ where: { email } });
          if (legacy && legacy.firebaseUid !== identity.uid)
            throw new HttpError(
              409,
              "This email has an existing account that requires an administrator to migrate",
            );
          const user = await tx.user.create({
            data: {
              name,
              handle: `@${base}-${suffix}`,
              monogram,
              role: "Member",
              lastSeenAt: new Date(),
            },
          });
          const created = await tx.account.create({
            data: { email, firebaseUid: identity.uid, userId: user.id },
            include: { user: { select: publicUserSelect } },
          });
          const workspace = await tx.workspace.create({
            data: {
              name: `${name}'s workspace`,
              members: { create: { userId: user.id, role: "owner" } },
            },
          });
          await tx.channel.create({
            data: {
              workspaceId: workspace.id,
              name: "general",
              topic: "",
              createdById: user.id,
              members: { create: { userId: user.id } },
            },
          });
          return created;
        });
      } catch (error) {
        // Concurrent verified session creation is idempotent, with all provisioning atomic.
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2002"
        )
          throw error;
        account = await prisma.account.findUnique({
          where: { firebaseUid: identity.uid },
          include: { user: { select: publicUserSelect } },
        });
        if (!account) throw error;
      }
    }
    if (account.email !== email) {
      account = await prisma.account.update({
        where: { id: account.id },
        data: { email },
        include: { user: { select: publicUserSelect } },
      });
    }
    const user = await prisma.user.update({
      where: { id: account.userId },
      data: { lastSeenAt: new Date() },
      select: publicUserSelect,
    });
    res.json({ user: formatUser(user) });
  }),
);
authRouter.get(
  "/me",
  requireAuth,
  authenticatedLimiter,
  asyncRoute(async (req: AuthRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: publicUserSelect,
    });
    if (!user) throw new HttpError(401, "Account is no longer valid");
    res.json({ user: formatUser(user) });
  }),
);
authRouter.patch(
  "/profile",
  requireAuth,
  authenticatedLimiter,
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(
      z
        .object({
          name: z.string().trim().min(1).max(80).optional(),
          statusText: z.string().trim().max(160).nullable().optional(),
        })
        .strict()
        .refine(
          (value) => value.name !== undefined || value.statusText !== undefined,
          "Provide a profile field",
        ),
      req.body,
    );
    const words = input.name?.split(/\s+/);
    const monogram = words
      ? (
          Array.from(words[0])[0] +
          (words.length > 1
            ? Array.from(words.at(-1)!)[0]
            : Array.from(words[0])[1] || "")
        ).toUpperCase()
      : undefined;
    const user = await prisma.user.update({
      where: { id: req.auth!.userId },
      data: {
        ...(input.name !== undefined ? { name: input.name, monogram } : {}),
        ...(input.statusText !== undefined
          ? { statusText: input.statusText || null }
          : {}),
      },
      select: publicUserSelect,
    });
    res.json({ user: formatUser(user) });
  }),
);
authRouter.post(
  "/logout",
  requireAuth,
  authenticatedLimiter,
  asyncRoute(async (req: AuthRequest, res) => {
    await firebaseAuth.revokeRefreshTokens(req.auth!.firebaseUid);
    await prisma.user.update({
      where: { id: req.auth!.userId },
      data: { lastSeenAt: null },
    });
    res.status(204).end();
  }),
);
