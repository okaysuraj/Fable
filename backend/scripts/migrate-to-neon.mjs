/** One-time, data-preserving import into an unused Neon application schema. */
import "dotenv/config";
import { Client } from "pg";
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, openSync, closeSync } from "node:fs";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { rootCertificates } from "node:tls";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  databaseEnvironment,
  parseDatabaseUrl,
  pgConnectionOptions,
  quoteIdentifier,
} from "../config/database.mjs";

const configuration = databaseEnvironment();
const sourceUrl = parseDatabaseUrl(
  process.env.LOCAL_DATABASE_URL,
  "LOCAL_DATABASE_URL",
  { allowLocal: true },
);
if (!["localhost", "127.0.0.1", "[::1]"].includes(sourceUrl.hostname))
  throw new Error(
    "LOCAL_DATABASE_URL must identify the existing local PostgreSQL source.",
  );
const schema = sourceUrl.searchParams.get("schema");
if (schema !== configuration.schema || schema === "public")
  throw new Error(
    "Import preserves the existing non-public application schema. Match DATABASE_SCHEMA to LOCAL_DATABASE_URL's schema.",
  );
const quotedSchema = quoteIdentifier(schema);
const root = fileURLToPath(new URL("..", import.meta.url));
const backupDirectory = resolve(root, "data", "backups");
await mkdir(backupDirectory, { recursive: true, mode: 0o700 });
const archive = resolve(
  backupDirectory,
  `fable-before-neon-${Date.now()}-${randomUUID()}.dump`,
);
const errorLog = `${archive}.stderr.log`;
const source = new Client(
  await pgConnectionOptions(sourceUrl, "fable-local-export"),
);
const target = new Client(
  await pgConnectionOptions(configuration.directUrl, "fable-neon-import"),
);
let sourceTransaction = false;

function toolRunner() {
  if (
    spawnSync("pg_dump", ["--version"], { stdio: "ignore" }).status === 0 &&
    spawnSync("pg_restore", ["--version"], { stdio: "ignore" }).status === 0
  )
    return { docker: false };
  const container = process.env.LOCAL_DATABASE_CONTAINER || "fable_postgres";
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(container))
    throw new Error("LOCAL_DATABASE_CONTAINER is invalid.");
  const probe = spawnSync(
    "docker",
    ["inspect", "--format", "{{.State.Running}}", container],
    { encoding: "utf8", windowsHide: true },
  );
  if (probe.status !== 0 || probe.stdout.trim() !== "true")
    throw new Error(
      "Install PostgreSQL client tools or start the existing local PostgreSQL container before importing.",
    );
  return { docker: true, container };
}
const runner = toolRunner();
function pgEnvironment(url, remote = false) {
  return {
    ...process.env,
    PGHOST: remote
      ? url.hostname
      : runner.docker
        ? "127.0.0.1"
        : url.hostname.replace(/^\[|\]$/g, ""),
    PGPORT: !remote && runner.docker ? "5432" : url.port || "5432",
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: remote ? "verify-full" : "disable",
    PGCONNECT_TIMEOUT: "15",
    PGAPPNAME: "fable-neon-migration",
    PGCHANNELBINDING: remote ? "require" : "prefer",
  };
}
async function runTool(tool, args, env, { input, output } = {}) {
  const forwarded = [
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "PGSSLMODE",
    "PGCONNECT_TIMEOUT",
    "PGAPPNAME",
    "PGCHANNELBINDING",
    ...(env.PGSSLROOTCERT ? ["PGSSLROOTCERT"] : []),
  ];
  const command = runner.docker ? "docker" : tool;
  const parameters = runner.docker
    ? [
        "exec",
        ...(input ? ["-i"] : []),
        ...forwarded.flatMap((key) => ["--env", key]),
        runner.container,
        tool,
        ...args,
      ]
    : args;
  const errorFd = openSync(errorLog, "a", 0o600);
  const outputFd = output ? openSync(output, "wx", 0o600) : null;
  try {
    await new Promise((resolveOperation, reject) => {
      const child = spawn(command, parameters, {
        env,
        cwd: root,
        shell: false,
        windowsHide: true,
        stdio: [input ? "pipe" : "ignore", outputFd ?? "ignore", errorFd],
      });
      let stream;
      if (input) {
        stream = createReadStream(input);
        stream.on("error", (error) => {
          child.kill();
          reject(error);
        });
        child.stdin.on("error", () => {
          stream.destroy();
        });
        stream.pipe(child.stdin);
      }
      const deadline = setTimeout(() => {
        child.kill();
        reject(new Error(`${tool} exceeded the 10-minute migration deadline.`));
      }, 600000);
      child.once("error", () => {
        clearTimeout(deadline);
        stream?.destroy();
        reject(new Error(`Could not start ${tool}.`));
      });
      child.once("close", (code) => {
        clearTimeout(deadline);
        stream?.destroy();
        if (code === 0) resolveOperation();
        else
          reject(
            new Error(`${tool} failed. Private diagnostic log: ${errorLog}`),
          );
      });
    });
  } finally {
    closeSync(errorFd);
    if (outputFd !== null) closeSync(outputFd);
  }
}
async function tables(client) {
  return (
    await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename",
      [schema],
    )
  ).rows.map((row) => row.tablename);
}
async function counts(client, names) {
  const result = {};
  for (const name of names)
    result[name] = (
      await client.query(
        `SELECT count(*)::text AS count FROM ${quotedSchema}.${quoteIdentifier(name)}`,
      )
    ).rows[0].count;
  return result;
}
try {
  await source.connect();
  await target.connect();
  const locked = await target.query(
    "SELECT pg_try_advisory_lock(hashtext('fable-neon-import'), hashtext($1)) AS acquired",
    [schema],
  );
  if (!locked.rows[0].acquired)
    throw new Error("Another import is already running.");
  const existing = await target.query(
    "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname=$1) AS present",
    [schema],
  );
  if (existing.rows[0].present)
    throw new Error(
      "The target application schema already exists. Import refuses to overwrite it; select an unused Neon branch/database.",
    );
  const names = await tables(source);
  if (!names.includes("Account") || !names.includes("_prisma_migrations"))
    throw new Error(
      "The local application schema or reviewed migration history is missing.",
    );
  console.info(
    "Creating a consistent backup. Local table locks pause writes until import verification finishes.",
  );
  await source.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  sourceTransaction = true;
  await source.query("SET LOCAL lock_timeout = '10s'");
  await source.query("SET LOCAL idle_in_transaction_session_timeout = '15min'");
  await source.query(
    `LOCK TABLE ${names.map((name) => `${quotedSchema}.${quoteIdentifier(name)}`).join(", ")} IN SHARE MODE`,
  );
  const snapshot = (await source.query("SELECT pg_export_snapshot() AS id"))
    .rows[0].id;
  const before = await counts(source, names);
  await runTool(
    "pg_dump",
    [
      "--format=custom",
      `--schema=${schema}`,
      `--snapshot=${snapshot}`,
      "--no-owner",
      "--no-privileges",
      "--lock-wait-timeout=10000",
    ],
    pgEnvironment(sourceUrl),
    { output: archive },
  );
  await runTool("pg_restore", ["--list"], pgEnvironment(sourceUrl), {
    input: archive,
  });
  console.info(`Local backup created: ${archive}`);
  const remote = pgEnvironment(new URL(configuration.directUrl), true);
  if (runner.docker) {
    if (process.env.DATABASE_TLS_CA_PATH)
      throw new Error(
        "A custom CA requires native PostgreSQL client tools for import.",
      );
    remote.PGSSLROOTCERT = "/etc/ssl/certs/ca-certificates.crt";
  } else {
    const caFile = `${archive}.ca.pem`;
    await writeFile(
      caFile,
      process.env.DATABASE_TLS_CA_PATH
        ? await readFile(process.env.DATABASE_TLS_CA_PATH)
        : rootCertificates.join("\n"),
      { mode: 0o600, flag: "wx" },
    );
    remote.PGSSLROOTCERT = caFile;
  }
  console.info(
    "Importing into Neon in one transaction. Existing schemas are preserved.",
  );
  await runTool(
    "pg_restore",
    [
      "--dbname",
      decodeURIComponent(new URL(configuration.directUrl).pathname.slice(1)),
      "--single-transaction",
      "--exit-on-error",
      "--no-owner",
      "--no-privileges",
    ],
    remote,
    { input: archive },
  );
  const importedTables = await tables(target);
  if (JSON.stringify(importedTables) !== JSON.stringify(names))
    throw new Error(
      "Imported table inventory differs from the source. The source and backup are retained.",
    );
  const after = await counts(target, names);
  if (names.some((name) => before[name] !== after[name]))
    throw new Error(
      "Imported row counts differ from the source. The source and backup are retained.",
    );
  await writeFile(
    `${archive}.manifest.json`,
    JSON.stringify(
      { schema, importedAt: new Date().toISOString(), tableRows: before },
      null,
      2,
    ),
    { mode: 0o600, flag: "wx" },
  );
  console.info(
    JSON.stringify({
      imported: true,
      verifiedTables: names.length,
      verifiedRows: Object.values(after)
        .reduce((sum, count) => sum + BigInt(count), 0n)
        .toString(),
      backup: archive,
    }),
  );
} finally {
  if (sourceTransaction) await source.query("ROLLBACK").catch(() => {});
  await Promise.allSettled([source.end(), target.end()]);
}
