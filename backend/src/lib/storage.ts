/** Private binary storage. Only authorized API routes expose reads; keys never come from clients. */
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { resolve, join, isAbsolute } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import { prisma } from "./prisma.js";
import { config } from "./config.js";
import { HttpError } from "./http.js";
import { asyncRoute } from "./http.js";
import type { RequestHandler, Response } from "express";
import type { AuthRequest } from "./auth.js";

const uploading = new Set<string>();
export const mediaCapacity: RequestHandler = (req: AuthRequest, res, next) => {
  const userId = req.auth!.userId;
  if (uploading.size >= 2 || uploading.has(userId)) {
    res.setHeader("Retry-After", "2");
    res
      .status(429)
      .json({ error: "Another upload is being processed. Retry shortly." });
    return;
  }
  uploading.add(userId);
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      uploading.delete(userId);
    }
  };
  res.locals.releaseMedia = release;
  const closed = () => {
    if (!res.locals.mediaHandlerActive) release();
  };
  res.once("close", closed);
  res.once("finish", closed);
  next();
};
export function mediaRoute(
  handler: (req: AuthRequest, res: Response) => Promise<unknown>,
) {
  return asyncRoute(async (req, res) => {
    res.locals.mediaHandlerActive = true;
    try {
      return await handler(req, res);
    } finally {
      res.locals.releaseMedia?.();
    }
  });
}

const driver = process.env.MEDIA_STORAGE_DRIVER || "disk";
if (!["disk", "s3"].includes(driver))
  throw new Error("MEDIA_STORAGE_DRIVER must be disk or s3");
if (
  config.production &&
  driver === "disk" &&
  (process.env.MEDIA_STORAGE_DURABILITY !== "single-host" ||
    !isAbsolute(process.env.MEDIA_STORAGE_PATH || ""))
)
  throw new Error(
    "Production disk storage requires MEDIA_STORAGE_DURABILITY=single-host and an absolute persistent MEDIA_STORAGE_PATH; otherwise use s3",
  );
const directory = resolve(process.env.MEDIA_STORAGE_PATH || "./data/media");
const bucket = process.env.S3_BUCKET;
const endpoint = process.env.S3_ENDPOINT;
if (
  Boolean(process.env.S3_ACCESS_KEY_ID) !==
  Boolean(process.env.S3_SECRET_ACCESS_KEY)
)
  throw new Error(
    "Set both S3 credential fields, or leave both blank for workload identity",
  );
if (driver === "s3" && (!bucket || !process.env.S3_REGION))
  throw new Error("S3_BUCKET and S3_REGION are required for media storage");
if (endpoint && config.production && new URL(endpoint).protocol !== "https:")
  throw new Error("Production object storage requires HTTPS");
const client =
  driver === "s3"
    ? new S3Client({
        region: process.env.S3_REGION,
        endpoint,
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        ...(process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? {
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
              },
            }
          : {}),
        requestHandler: { connectionTimeout: 5000, socketTimeout: 15000 },
        maxAttempts: 3,
      })
    : null;

function diskPath(key: string) {
  if (!/^[a-f0-9]{2}\/[a-f0-9-]{36}$/.test(key))
    throw new Error("Invalid private storage key");
  return join(directory, ...key.split("/"));
}
export async function prepareImage(bytes: Buffer, profile = false) {
  try {
    const image = sharp(bytes, {
      limitInputPixels: 40_000_000,
      animated: false,
      failOn: "warning",
    });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp", "gif", "heif"].includes(metadata.format || ""))
      throw new Error("Unsupported image");
    // Re-encoding strips EXIF/GPS and rejects truncated or decompression-bomb inputs.
    const result = await image
      .rotate()
      .resize(profile ? 512 : 2048, profile ? 512 : 2048, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: profile ? 80 : 85, mozjpeg: true })
      .toBuffer();
    return { bytes: result, mimeType: "image/jpeg" };
  } catch {
    throw new HttpError(400, "Choose a valid photo up to 40 megapixels");
  }
}
export async function storeObject(bytes: Buffer, mimeType: string) {
  const id = randomUUID();
  const key = `${id.slice(0, 2)}/${id}`;
  // Register before touching storage: an interrupted write is discoverable by cleanup.
  await prisma.storageObject.create({
    data: { key, size: bytes.length, mimeType },
  });
  if (client)
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
      }),
      { abortSignal: AbortSignal.timeout(30000) },
    );
  else {
    const path = diskPath(key);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, bytes, { flag: "wx", mode: 0o600 });
  }
  return key;
}
export async function readObject(key: string): Promise<Buffer> {
  if (!client) return readFile(diskPath(key));
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { abortSignal: AbortSignal.timeout(30000) },
  );
  if (!response.Body) throw new Error("Stored media is unavailable");
  return Buffer.from(await response.Body.transformToByteArray());
}
export async function sendObject(key: string, response: Response) {
  const controller = new AbortController();
  const cancel = () => {
    if (!response.writableFinished) controller.abort();
  };
  response.once("close", cancel);
  try {
    let source: Readable;
    if (!client) source = createReadStream(diskPath(key));
    else {
      const object = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        {
          abortSignal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30000),
          ]),
        },
      );
      if (!(object.Body instanceof Readable))
        throw new Error("Private object storage returned an invalid stream");
      source = object.Body;
    }
    // HTTP downloads apply backpressure rather than buffering each photo in the API's memory.
    await pipeline(source, response, { signal: controller.signal });
  } catch (error) {
    if (!(
      controller.signal.aborted &&
      error instanceof Error &&
      error.name === "AbortError"
    ))
      throw error;
  } finally {
    response.removeListener("close", cancel);
  }
}
export async function removeObject(key: string) {
  if (client)
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(15000),
    });
  else await rm(diskPath(key), { force: true });
}
export async function checkStorage() {
  if (client)
    await client.send(new HeadBucketCommand({ Bucket: bucket }), {
      abortSignal: AbortSignal.timeout(5000),
    });
  else await mkdir(directory, { recursive: true, mode: 0o700 });
}
