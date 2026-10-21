import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { databaseEnvironment } from "../config/database.mjs";

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
dotenv.config({ path: resolve(backendRoot, ".env") });
const database = databaseEnvironment();
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
    env: {
      ...process.env,
      DATABASE_URL: database.directUrl,
      DIRECT_DATABASE_URL: database.directUrl,
    },
  },
);
child.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.once("exit", (code) => {
  process.exitCode = code ?? 1;
});
