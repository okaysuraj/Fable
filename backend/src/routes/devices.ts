import { Router } from "express";
import { z } from "zod";
import type { AuthRequest } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import { asyncRoute, parse, HttpError } from "../lib/http.js";
import { accessibleChannel, lockChannel } from "../lib/access.js";
import { firebaseProjectConfigured } from "../lib/firebase.js";

export const devicesRouter = Router();
devicesRouter.get("/config", (_req, res) =>
  res.json({
    data: {
      apns: Boolean(
        process.env.APNS_BUNDLE_ID &&
        process.env.APNS_KEY_ID &&
        process.env.APNS_TEAM_ID &&
        (process.env.APNS_KEY_PATH || process.env.APNS_KEY_P8),
      ),
      fcm: firebaseProjectConfigured(),
    },
  }),
);
const registration = z
  .object({
    id: z.uuid(),
    provider: z.enum(["apns", "fcm"]),
    token: z.string().min(20).max(4096),
    voipToken: z
      .string()
      .regex(/^[a-f0-9]{64,256}$/i)
      .optional(),
    sandbox: z.boolean().default(false),
  })
  .strict();
devicesRouter.put(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const input = parse(registration, req.body);
    if (input.provider === "apns" && !/^[a-f0-9]{64,256}$/i.test(input.token)) {
      res.status(400).json({ error: "Invalid Apple device token" });
      return;
    }
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`device-user:${req.auth!.userId}`}))`;
      const ownDevice = await tx.deviceInstallation.findFirst({
        where: { id: input.id, userId: req.auth!.userId },
        select: { id: true },
      });
      if (
        !ownDevice &&
        (await tx.deviceInstallation.count({
          where: { userId: req.auth!.userId },
        })) >= 10
      )
        throw new HttpError(
          409,
          "Your account has reached its 10-device limit. Sign out an older device first.",
        );
      // A token moves atomically on account switch; queued deliveries for the previous owner are discarded.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`push-token:${input.token}`}))`;
      await tx.deviceInstallation.deleteMany({
        where: { token: input.token, id: { not: input.id } },
      });
      await tx.pushDelivery.deleteMany({
        where: {
          deviceId: input.id,
          device: { userId: { not: req.auth!.userId } },
        },
      });
      await tx.deviceInstallation.upsert({
        where: { id: input.id },
        create: { ...input, userId: req.auth!.userId },
        update: {
          ...input,
          voipToken: input.voipToken ?? null,
          userId: req.auth!.userId,
          enabled: true,
        },
      });
    });
    res.status(204).end();
  }),
);
devicesRouter.delete(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const id = parse(z.uuid(), req.params.id);
    await prisma.deviceInstallation.deleteMany({
      where: { id, userId: req.auth!.userId },
    });
    res.status(204).end();
  }),
);
devicesRouter.get(
  "/conversation/:channelId",
  asyncRoute(async (req: AuthRequest, res) => {
    await accessibleChannel(req, req.params.channelId);
    const preference = await prisma.conversationNotification.findUnique({
      where: {
        userId_channelId: {
          userId: req.auth!.userId,
          channelId: req.params.channelId,
        },
      },
    });
    res.json({ data: { muted: preference?.muted ?? false } });
  }),
);
devicesRouter.put(
  "/conversation/:channelId",
  asyncRoute(async (req: AuthRequest, res) => {
    const data = parse(z.object({ muted: z.boolean() }).strict(), req.body);
    await prisma.$transaction(async (tx) => {
      await lockChannel(tx, req.params.channelId);
      await accessibleChannel(req, req.params.channelId, tx);
      const key = { userId: req.auth!.userId, channelId: req.params.channelId };
      await tx.conversationNotification.upsert({
        where: { userId_channelId: key },
        create: { ...key, ...data },
        update: data,
      });
    });
    res.json({ data });
  }),
);
