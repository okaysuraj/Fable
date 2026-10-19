import { NextFunction, Request, RequestHandler, Response } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const asyncRoute =
  (
    handler: (req: Request, res: Response) => Promise<unknown>,
  ): RequestHandler =>
  (req, res, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };

export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new HttpError(
      400,
      result.error.issues
        .map(
          (issue) => `${issue.path.join(".") || "request"}: ${issue.message}`,
        )
        .join("; "),
    );
  return result.data;
}

export function databaseErrorStatus(error: unknown): number | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError))
    return undefined;
  if (error.code === "P2002") return 409;
  if (error.code === "P2025") return 404;
  if (["P2024", "P2028"].includes(error.code)) return 503;
  if (error.code === "P2034") return 409;
  if (
    error.code === "P2010" &&
    ["57014", "53300", "57P01"].includes(String(error.meta?.code))
  )
    return 503;
  return undefined;
}

/** Shared bound for public resource identifiers at the HTTP boundary. */
export const identifier = z.string().min(1).max(128);
