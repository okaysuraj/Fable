import type { Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { HttpError } from "./http.js";

export function photoType(bytes: Buffer) {
  if (bytes.subarray(0, 3).toString("hex") === "ffd8ff") return "image/jpeg";
  if (bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a")
    return "image/png";
  if (
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return "image/webp";
  throw new HttpError(400, "Choose a JPEG, PNG or WebP photo.");
}

// Callers must authorize the viewer before reading any bytes.
export async function sendProfilePhoto(
  userId: string,
  res: Response,
  scope: Prisma.UserWhereInput = {},
) {
  const user = await prisma.user.findFirst({
    where: { AND: [{ id: userId }, scope] },
    select: { photoBytes: true, photoMimeType: true },
  });
  if (!user?.photoBytes || !user.photoMimeType)
    throw new HttpError(404, "No profile photo");
  res.set({
    "Content-Type": user.photoMimeType,
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(Buffer.from(user.photoBytes));
}
