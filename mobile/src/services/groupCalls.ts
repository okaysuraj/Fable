import type { MediaStream, MediaStreamTrack } from "react-native-webrtc";
import type { types } from "mediasoup-client";
import { randomUUID } from "expo-crypto";
import { isRunningInExpoGo } from "expo";
import { request } from "./session";
import {
  initializeNativeCalls,
  nativeOutgoing,
  nativeConnected,
  nativeEnd,
} from "./nativeCalls";

export interface GroupCallSummary {
  id: string;
  kind: "audio" | "video";
  participants: { userId: string }[];
}
interface JoinedCall {
  id: string;
  nativeId: string;
  kind: "audio" | "video";
  rtpCapabilities: types.RtpCapabilities;
  iceServers: RTCIceServer[];
  iceTransportPolicy: RTCIceTransportPolicy;
  routerId: string;
}
export const groupCalls = {
  config: () =>
    request<{ data: { enabled: boolean; maximumParticipants: number } }>(
      "/group-calls/config",
    ),
  active: async (channelId: string) =>
    (
      await request<{ data: GroupCallSummary | null }>(
        `/group-calls/${encodeURIComponent(channelId)}`,
      )
    ).data,
};
export interface RemoteGroupStream {
  producerId: string;
  userId: string;
  kind: "audio" | "video";
  stream: MediaStream;
}
interface Snapshot {
  nativeId?: string;
  local: MediaStream | null;
  remote: RemoteGroupStream[];
  phase: "connecting" | "connected" | "ended";
  error?: string;
}

/** One native WebRTC connection publishes once and receives each SFU stream separately. */
export class GroupCallConnection {
  readonly sessionId = randomUUID();
  private call: JoinedCall | null = null;
  private send: types.Transport | null = null;
  private receive: types.Transport | null = null;
  private stream: MediaStream | null = null;
  private consumers = new Map<
    string,
    { consumer: types.Consumer; remote: RemoteGroupStream }
  >();
  private closed = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private polling = false;
  private failures = 0;
  private repairing = new Set<string>();
  private repairAttempts = new Map<string, number>();
  private repairTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private rtc: typeof import("react-native-webrtc") | null = null;
  constructor(private readonly change: (value: Snapshot) => void) {}
  private update(phase: Snapshot["phase"], error?: string) {
    if (!this.closed || phase === "ended")
      this.change({
        nativeId: this.call?.nativeId,
        local: this.stream,
        remote: [...this.consumers.values()].map((value) => value.remote),
        phase,
        error,
      });
  }
  private async rpc<T>(body: Record<string, unknown>): Promise<T> {
    if (!this.call || this.closed) throw new Error("Call closed");
    return (
      await request<{ data: T }>(`/group-calls/${this.call.id}/media`, {
        method: "POST",
        body: JSON.stringify({ sessionId: this.sessionId, ...body }),
      })
    ).data;
  }
  private async repair(transport: types.Transport) {
    if (this.closed || this.repairing.has(transport.id)) return;
    const count = (this.repairAttempts.get(transport.id) || 0) + 1;
    if (count > 3) {
      await this.close(
        "The group call couldn't reconnect. Check your connection and rejoin.",
      );
      return;
    }
    this.repairAttempts.set(transport.id, count);
    this.repairing.add(transport.id);
    this.update("connecting");
    try {
      const iceParameters = await this.rpc<types.IceParameters>({
        type: "restart-ice",
        transportId: transport.id,
      });
      if (!this.closed) await transport.restartIce({ iceParameters });
    } catch {
      /* Retry the authorized ICE operation after the network has time to recover. */
    } finally {
      this.repairing.delete(transport.id);
      if (!this.closed)
        this.repairTimers.set(
          transport.id,
          setTimeout(() => {
            if (transport.connectionState !== "connected")
              void this.repair(transport);
          }, 10000),
        );
    }
  }
  async start(channelId: string, kind: "audio" | "video", name: string) {
    try {
      if (isRunningInExpoGo())
        throw new Error(
          "Group calling requires an installed Fable development or release build.",
        );
      await initializeNativeCalls();
      this.rtc = await import("react-native-webrtc");
      this.rtc.registerGlobals();
      const { Device } = await import("mediasoup-client");
      const stream = await this.rtc.mediaDevices.getUserMedia({
        audio: true,
        video:
          kind === "video"
            ? { facingMode: "user", width: 640, height: 480, frameRate: 24 }
            : false,
      });
      if (this.closed) {
        stream.getTracks().forEach((track) => track.stop());
        stream.release();
        return;
      }
      this.stream = stream;
      this.update("connecting");
      const joined = await request<{ data: JoinedCall }>(
        `/group-calls/${encodeURIComponent(channelId)}/join`,
        {
          method: "POST",
          body: JSON.stringify({ kind, sessionId: this.sessionId }),
        },
      );
      this.call = joined.data;
      if (this.closed) {
        await this.leaveServer();
        return;
      }
      const device = new Device({ handlerName: "ReactNative106" });
      await device.load({ routerRtpCapabilities: joined.data.rtpCapabilities });
      const sending = await this.rpc<types.TransportOptions>({
        type: "transport",
        direction: "send",
      });
      const receiving = await this.rpc<types.TransportOptions>({
        type: "transport",
        direction: "recv",
      });
      if (this.closed) return;
      this.send = device.createSendTransport({
        ...sending,
        iceServers: joined.data.iceServers,
        iceTransportPolicy: joined.data.iceTransportPolicy,
      });
      this.receive = device.createRecvTransport({
        ...receiving,
        iceServers: joined.data.iceServers,
        iceTransportPolicy: joined.data.iceTransportPolicy,
      });
      for (const transport of [this.send, this.receive]) {
        transport.on("connect", ({ dtlsParameters }, callback, errback) => {
          void this.rpc({
            type: "connect",
            transportId: transport.id,
            dtlsParameters,
          })
            .then(() => callback())
            .catch(errback);
        });
        transport.on("connectionstatechange", (state) => {
          if (state === "connected") {
            this.repairAttempts.delete(transport.id);
            const timer = this.repairTimers.get(transport.id);
            if (timer) clearTimeout(timer);
          }
          if (
            state === "connected" &&
            transport.direction === "send" &&
            this.call
          ) {
            this.update("connected");
            void nativeConnected(
              {
                id: this.call.id,
                nativeId: this.call.nativeId,
                kind: this.call.kind,
              },
              true,
            ).catch((error: unknown) => {
              void this.close(
                error instanceof Error
                  ? error.message
                  : "Native call integration failed",
              );
            });
          }
          if (state === "failed" || state === "disconnected")
            void this.repair(transport);
        });
      }
      this.send.on(
        "produce",
        ({ kind: mediaKind, rtpParameters }, callback, errback) => {
          void this.rpc<{ id: string }>({
            type: "produce",
            transportId: this.send!.id,
            kind: mediaKind,
            rtpParameters,
          })
            .then(callback)
            .catch(errback);
        },
      );
      await nativeOutgoing(
        {
          id: joined.data.id,
          nativeId: joined.data.nativeId,
          kind: joined.data.kind,
        },
        name,
      );
      for (const track of stream.getTracks()) {
        if (this.closed) return;
        if (track.kind === "video" && joined.data.kind === "audio") {
          track.stop();
          continue;
        }
        // mediasoup uses DOM declarations; registerGlobals supplies these actual native track objects.
        await this.send.produce({
          track: track as unknown as globalThis.MediaStreamTrack,
        });
      }
      const synchronize = async () => {
        if (this.closed || this.polling || !this.receive || !this.rtc) return;
        this.polling = true;
        try {
          const state = await this.rpc<{
            routerId: string;
            producers: {
              id: string;
              userId: string;
              kind: "audio" | "video";
            }[];
          }>({ type: "state" });
          if (state.routerId !== this.call?.routerId) {
            await this.close("The call server restarted. Join the call again.");
            return;
          }
          const present = new Set(
            state.producers.map((producer) => producer.id),
          );
          for (const [id, value] of this.consumers)
            if (!present.has(id)) {
              value.consumer.close();
              value.remote.stream.release();
              this.consumers.delete(id);
            }
          for (const producer of state.producers) {
            if (this.closed || this.consumers.has(producer.id)) continue;
            const value = await this.rpc<{
              id: string;
              producerId: string;
              kind: "audio" | "video";
              rtpParameters: types.RtpParameters;
              userId: string;
            }>({
              type: "consume",
              transportId: this.receive.id,
              producerId: producer.id,
              rtpCapabilities: device.rtpCapabilities,
            });
            const consumer = await this.receive.consume(value);
            const media = new this.rtc.MediaStream([
              consumer.track as unknown as MediaStreamTrack,
            ]);
            this.consumers.set(producer.id, {
              consumer,
              remote: {
                producerId: producer.id,
                userId: value.userId,
                kind: value.kind,
                stream: media,
              },
            });
            await this.rpc({ type: "resume", consumerId: consumer.id });
          }
          this.failures = 0;
          this.update(
            this.send?.connectionState === "connected"
              ? "connected"
              : "connecting",
          );
        } catch (error) {
          this.failures += 1;
          if (this.failures >= 3) {
            await this.close(
              error instanceof Error
                ? error.message
                : "Group call disconnected",
            );
            return;
          }
          this.update("connecting");
        } finally {
          this.polling = false;
          if (!this.closed)
            this.timer = setTimeout(() => void synchronize(), 2000);
        }
      };
      await synchronize();
    } catch (error) {
      await this.close(
        error instanceof Error ? error.message : "Couldn't join the group call",
      );
    }
  }
  mute(muted: boolean) {
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
  }
  camera(enabled: boolean) {
    this.stream?.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }
  nativeId() {
    return this.call?.nativeId;
  }
  private async leaveServer() {
    if (this.call)
      await request<void>(`/group-calls/${this.call.id}/leave`, {
        method: "POST",
        body: JSON.stringify({ sessionId: this.sessionId }),
      });
  }
  async close(error?: string) {
    if (this.closed) return;
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    for (const timer of this.repairTimers.values()) clearTimeout(timer);
    this.repairTimers.clear();
    this.repairAttempts.clear();
    this.send?.close();
    this.receive?.close();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream?.release();
    this.stream = null;
    for (const value of this.consumers.values()) {
      value.consumer.close();
      value.remote.stream.release();
    }
    this.consumers.clear();
    if (this.call) nativeEnd(this.call.nativeId);
    try {
      await this.leaveServer();
    } catch {
      error =
        error ||
        "Media stopped. The server will expire your disconnected call shortly.";
    }
    this.update("ended", error);
  }
}
