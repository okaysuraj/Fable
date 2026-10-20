import express, { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { AuthRequest } from "../lib/auth.js";
import { accessibleChannel, channelScope, lockChannel } from "../lib/access.js";
import { asyncRoute, HttpError, parse } from "../lib/http.js";
import { createAuthenticatedLimiter } from "../lib/rateLimits.js";

export const mediaRouter = Router();
export const assetSelect = {
  id: true,
  name: true,
  mimeType: true,
  size: true,
} as const;
// Only signature-recognized media can render inline. Everything else downloads as a file.
function detect(bytes: Buffer) {
  const hex = bytes.subarray(0, 16).toString("hex");
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (
    bytes.subarray(0, 6).toString() === "GIF87a" ||
    bytes.subarray(0, 6).toString() === "GIF89a"
  )
    return "image/gif";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  if (bytes.subarray(0, 4).toString() === "OggS") return "audio/ogg";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WAVE"
  )
    return "audio/wav";
  if (
    bytes.subarray(0, 3).toString() === "ID3" ||
    hex.startsWith("fffb") ||
    hex.startsWith("fff3")
  )
    return "audio/mpeg";
  if (bytes.subarray(4, 8).toString() === "ftyp")
    return bytes.subarray(8, 12).toString().startsWith("M4A")
      ? "audio/mp4"
      : "video/mp4";
  if (hex.startsWith("1a45dfa3")) return "video/webm";
  return "application/octet-stream";
}
mediaRouter.post(
  "/:channelId",
  createAuthenticatedLimiter({ limit: 12 }),
  express.raw({ type: "application/octet-stream", limit: "10mb" }),
  asyncRoute(async (req: AuthRequest, res) => {
    const { name } = parse(
      z
        .object({
          name: z
            .string()
            .trim()
            .min(1)
            .max(180)
            .refine(
              (value) => !/[\x00-\x1f\x7f/\\]/.test(value),
              "Invalid file name",
            ),
        })
        .strict(),
      req.query,
    );
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      throw new HttpError(400, "Upload a nonempty file up to 10 MB");
    const bytes: Buffer = req.body;
    const digest = createHash("sha256")
      .update(name)
      .update("\0")
      .update(bytes)
      .digest("hex");
    const asset = await prisma.$transaction(async (tx) => {
      await lockChannel(tx, req.params.channelId);
      const channel = await accessibleChannel(req, req.params.channelId, tx);
      if (channel.type !== "text")
        throw new HttpError(400, "Attachments require a text conversation");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`media-user:${req.auth!.userId}`}))`;
      await tx.mediaAsset.deleteMany({
        where: {
          ownerId: req.auth!.userId,
          messageId: null,
          createdAt: { lt: new Date(Date.now() - 86400000) },
        },
      });
      // Reconcile an upload whose HTTP response was lost before enforcing quota.
      const existing = await tx.mediaAsset.findFirst({
        where: {
          ownerId: req.auth!.userId,
          channelId: channel.id,
          digest,
          messageId: null,
        },
        select: assetSelect,
      });
      if (existing) return existing;
      const usage = await tx.mediaAsset.aggregate({
        where: { ownerId: req.auth!.userId },
        _sum: { size: true },
      });
      if ((usage._sum.size || 0) + bytes.length > 100 * 1024 * 1024)
        throw new HttpError(
          413,
          "Your 100 MB media limit is reached. Delete older media messages to free space.",
        );
      return tx.mediaAsset.create({
        data: {
          channelId: channel.id,
          ownerId: req.auth!.userId,
          name,
          mimeType: detect(bytes),
          size: bytes.length,
          digest,
          bytes: new Uint8Array(bytes),
        },
        select: assetSelect,
      });
    });
    res.status(201).json({ data: asset });
  }),
);
mediaRouter.get(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id: req.params.id,
        channel: channelScope(req),
        OR: [
          { message: { deletedAt: null } },
          { messageId: null, ownerId: req.auth!.userId },
        ],
      },
    });
    if (!asset) throw new HttpError(404, "Attachment is unavailable");
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader("Content-Length", asset.size);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(asset.name)}`,
    );
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.send(Buffer.from(asset.bytes));
  }),
);
mediaRouter.delete(
  "/:id",
  asyncRoute(async (req: AuthRequest, res) => {
    const target = await prisma.mediaAsset.findFirst({
      where: { id: req.params.id, channel: channelScope(req) },
      select: { channelId: true },
    });
    if (!target) throw new HttpError(404, "Attachment not found");
    await prisma.$transaction(async (tx) => {
      await lockChannel(tx, target.channelId);
      await accessibleChannel(req, target.channelId, tx);
      const result = await tx.mediaAsset.deleteMany({
        where: {
          id: req.params.id,
          ownerId: req.auth!.userId,
          messageId: null,
        },
      });
      if (!result.count)
        throw new HttpError(404, "Unsent attachment not found");
    });
    res.status(204).end();
  }),
);
