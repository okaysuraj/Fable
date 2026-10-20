/** Validate server-only configuration at startup; never log connection URLs or credentials. */
import "dotenv/config";
import { createHash } from "node:crypto";
import { z } from "zod";

const production = process.env.NODE_ENV === "production";
const devAuthEnabled = process.env.DEV_AUTH_ENABLED === "true";
if (devAuthEnabled && process.env.NODE_ENV !== "development")
  throw new Error("DEV_AUTH_ENABLED is only allowed with NODE_ENV=development");
const devProfile = devAuthEnabled
  ? z
      .object({
        email: z.email().max(254),
        name: z.string().trim().min(1).max(80),
      })
      .parse({
        email: (process.env.DEV_AUTH_EMAIL || "developer@fable.local")
          .trim()
          .toLowerCase(),
        name: process.env.DEV_AUTH_NAME || "Local developer",
      })
  : undefined;
if (production && !process.env.FRONTEND_URL)
  throw new Error("Production FRONTEND_URL must be explicitly configured");
if (
  production &&
  (!process.env.FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID.startsWith("demo-") ||
    process.env.FIREBASE_PROJECT_ID === "your-firebase-project-id")
)
  throw new Error(
    "Production FIREBASE_PROJECT_ID must identify the real Firebase project",
  );
if (
  production &&
  (process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.FABLE_INTEGRATION_TEST)
)
  throw new Error(
    "Emulator and test configuration must never be enabled in production",
  );
const origins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((value) => value.trim());
for (const origin of origins) {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error(
      "FRONTEND_URL must contain valid origins separated by commas",
    );
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.origin !== origin ||
    parsed.username ||
    parsed.password
  )
    throw new Error(
      "FRONTEND_URL entries must be exact HTTP(S) origins without paths or credentials",
    );
  if (production && parsed.protocol !== "https:")
    throw new Error("Production frontend origins must use HTTPS");
}
if (production) {
  let database: URL;
  try {
    database = new URL(process.env.DATABASE_URL || "");
  } catch {
    throw new Error("Production DATABASE_URL must be configured");
  }
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !database.hostname ||
    !database.pathname.slice(1) ||
    !database.username ||
    !database.password
  )
    throw new Error(
      "Production DATABASE_URL must be a complete PostgreSQL connection URL",
    );
  if (database.searchParams.get("sslmode") !== "require")
    throw new Error(
      "Production Prisma PostgreSQL connections require sslmode=require",
    );
  if (database.searchParams.get("sslaccept") !== "strict")
    throw new Error(
      "Production Prisma PostgreSQL connections require sslaccept=strict for certificate verification",
    );
  for (const [key, fallback, maximum] of [
    ["connection_limit", 5, 50],
    ["pool_timeout", 10, 60],
    ["socket_timeout", 15, 60],
  ] as const) {
    const value = database.searchParams.get(key);
    if (value === null) database.searchParams.set(key, String(fallback));
    else if (
      !/^\d+$/.test(value) ||
      Number(value) < 1 ||
      Number(value) > maximum
    )
      throw new Error(
        `Production ${key} must be 1..${maximum}; zero/unbounded values are not allowed`,
      );
  }
  // Small bounded defaults are appropriate for the single-instance hobby release.
  // This is server-only configuration; URLs are never written to logs or clients.
  process.env.DATABASE_URL = database.toString();
}
export const config = {
  production,
  devIdentity: devProfile
    ? {
        ...devProfile,
        uid: `fable-development:${createHash("sha256").update(devProfile.email).digest("hex")}`,
      }
    : undefined,
  port: Number(process.env.PORT || 5000),
  origins,
};
if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
  throw new Error("PORT must be an integer between 1 and 65535");
