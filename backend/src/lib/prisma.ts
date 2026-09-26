import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
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
