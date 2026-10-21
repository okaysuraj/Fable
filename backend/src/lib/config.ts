/** Validate server-only configuration at startup; never log connection URLs or credentials. */
import "dotenv/config";
import { isIP } from "node:net";
import { databaseEnvironment } from "../../config/database.mjs";
import { callingEnvironment } from "../../config/calling.mjs";

const production = process.env.NODE_ENV === "production";
if (production && !process.env.FRONTEND_URL)
  throw new Error("Production FRONTEND_URL must be explicitly configured");
if (
  production &&
  (!process.env.FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID.startsWith("demo-") ||
    /REPLACE_WITH|^your[-_]|^placeholder(?:[-_]|$)|^mock(?:[-_]|$)/i.test(
      process.env.FIREBASE_PROJECT_ID,
    ))
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
const database = databaseEnvironment();
process.env.DATABASE_URL = database.runtimeUrl;
process.env.DIRECT_DATABASE_URL = database.directUrl;
export const config = {
  production,
  port: Number(process.env.PORT || 5000),
  host: process.env.HOST?.trim() || "0.0.0.0",
  origins,
  database,
  calling: callingEnvironment(),
};
if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535)
  throw new Error("PORT must be an integer between 1 and 65535");
if (!isIP(config.host)) throw new Error("HOST must be a listening IP address");
