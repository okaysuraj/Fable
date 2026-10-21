/** PostgreSQL NOTIFY wakes sockets after commit, including sockets in other API processes. */
import { Client } from "pg";
import { pgConnectionOptions } from "../../config/database.mjs";
import { config } from "./config.js";
import { logServerError } from "./telemetry.js";

const subscribers = new Map<string, Set<() => void>>();
let ready = false;
export function eventListenerReady() {
  return ready;
}
export function watchUserEvents(userId: string, wake: () => void) {
  let group = subscribers.get(userId);
  if (!group) {
    group = new Set();
    subscribers.set(userId, group);
  }
  group.add(wake);
  return () => {
    group!.delete(wake);
    if (!group!.size) subscribers.delete(userId);
  };
}
export function startEventListener() {
  let stopped = false;
  let client: Client | null = null;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    if (stopped || retry) return;
    retry = setTimeout(() => {
      retry = undefined;
      void connect().catch((error) => {
        logServerError("event_listener_error", error);
        schedule();
      });
    }, 5000);
  };
  const connect = async () => {
    if (stopped) return;
    const connection = new Client(
      await pgConnectionOptions(config.database.eventUrl, "fable-realtime"),
    );
    client = connection;
    let recovering = false;
    const recover = () => {
      if (recovering) return;
      recovering = true;
      ready = false;
      void connection.end().catch(() => {});
      if (client === connection) client = null;
      schedule();
    };
    connection.on("error", recover);
    connection.on("end", recover);
    connection.on("notification", (notification) => {
      try {
        const users: unknown = JSON.parse(notification.payload || "[]");
        if (!Array.isArray(users)) return;
        for (const userId of users)
          if (typeof userId === "string")
            for (const wake of subscribers.get(userId) || []) wake();
      } catch {
        /* Malformed NOTIFY payloads carry no application state. */
      }
    });
    try {
      await connection.connect();
      await connection.query("LISTEN fable_events");
      if (stopped) {
        await connection.end();
        return;
      }
      ready = true;
    } catch (error) {
      logServerError("event_listener_connect_error", error);
      recover();
    }
  };
  void connect().catch((error) => {
    logServerError("event_listener_error", error);
    schedule();
  });
  return async () => {
    stopped = true;
    ready = false;
    if (retry) clearTimeout(retry);
    await client?.end();
  };
}
