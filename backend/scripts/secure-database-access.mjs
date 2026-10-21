/** Give the running app CRUD access to its schema without schema/role administration. */
import "dotenv/config";
import { Client } from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  databaseEnvironment,
  pgConnectionOptions,
  quoteIdentifier,
} from "../config/database.mjs";

const config = databaseEnvironment();
if (process.env.DATABASE_RUNTIME_ROLE) {
  if (
    decodeURIComponent(new URL(config.runtimeUrl).username) !==
    process.env.DATABASE_RUNTIME_ROLE
  )
    throw new Error(
      "DATABASE_RUNTIME_ROLE does not match DATABASE_URL's user.",
    );
  console.info("Dedicated runtime credentials are already configured.");
} else {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const envFile = resolve(root, ".env");
  const original = await readFile(envFile, "utf8");
  const admin = new Client(
    await pgConnectionOptions(config.directUrl, "fable-access-setup"),
  );
  const role = `fable_app_${randomBytes(6).toString("hex")}`;
  // Generated locally and written only to the ignored environment file. Never log SQL or URLs.
  const password = randomBytes(32).toString("base64url");
  const quotedRole = quoteIdentifier(role);
  const schema = quoteIdentifier(config.schema);
  let committed = false;
  try {
    await admin.connect();
    await admin.query("BEGIN");
    await admin.query(
      `CREATE ROLE ${quotedRole} LOGIN NOINHERIT NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`,
    );
    const owner = (await admin.query("SELECT current_user AS name")).rows[0]
      .name;
    await admin.query(
      `GRANT CONNECT ON DATABASE ${quoteIdentifier(decodeURIComponent(new URL(config.directUrl).pathname.slice(1)))} TO ${quotedRole}`,
    );
    await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${quotedRole}`);
    await admin.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${quotedRole}`,
    );
    await admin.query(
      `REVOKE ALL ON ${schema}."_prisma_migrations" FROM ${quotedRole}`,
    );
    await admin.query(
      `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${schema} TO ${quotedRole}`,
    );
    await admin.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(owner)} IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${quotedRole}`,
    );
    await admin.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE ${quoteIdentifier(owner)} IN SCHEMA ${schema} GRANT USAGE, SELECT ON SEQUENCES TO ${quotedRole}`,
    );
    await admin.query("COMMIT");
    committed = true;
    const pooled = new URL(config.runtimeUrl);
    pooled.username = role;
    pooled.password = password;
    const events = new URL(config.directUrl);
    events.username = role;
    events.password = password;
    const app = new Client(
      await pgConnectionOptions(pooled, "fable-runtime-access-check"),
    );
    try {
      await app.connect();
      const access = await app.query(
        "SELECT has_schema_privilege(current_user,$1,'CREATE') AS can_create, has_table_privilege(current_user,$2,'UPDATE') AS can_change_migrations",
        [config.schema, `${schema}."_prisma_migrations"`],
      );
      if (access.rows[0].can_create || access.rows[0].can_change_migrations)
        throw new Error("Runtime administrative access was not restricted.");
      await app.query(`SELECT count(*) FROM ${schema}."Account"`);
    } finally {
      await app.end();
    }
    if ((await readFile(envFile, "utf8")) !== original)
      throw new Error(
        "The environment file changed during setup; it was not overwritten.",
      );
    let next = original;
    for (const [key, value] of Object.entries({
      DATABASE_URL: pooled.toString(),
      EVENT_DATABASE_URL: events.toString(),
      DATABASE_RUNTIME_ROLE: role,
    })) {
      const pattern = new RegExp(`^${key}=.*$`, "m");
      const line = `${key}="${value}"`;
      next = pattern.test(next)
        ? next.replace(pattern, () => line)
        : `${next.trimEnd()}\n${line}\n`;
    }
    const temporary = resolve(root, `.env.neon-role-${randomUUID()}.tmp`);
    // Both paths are verified before the atomic Windows rename replaces the environment file.
    if (
      ![envFile, temporary].every((path) =>
        path.toLowerCase().startsWith(`${root}${sep}`.toLowerCase()),
      )
    )
      throw new Error("Environment path escaped the backend directory.");
    await writeFile(temporary, next, { mode: 0o600, flag: "wx" });
    await rename(temporary, envFile);
    console.info(
      JSON.stringify({
        dedicatedRuntimeRole: true,
        migrationOwnerSeparated: true,
        credentialsSavedTo: "backend/.env",
      }),
    );
  } catch (error) {
    if (!committed) await admin.query("ROLLBACK").catch(() => {});
    console.error(
      JSON.stringify({
        operation: "database_access_setup",
        code: typeof error?.code === "string" ? error.code : "SETUP_FAILED",
        roleCommitted: committed,
      }),
    );
    process.exitCode = 1;
  } finally {
    await admin.end();
  }
}
