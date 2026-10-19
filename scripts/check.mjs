import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCli =
  process.env.npm_execpath ||
  resolve(dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
if (!existsSync(npmCli))
  throw new Error(
    "Run this command through npm run check so the installed npm CLI can be located.",
  );

const steps = [
  [".", "format:check"],
  ["backend", "prisma:validate"],
  ["backend", "prisma:generate"],
  ["backend", "build"],
  ["frontend", "build"],
  ["mobile", "typecheck"],
  ["mobile", "lint"],
];
for (const [directory, command] of steps) {
  console.info(`Checking ${directory}: ${command}`);
  const code = await new Promise((resolveCode, reject) => {
    const child = spawn(process.execPath, [npmCli, "run", command], {
      cwd: resolve(root, directory),
      stdio: "inherit",
      shell: false,
    });
    child.once("error", reject);
    child.once("exit", (exitCode) => resolveCode(exitCode ?? 1));
  });
  if (code !== 0) {
    process.exitCode = code;
    break;
  }
}
if (!process.exitCode)
  console.info(
    "Local build, type and lint checks passed. Live services and native-device behavior still require a manual walkthrough.",
  );
