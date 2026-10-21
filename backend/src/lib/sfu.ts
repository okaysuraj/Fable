/** Operator-owned mediasoup worker. One configured API process owns the initial SFU deployment. */
import type {
  Router,
  Worker,
  WebRtcTransport,
  Producer,
  Consumer,
  RtpParameters,
  RtpCapabilities,
  DtlsParameters,
} from "mediasoup/types";
import { HttpError } from "./http.js";
import { prisma } from "./prisma.js";
import { config } from "./config.js";

export const sfuEnabled = config.calling.sfu.enabled;
interface Peer {
  userId: string;
  transports: Map<
    string,
    { transport: WebRtcTransport; direction: "send" | "recv" }
  >;
  producers: Map<string, Producer>;
  consumers: Map<string, Consumer>;
}
interface Room {
  router: Router;
  peers: Map<string, Peer>;
}
let worker: Worker | null = null;
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
let stopped = false;
const rooms = new Map<string, Promise<Room>>();
export function sfuReady() {
  return !sfuEnabled || worker !== null;
}
function recoverWorker() {
  if (stopped || recoveryTimer) return;
  recoveryTimer = setTimeout(() => {
    recoveryTimer = undefined;
    void createSfuWorker().catch(() => {
      console.error(
        "Fable media worker restart failed; retrying in five seconds",
      );
      recoverWorker();
    });
  }, 5000);
  recoveryTimer.unref();
}
async function createSfuWorker() {
  const { createWorker } = await import("mediasoup");
  const created = await createWorker({ logLevel: "error" });
  if (stopped) {
    created.close();
    return;
  }
  worker = created;
  created.on("died", () => {
    if (worker !== created) return;
    worker = null;
    rooms.clear();
    console.error("Fable media worker exited; recovering in five seconds");
    recoverWorker();
  });
}
export async function startSfu() {
  if (!sfuEnabled) return;
  stopped = false;
  await createSfuWorker();
}
export function stopSfu() {
  stopped = true;
  if (recoveryTimer) clearTimeout(recoveryTimer);
  recoveryTimer = undefined;
  worker?.close();
  worker = null;
  rooms.clear();
}
async function room(id: string) {
  if (!sfuEnabled || !worker)
    throw new HttpError(503, "Group calling isn't configured on this server");
  let pending = rooms.get(id);
  if (!pending) {
    const instance = worker;
    pending = instance
      .createRouter({
        mediaCodecs: [
          {
            kind: "audio",
            mimeType: "audio/opus",
            clockRate: 48000,
            channels: 2,
          },
          { kind: "video", mimeType: "video/VP8", clockRate: 90000 },
        ],
      })
      .then((router) => ({ router, peers: new Map<string, Peer>() }));
    rooms.set(id, pending);
    pending.catch(() => rooms.delete(id));
  }
  return pending;
}
export async function joinSfu(
  callId: string,
  sessionId: string,
  userId: string,
) {
  const value = await room(callId);
  if (!value.peers.has(sessionId))
    value.peers.set(sessionId, {
      userId,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    });
  return {
    rtpCapabilities: value.router.rtpCapabilities,
    routerId: value.router.id,
  };
}
export async function leaveSfu(callId: string, sessionId: string) {
  const pending = rooms.get(callId);
  if (!pending) return;
  const value = await pending;
  const peer = value.peers.get(sessionId);
  if (peer) {
    for (const { transport } of peer.transports.values()) transport.close();
    value.peers.delete(sessionId);
  }
  if (!value.peers.size) {
    value.router.close();
    rooms.delete(callId);
  }
}
async function performSfuAction(
  callId: string,
  sessionId: string,
  action: {
    type: string;
    direction?: "send" | "recv";
    transportId?: string;
    producerId?: string;
    consumerId?: string;
    dtlsParameters?: DtlsParameters;
    rtpParameters?: RtpParameters;
    rtpCapabilities?: RtpCapabilities;
    kind?: "audio" | "video";
  },
) {
  const value = await room(callId);
  const peer = value.peers.get(sessionId);
  if (!peer) throw new HttpError(409, "Reconnect to this group call");
  if (action.type === "state")
    return {
      routerId: value.router.id,
      producers: [...value.peers.values()]
        .filter((entry) => entry !== peer)
        .flatMap((entry) =>
          [...entry.producers.values()]
            .filter((producer) => !producer.closed)
            .map((producer) => ({
              id: producer.id,
              userId: entry.userId,
              kind: producer.kind,
            })),
        ),
    };
  if (action.type === "transport") {
    if (!action.direction)
      throw new HttpError(400, "Transport direction required");
    const existing = [...peer.transports.values()].find(
      (entry) =>
        entry.direction === action.direction && !entry.transport.closed,
    );
    const transport =
      existing?.transport ||
      (await value.router.createWebRtcTransport({
        listenInfos: ["udp", "tcp"].map((protocol) => ({
          protocol: protocol as "udp" | "tcp",
          ip: config.calling.sfu.listenIp,
          announcedAddress: config.calling.sfu.address!,
          portRange: {
            min: config.calling.sfu.minimum,
            max: config.calling.sfu.maximum,
          },
        })),
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 800000,
      }));
    if (!existing) {
      peer.transports.set(transport.id, {
        transport,
        direction: action.direction,
      });
      transport.observer.once("close", () =>
        peer.transports.delete(transport.id),
      );
      transport.on("dtlsstatechange", (state) => {
        if (state === "closed") transport.close();
      });
    }
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }
  const transport = action.transportId
    ? peer.transports.get(action.transportId)
    : undefined;
  if (action.type === "connect") {
    if (!transport || !action.dtlsParameters)
      throw new HttpError(
        400,
        "Your transport and DTLS parameters are required",
      );
    await transport.transport.connect({
      dtlsParameters: action.dtlsParameters,
    });
    return { connected: true };
  }
  if (action.type === "restart-ice") {
    if (!transport)
      throw new HttpError(404, "Your media transport was not found");
    return transport.transport.restartIce();
  }
  if (action.type === "produce") {
    if (
      !transport ||
      transport.direction !== "send" ||
      !action.kind ||
      !action.rtpParameters
    )
      throw new HttpError(400, "Your sending transport is required");
    if (peer.producers.size >= 2)
      throw new HttpError(
        409,
        "Only one microphone and camera stream are supported",
      );
    if (
      [...peer.producers.values()].some(
        (producer) => producer.kind === action.kind,
      )
    )
      throw new HttpError(409, "A stream of this kind is already published");
    const producer = await transport.transport.produce({
      kind: action.kind,
      rtpParameters: action.rtpParameters,
    });
    peer.producers.set(producer.id, producer);
    producer.on("transportclose", () => peer.producers.delete(producer.id));
    return { id: producer.id };
  }
  if (action.type === "consume") {
    if (
      !transport ||
      transport.direction !== "recv" ||
      !action.producerId ||
      !action.rtpCapabilities
    )
      throw new HttpError(400, "Receiving parameters required");
    const source = [...value.peers.values()].find(
      (entry) => entry !== peer && entry.producers.has(action.producerId!),
    );
    if (
      !source ||
      !value.router.canConsume({
        producerId: action.producerId,
        rtpCapabilities: action.rtpCapabilities,
      })
    )
      throw new HttpError(404, "Stream unavailable");
    let consumer = [...peer.consumers.values()].find(
      (entry) => entry.producerId === action.producerId && !entry.closed,
    );
    if (!consumer) {
      if (peer.consumers.size >= 24)
        throw new HttpError(409, "Call stream limit reached");
      consumer = await transport.transport.consume({
        producerId: action.producerId,
        rtpCapabilities: action.rtpCapabilities,
        paused: true,
      });
      const id = consumer.id;
      peer.consumers.set(id, consumer);
      consumer.on("producerclose", () => {
        peer.consumers.get(id)?.close();
        peer.consumers.delete(id);
      });
      consumer.on("transportclose", () => peer.consumers.delete(id));
    }
    return {
      id: consumer.id,
      producerId: consumer.producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      userId: source.userId,
    };
  }
  if (action.type === "resume") {
    const consumer = action.consumerId
      ? peer.consumers.get(action.consumerId)
      : undefined;
    if (!consumer) throw new HttpError(404, "Stream unavailable");
    await consumer.resume();
    return { resumed: true };
  }
  throw new HttpError(400, "Unknown media action");
}
const operations = new Map<string, { tail: Promise<void>; pending: number }>();
export async function sfuAction(...args: Parameters<typeof performSfuAction>) {
  const key = `${args[0]}:${args[1]}`;
  const queue = operations.get(key) || { tail: Promise.resolve(), pending: 0 };
  if (queue.pending >= 16)
    throw new HttpError(429, "Too many pending media operations");
  queue.pending += 1;
  const previous = queue.tail;
  let release = () => {};
  queue.tail = new Promise<void>((resolve) => {
    release = resolve;
  });
  operations.set(key, queue);
  await previous;
  try {
    return await performSfuAction(...args);
  } finally {
    queue.pending -= 1;
    release();
    if (!queue.pending) operations.delete(key);
  }
}
export async function reapSfu() {
  if (!sfuEnabled || !rooms.size) return;
  for (const [callId, pending] of rooms) {
    const value = await pending;
    const live = await prisma.groupCallParticipant.findMany({
      where: {
        callId,
        leftAt: null,
        lastSeenAt: { gt: new Date(Date.now() - 45000) },
        call: {
          endedAt: null,
          channel: {
            members: {
              some: {
                userId: {
                  in: [...value.peers.values()].map((peer) => peer.userId),
                },
              },
            },
          },
        },
      },
      select: {
        sessionId: true,
        userId: true,
        call: {
          select: {
            channelId: true,
            channel: { select: { workspaceId: true } },
          },
        },
      },
    });
    for (const [sessionId, peer] of value.peers) {
      const record = live.find(
        (entry) =>
          entry.sessionId === sessionId && entry.userId === peer.userId,
      );
      const authorized =
        record &&
        (await prisma.channelMember.findFirst({
          where: {
            channelId: record.call.channelId,
            userId: peer.userId,
            user: {
              memberships: {
                some: { workspaceId: record.call.channel.workspaceId },
              },
            },
          },
          select: { userId: true },
        }));
      if (!authorized) await leaveSfu(callId, sessionId);
    }
  }
}
