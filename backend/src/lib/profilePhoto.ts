import type { Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma.js";
import { HttpError } from "./http.js";
import { sendObject } from "./storage.js";

// Callers must authorize the viewer before reading any bytes.
export async function sendProfilePhoto(
  userId: string,
  res: Response,
  scope: Prisma.UserWhereInput = {},
) {
  const user = await prisma.user.findFirst({
    where: { AND: [{ id: userId }, scope] },
    select: { photoBytes: true, photoStorageKey: true, photoMimeType: true },
  });
  if ((!user?.photoBytes && !user?.photoStorageKey) || !user.photoMimeType)
    throw new HttpError(404, "No profile photo");
  res.set({
    "Content-Type": user.photoMimeType,
    "Cache-Control": "private, no-store",
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
  });
  if (user.photoStorageKey) await sendObject(user.photoStorageKey, res);
  else res.send(Buffer.from(user.photoBytes!));
}
