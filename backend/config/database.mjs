/** Shared, credential-safe connection rules for the API and database operations. */
import { readFile } from "node:fs/promises";

const identifier = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
export function quoteIdentifier(value) {
  if (typeof value !== "string" || !identifier.test(value))
    throw new Error("Invalid database identifier.");
  return `"${value}"`;
}

export function parseDatabaseUrl(
  value,
  label,
  { allowLocal = false, direct = false, schema } = {},
) {
  if (!value || /REPLACE_WITH|YOUR_POSTGRES_PASSWORD/i.test(value))
    throw new Error(
      `Set ${label} in backend/.env before connecting to the database.`,
    );
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a PostgreSQL connection URL.`);
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.username ||
    !url.password ||
    !url.hostname ||
    !url.pathname.slice(1) ||
    url.hash
  )
    throw new Error(
      `${label} must be a complete PostgreSQL connection URL without a fragment.`,
    );
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (local && !allowLocal)
    throw new Error(
      `${label} must point to Neon. Local connections are reserved for LOCAL_DATABASE_URL during import.`,
    );
  if (!local && !url.hostname.endsWith(".neon.tech"))
    throw new Error(
      `${label} must use the Neon hostname from the Connect dialog.`,
    );
  if (direct && url.hostname.includes("-pooler."))
    throw new Error(
      `${label} requires the direct Neon hostname with connection pooling turned off.`,
    );
  const selected = schema || url.searchParams.get("schema") || "public";
  quoteIdentifier(selected);
  if (
    schema &&
    url.searchParams.has("schema") &&
    url.searchParams.get("schema") !== schema
  )
    throw new Error(`${label} schema does not match DATABASE_SCHEMA.`);
  url.searchParams.set("schema", selected);
  if (!local) {
    if (
      ["disable", "allow", "prefer", "no-verify"].includes(
        url.searchParams.get("sslmode"),
      ) ||
      (url.searchParams.has("sslaccept") &&
        url.searchParams.get("sslaccept") !== "strict")
    )
      throw new Error(
        `${label} must use verified TLS. Remove insecure SSL overrides.`,
      );
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("sslaccept", "strict");
  }
  return url;
}

function bound(url, key, fallback, maximum) {
  const value = url.searchParams.get(key);
  if (value === null) url.searchParams.set(key, String(fallback));
  else if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > maximum)
    throw new Error(`${key} must be between 1 and ${maximum}.`);
}
function endpoint(url) {
  return `${url.hostname.replace("-pooler.", ".")}:${url.port || "5432"}${url.pathname}`;
}

export function databaseEnvironment(env = process.env) {
  const schema = env.DATABASE_SCHEMA?.trim() || "public";
  const runtime = parseDatabaseUrl(env.DATABASE_URL, "DATABASE_URL", {
    schema,
  });
  if (!runtime.hostname.includes("-pooler."))
    throw new Error(
      "DATABASE_URL must use the pooled Neon hostname (-pooler). Use DIRECT_DATABASE_URL for migrations and realtime.",
    );
  const direct = parseDatabaseUrl(
    env.DIRECT_DATABASE_URL,
    "DIRECT_DATABASE_URL",
    { direct: true, schema },
  );
  const events = env.EVENT_DATABASE_URL?.trim()
    ? parseDatabaseUrl(env.EVENT_DATABASE_URL, "EVENT_DATABASE_URL", {
        direct: true,
        schema,
      })
    : (() => {
        const listener = new URL(direct);
        listener.username = runtime.username;
        listener.password = runtime.password;
        return listener;
      })();
  if (
    env.DATABASE_RUNTIME_ROLE &&
    (decodeURIComponent(runtime.username) !== env.DATABASE_RUNTIME_ROLE ||
      runtime.username === direct.username ||
      events.username === direct.username)
  )
    throw new Error(
      "Keep the configured app/realtime role separate from DIRECT_DATABASE_URL's migration owner.",
    );
  if (
    endpoint(runtime) !== endpoint(direct) ||
    endpoint(events) !== endpoint(direct)
  )
    throw new Error(
      "Runtime, migration and realtime URLs must identify the same Neon endpoint, database and schema.",
    );
  for (const url of [runtime, direct, events])
    bound(url, "connect_timeout", 15, 60);
  bound(runtime, "connection_limit", 5, 50);
  bound(runtime, "pool_timeout", 10, 60);
  bound(runtime, "socket_timeout", 15, 60);
  return {
    schema,
    runtimeUrl: runtime.toString(),
    directUrl: direct.toString(),
    eventUrl: events.toString(),
  };
}

export async function pgConnectionOptions(
  url,
  applicationName,
  caPath = process.env.DATABASE_TLS_CA_PATH,
) {
  const connection = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    connection.hostname,
  );
  const ca = caPath ? await readFile(caPath, "utf8") : undefined;
  // Keep connection-string parsing from replacing the explicit certificate verification.
  for (const key of [
    "schema",
    "connection_limit",
    "pool_timeout",
    "socket_timeout",
    "connect_timeout",
    "sslmode",
    "sslaccept",
    "ssl",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "uselibpqcompat",
    "pgbouncer",
    "channel_binding",
    "options",
  ])
    connection.searchParams.delete(key);
  return {
    connectionString: connection.toString(),
    ssl: local ? false : { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
    enableChannelBinding: !local,
    connectionTimeoutMillis: 15000,
    query_timeout: 15000,
    keepAlive: true,
    application_name: applicationName,
  };
}
