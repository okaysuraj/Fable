/** Authenticated, bounded invalidation streams. Durable database history remains authoritative. */
import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import { prisma } from "./lib/prisma.js";
import { config } from "./lib/config.js";
import { verifyFirebaseIdentity } from "./lib/firebase.js";
import { logServerError } from "./lib/telemetry.js";
import { watchUserEvents } from "./lib/eventListener.js";

const hello = z
  .object({
    token: z.string().min(1).max(8192),
    after: z
      .string()
      .regex(/^\d{1,19}$/)
      .optional(),
  })
  .strict();
async function authenticate(token: string) {
  const identity = await verifyFirebaseIdentity(token);
  const account = await prisma.account.findUnique({
    where: { firebaseUid: identity.uid },
    select: { userId: true },
  });
  if (!account) throw new Error("Session required");
  return account.userId;
}
export function attachRealtime(server: Server) {
  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: 9000,
    perMessageDeflate: false,
  });
  const counts = new Map<string, number>();
  let upgradeWindow = Date.now();
  const upgrades = new Map<string, number>();
  server.on("upgrade", (request, socket, head) => {
    if (Date.now() - upgradeWindow > 60000) {
      upgrades.clear();
      upgradeWindow = Date.now();
    }
    const address = request.socket.remoteAddress || "unknown";
    const attempts = (upgrades.get(address) || 0) + 1;
    upgrades.set(address, attempts);
    if (
      attempts > 120 ||
      upgrades.size > 5000 ||
      request.url !== "/api/events" ||
      sockets.clients.size >= 2000 ||
      (request.headers.origin &&
        !config.origins.includes(request.headers.origin))
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    sockets.handleUpgrade(request, socket, head, (ws) =>
      sockets.emit("connection", ws),
    );
  });
  sockets.on("connection", (ws) => {
    let userId: string | null = null;
    let cursor = 0n;
    let inFlight = false;
    let dirty = false;
    let alive = true;
    const authDeadline = setTimeout(
      () => ws.close(4401, "Authentication required"),
      5000,
    );
    // Periodic reauthentication catches disabled/revoked sessions without storing tokens server-side.
    const lifetime = setTimeout(
      () => ws.close(4401, "Refresh session"),
      120000,
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};
    const send = (value: unknown) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (ws.bufferedAmount > 256_000) {
        ws.close(4408, "Reconnect to synchronize");
        return;
      }
      ws.send(JSON.stringify(value));
    };
    const pump = async () => {
      if (!userId || !alive) return;
      if (inFlight) {
        dirty = true;
        return;
      }
      if (timer) clearTimeout(timer);
      inFlight = true;
      try {
        const events = await prisma.userEvent.findMany({
          where: { userId, id: { gt: cursor } },
          orderBy: { id: "asc" },
          take: 100,
        });
        // Events contain no content. Authorization is rechecked before even exposing chat identifiers.
        const channelIds = [
          ...new Set(
            events.flatMap((event) =>
              event.channelId ? [event.channelId] : [],
            ),
          ),
        ];
        const permitted = new Set(
          (
            await prisma.channel.findMany({
              where: {
                id: { in: channelIds },
                workspace: { members: { some: { userId } } },
                OR: [{ isPrivate: false }, { members: { some: { userId } } }],
              },
              select: { id: true },
            })
          ).map((channel) => channel.id),
        );
        for (const event of events) {
          cursor = event.id;
          if (!event.channelId || permitted.has(event.channelId))
            send({
              type: event.type,
              cursor: event.id.toString(),
              targetId: event.targetId,
              channelId: event.channelId,
              workspaceId: event.workspaceId,
            });
        }
        send({ type: "checkpoint", cursor: cursor.toString() });
        timer = setTimeout(
          () => void pump(),
          events.length === 100 ? 20 : 15000,
        );
      } catch (error) {
        logServerError("realtime_error", error);
        ws.close(1011, "Service temporarily unavailable");
      } finally {
        inFlight = false;
        if (dirty && alive) {
          dirty = false;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void pump(), 0);
        }
      }
    };
    ws.once("message", (raw) => {
      void (async () => {
        const input = hello.parse(JSON.parse(raw.toString()));
        const actor = await authenticate(input.token);
        if (!alive) return;
        if ((counts.get(actor) || 0) >= 5) {
          ws.close(4408, "Too many connections");
          return;
        }
        userId = actor;
        counts.set(actor, (counts.get(actor) || 0) + 1);
        clearTimeout(authDeadline);
        const last = await prisma.userEvent.findFirst({
          where: { userId: actor },
          orderBy: { id: "desc" },
          select: { id: true },
        });
        cursor = input.after ? BigInt(input.after) : last?.id || 0n;
        if (cursor > (last?.id || 0n)) cursor = last?.id || 0n;
        send({ type: "ready", cursor: cursor.toString() });
        unsubscribe = watchUserEvents(actor, () => void pump());
        await pump();
      })().catch(() => ws.close(4401, "Session could not be verified"));
    });
    ws.on("error", () => ws.close());
    ws.on("close", () => {
      alive = false;
      unsubscribe();
      clearTimeout(authDeadline);
      clearTimeout(lifetime);
      if (timer) clearTimeout(timer);
      if (userId) {
        const remaining = (counts.get(userId) || 1) - 1;
        if (remaining) counts.set(userId, remaining);
        else counts.delete(userId);
      }
    });
  });
  return () => {
    for (const socket of sockets.clients)
      socket.close(1001, "Server restarting");
    sockets.close();
  };
}
