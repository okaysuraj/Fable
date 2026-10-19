/** Persist account preferences; legacy media settings remain for existing client compatibility. */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { asyncRoute, parse } from "../lib/http.js";

export const settingsRouter = Router();
const settingsSchema = z
  .object({
    micDeviceId: z.string().min(1).max(256).optional(),
    cameraDeviceId: z.string().min(1).max(256).optional(),
    speakerDeviceId: z.string().min(1).max(256).optional(),
    noiseCancellation: z.boolean().optional(),
    spatialAudio: z.boolean().optional(),
    theme: z.enum(["light", "dark"]).optional(),
    inputVolume: z.number().int().min(0).max(100).optional(),
    outputVolume: z.number().int().min(0).max(100).optional(),
  })
  .strict();
settingsRouter.get(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const setting = await prisma.workspaceSetting.upsert({
      where: { userId: req.auth!.userId },
      create: { userId: req.auth!.userId },
      update: {},
    });
    res.json({ data: setting });
  }),
);
settingsRouter.put(
  "/",
  asyncRoute(async (req: AuthRequest, res) => {
    const data = parse(settingsSchema, req.body);
    const updated = await prisma.workspaceSetting.upsert({
      where: { userId: req.auth!.userId },
      update: data,
      create: { userId: req.auth!.userId, ...data },
    });
    res.json({ data: updated });
  }),
);
