import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
dotenv.config({ path: resolve(backendRoot, ".env") });
const direct = process.env.DIRECT_DATABASE_URL;
if (!direct)
  throw new Error(
    "Set DIRECT_DATABASE_URL to the direct PostgreSQL migration connection. Runtime DATABASE_URL is never used as a migration fallback.",
  );
let database;
try {
  database = new URL(direct);
} catch {
  throw new Error("DIRECT_DATABASE_URL is invalid.");
}
if (
  !["postgres:", "postgresql:"].includes(database.protocol) ||
  !database.hostname ||
  !database.pathname.slice(1)
)
  throw new Error("DIRECT_DATABASE_URL must identify a PostgreSQL database.");
if (database.hostname.includes("-pooler."))
  throw new Error(
    "Use the direct Neon hostname, not the transaction-pooler hostname, for migration deployment.",
  );
const local = ["localhost", "127.0.0.1", "[::1]"].includes(database.hostname);
if (
  !local &&
  (database.searchParams.get("sslmode") !== "require" ||
    database.searchParams.get("sslaccept") !== "strict")
)
  throw new Error(
    "Remote migration connections require sslmode=require and sslaccept=strict.",
  );
console.info(
  "Deploying reviewed migrations through the explicitly configured direct connection.",
);
const child = spawn(
  process.execPath,
  [require.resolve("prisma/build/index.js"), "migrate", "deploy"],
  {
    cwd: backendRoot,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, DATABASE_URL: direct },
  },
);
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
