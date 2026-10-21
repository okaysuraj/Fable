import "dotenv/config";
import { Client } from "pg";
import { randomBytes } from "node:crypto";
import { readdir } from "node:fs/promises";
import {
  databaseEnvironment,
  pgConnectionOptions,
  quoteIdentifier,
} from "../config/database.mjs";

const config = databaseEnvironment();
const clients = [
  new Client(await pgConnectionOptions(config.runtimeUrl, "fable-pool-check")),
  new Client(await pgConnectionOptions(config.directUrl, "fable-direct-check")),
  new Client(
    await pgConnectionOptions(config.eventUrl, "fable-realtime-check"),
  ),
];
try {
  for (const client of clients) {
    await client.connect();
    await client.query("SELECT 1");
    const exists = await client.query(
      "SELECT to_regclass($1) IS NOT NULL AS present",
      [`${quoteIdentifier(config.schema)}."Account"`],
    );
    if (!exists.rows[0].present)
      throw new Error(
        "Application tables are missing. Import the local database or run npm run prisma:deploy first.",
      );
  }
  const expected = (
    await readdir(new URL("../prisma/migrations/", import.meta.url), {
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const applied = await clients[1].query(
    `SELECT migration_name FROM ${quoteIdentifier(config.schema)}."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  );
  if (
    expected.some(
      (name) => !applied.rows.some((row) => row.migration_name === name),
    )
  )
    throw new Error(
      "Reviewed migrations are pending. Run npm run prisma:deploy.",
    );
  const channel = `fable_connection_${randomBytes(8).toString("hex")}`;
  await clients[2].query(`LISTEN ${quoteIdentifier(channel)}`);
  let timer;
  let notification;
  const received = new Promise((resolveReceipt, reject) => {
    timer = setTimeout(
      () => reject(new Error("Neon realtime notification was not received.")),
      10000,
    );
    notification = (event) => {
      if (event.channel === channel) {
        clearTimeout(timer);
        resolveReceipt();
      }
    };
    clients[2].on("notification", notification);
  });
  try {
    await Promise.all([
      clients[0].query("SELECT pg_notify($1, 'connection-check')", [channel]),
      received,
    ]);
  } finally {
    clearTimeout(timer);
    clients[2].off("notification", notification);
    await clients[2].query(`UNLISTEN ${quoteIdentifier(channel)}`);
  }
  console.info(
    JSON.stringify({
      pooledQueries: "connected",
      directRealtime: "connected",
      schema: config.schema,
      reviewedMigrations: expected.length,
      realtimeRoundTrip: "received",
    }),
  );
} finally {
  await Promise.allSettled(clients.map((client) => client.end()));
}
