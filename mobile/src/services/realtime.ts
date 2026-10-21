import { AppState } from "react-native";
import { getApiBaseUrl, getSessionToken } from "./session";

export interface RealtimeEvent {
  type:
    | "ready"
    | "message.created"
    | "message.updated"
    | "profile.updated"
    | "settings.updated"
    | "call.updated"
    | "groupcall.updated";
  targetId?: string;
  channelId?: string;
  workspaceId?: string;
}
const listeners = new Set<(event: RealtimeEvent) => void>();
export function subscribeRealtime(listener: (event: RealtimeEvent) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish(event: RealtimeEvent) {
  for (const listener of listeners) listener(event);
}

/** Cursor belongs only to this signed-in lifetime. Reconnect also triggers a full authorized refresh. */
export function startRealtime() {
  let stopped = false;
  let socket: WebSocket | null = null;
  let cursor: string | undefined;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let connecting = false;
  const connect = async () => {
    if (stopped || connecting || AppState.currentState !== "active" || socket)
      return;
    connecting = true;
    try {
      const token = await getSessionToken();
      if (!token || stopped || AppState.currentState !== "active") return;
      const connection = new WebSocket(
        `${getApiBaseUrl().replace(/^http/, "ws")}/events`,
      );
      socket = connection;
      connection.onopen = () => {
        connection.send(
          JSON.stringify({ token, ...(cursor ? { after: cursor } : {}) }),
        );
      };
      connection.onmessage = (message) => {
        if (
          stopped ||
          connection !== socket ||
          typeof message.data !== "string"
        )
          return;
        try {
          const event: unknown = JSON.parse(message.data);
          if (
            !event ||
            typeof event !== "object" ||
            !("type" in event) ||
            !("cursor" in event) ||
            typeof event.type !== "string" ||
            typeof event.cursor !== "string" ||
            !/^\d{1,19}$/.test(event.cursor)
          )
            return;
          cursor = event.cursor;
          if (event.type === "checkpoint") return;
          if (
            ![
              "ready",
              "message.created",
              "message.updated",
              "profile.updated",
              "settings.updated",
              "call.updated",
              "groupcall.updated",
            ].includes(event.type)
          )
            return;
          attempt = 0;
          publish({
            type: event.type as RealtimeEvent["type"],
            ...("targetId" in event && typeof event.targetId === "string"
              ? { targetId: event.targetId }
              : {}),
            ...("channelId" in event && typeof event.channelId === "string"
              ? { channelId: event.channelId }
              : {}),
            ...("workspaceId" in event && typeof event.workspaceId === "string"
              ? { workspaceId: event.workspaceId }
              : {}),
          });
        } catch {
          /* Ignore malformed frames; API synchronization remains authoritative. */
        }
      };
      connection.onerror = () => connection.close();
      connection.onclose = () => {
        if (socket === connection) socket = null;
        if (!stopped && AppState.currentState === "active")
          timer = setTimeout(
            () => void connect(),
            Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)) +
              Math.random() * 400,
          );
      };
    } catch {
      if (!stopped) timer = setTimeout(() => void connect(), 5000);
    } finally {
      connecting = false;
    }
  };
  const subscription = AppState.addEventListener("change", (state) => {
    if (timer) clearTimeout(timer);
    if (state === "active") void connect();
    else {
      socket?.close();
      socket = null;
    }
  });
  void connect();
  return () => {
    stopped = true;
    subscription.remove();
    if (timer) clearTimeout(timer);
    socket?.close();
    socket = null;
  };
}
