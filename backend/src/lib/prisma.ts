/** One Prisma client owns each process pool; migrations are an explicit operator command. */
import { Prisma, PrismaClient } from "@prisma/client";
import { config } from "./config.js";
import { quoteIdentifier } from "../../config/database.mjs";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    // Prisma's automatic error logging can include invocation/query arguments.
    // The API boundary records only safe error metadata and a request ID.
    log: process.env.NODE_ENV === "development" ? ["warn"] : [],
    transactionOptions: { maxWait: 10000, timeout: 15000 },
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

/** Raw SQL must not depend on a transaction pool retaining SET search_path. */
export function sqlTable(name: string): Prisma.Sql {
  return Prisma.raw(
    `${quoteIdentifier(config.database.schema)}.${quoteIdentifier(name)}`,
  );
}

/**
 * Helper to check whether the PostgreSQL database is reachable.
 */
let dbConnected: boolean | null = null;
let lastCheckTime = 0;

export async function checkDatabaseConnection(): Promise<boolean> {
  const now = Date.now();
  // Cache check for 10 seconds to avoid flooding connections if DB is offline
  if (dbConnected !== null && now - lastCheckTime < 10000) {
    return dbConnected;
  }

  try {
    // Fast ping query
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
  } catch {
    dbConnected = false;
  }

  lastCheckTime = now;
  return dbConnected;
}
