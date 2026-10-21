import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AppState,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isRunningInExpoGo } from "expo";
import { useReducedMotion } from "react-native-reanimated";
import type {
  MediaStream,
  RTCPeerConnection,
  RTCView,
} from "react-native-webrtc";
import { api, ApiError } from "@/services/api";
import type { CallSession } from "@/types/chat";
import { useBrutalTheme } from "@/hooks/use-brutal-theme";
import { AppIcon } from "../ui/AppIcon";
import { MotionPressable as Pressable } from "../ui/MotionPressable";
import { subscribeRealtime } from "@/services/realtime";
import { CallAudioOutput, CallSwitchCamera } from "./CallDeviceControls";
import {
  initializeNativeCalls,
  nativeOutgoing,
  nativeConnected,
  nativeEnd,
  nativeMute,
  showNativeIncoming,
  subscribeNativeCalls,
  pendingNativeCall,
} from "@/services/nativeCalls";

const Calling = createContext<{
  start: (id: string, kind: "audio" | "video", name: string) => void;
} | null>(null);
export function useCalling() {
  const context = useContext(Calling);
  if (!context) throw new Error("Calling provider is missing");
  return context;
}
type Phase =
  | "idle"
  | "incoming"
  | "preparing"
  | "ringing"
  | "connecting"
  | "connected"
  | "finished";
async function gather(peer: RTCPeerConnection) {
  if (peer.iceGatheringState !== "complete")
    await new Promise<void>((resolve, reject) => {
      const done = () => {
        clearTimeout(timer);
        peer.removeEventListener("icegatheringstatechange", changed);
        resolve();
      };
      const changed = () => {
        if (peer.iceGatheringState === "complete") done();
      };
      const timer = setTimeout(() => {
        peer.removeEventListener("icegatheringstatechange", changed);
        reject(new Error("Could not establish a network route for the call."));
      }, 12000);
      peer.addEventListener("icegatheringstatechange", changed);
      changed();
    });
  const description = peer.localDescription?.sdp;
  if (!description)
    throw new Error("Call setup did not produce a media offer.");
  return description;
}

/** Native WebRTC is loaded only on a call action; ordinary messaging still works in Expo Go. */
export function CallingProvider({
  userId,
  onActiveChange,
  children,
}: {
  userId: string;
  onActiveChange: (active: boolean) => void;
  children: ReactNode;
}) {
  const colors = useBrutalTheme();
  const reduceMotion = useReducedMotion();
  const [call, setCall] = useState<CallSession | null>(null);
  const [phase, setPhaseState] = useState<Phase>("idle");
  const setPhase = useCallback(
    (value: Phase) => {
      setPhaseState(value);
      onActiveChange(value !== "idle");
    },
    [onActiveChange],
  );
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [Video, setVideo] = useState<typeof RTCView | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [frontCamera, setFrontCamera] = useState(true);
  const cameraOffRef = useRef(cameraOff);
  useLayoutEffect(() => {
    cameraOffRef.current = cameraOff;
  }, [cameraOff]);
  const callRef = useRef<CallSession | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const appliedOffer = useRef<string | null>(null);
  const appliedAnswer = useRef<string | null>(null);
  const restarting = useRef(false);
  const repairAttempts = useRef(0);
  const pollFailures = useRef(0);
  const pollInFlight = useRef(false);
  const repairTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repairRef = useRef<() => Promise<void>>(async () => {});
  const cleanup = () => {
    if (repairTimer.current) clearTimeout(repairTimer.current);
    repairTimer.current = null;
    appliedOffer.current = null;
    appliedAnswer.current = null;
    restarting.current = false;
    repairAttempts.current = 0;
    pollFailures.current = 0;
    peerRef.current?.close();
    peerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current?.release();
    streamRef.current = null;
    if (mounted.current) {
      setLocal(null);
      setRemote(null);
      setMuted(false);
      setCameraOff(false);
      setFrontCamera(true);
    }
  };
  const remember = (value: CallSession | null) => {
    callRef.current = value;
    setCall(value);
  };
  const finish = async (action: "end" | "decline" = "end") => {
    generation.current += 1;
    busy.current = false;
    const current = callRef.current;
    if (current) nativeEnd(current.nativeId);
    remember(null);
    cleanup();
    setPhase("idle");
    if (current)
      try {
        await api.updateCall(current.id, action);
      } catch (failure) {
        if (mounted.current) {
          setError(
            `Camera and microphone stopped. ${failure instanceof Error ? failure.message : "Could not notify the other person."}`,
          );
          setPhase("finished");
        }
      }
  };
  const fail = async (failure: unknown) => {
    const message =
      failure instanceof Error
        ? failure.message
        : "The call could not connect.";
    await finish();
    if (mounted.current) {
      setError(message);
      setPhase("finished");
    }
  };
  const prepare = async (kind: "audio" | "video", epoch: number) => {
    if (Platform.OS === "web")
      throw new Error("Use the Fable web app for browser calls.");
    if (isRunningInExpoGo())
      throw new Error(
        "Calling requires a Fable development build. Messaging works in Expo Go.",
      );
    await initializeNativeCalls();
    let rtc: typeof import("react-native-webrtc");
    try {
      rtc = await import("react-native-webrtc");
    } catch {
      throw new Error(
        "Install a new Fable development build with camera and microphone support to call.",
      );
    }
    const config = await api.callConfig();
    const stream = await rtc.mediaDevices.getUserMedia({
      audio: true,
      video:
        kind === "video"
          ? { facingMode: "user", width: 1280, height: 720, frameRate: 30 }
          : false,
    });
    if (!mounted.current || generation.current !== epoch) {
      stream.getTracks().forEach((t) => t.stop());
      stream.release();
      throw new Error("Call cancelled");
    }
    streamRef.current = stream;
    setLocal(stream);
    setVideo(() => rtc.RTCView);
    const peer = new rtc.RTCPeerConnection({
      iceServers: config.data.iceServers,
      iceTransportPolicy: config.data.iceTransportPolicy,
    });
    peerRef.current = peer;
    for (const track of stream.getTracks()) peer.addTrack(track, stream);
    peer.addEventListener("track", (event) => {
      if (generation.current === epoch && mounted.current)
        setRemote(
          event.streams[0] ||
            (event.track ? new rtc.MediaStream([event.track]) : null),
        );
    });
    peer.addEventListener("connectionstatechange", () => {
      if (generation.current !== epoch || !mounted.current) return;
      if (peer.connectionState === "connected") {
        setPhase("connected");
        repairAttempts.current = 0;
      } else if (
        peer.connectionState === "disconnected" ||
        peer.connectionState === "failed"
      ) {
        setPhase("connecting");
        if (repairTimer.current) clearTimeout(repairTimer.current);
        repairTimer.current = setTimeout(
          () => void repairRef.current(),
          peer.connectionState === "failed" ? 0 : 2000,
        );
      }
    });
    return peer;
  };
  const start = async (
    channelId: string,
    kind: "audio" | "video",
    displayName: string,
  ) => {
    if (busy.current || callRef.current) return;
    busy.current = true;
    const epoch = ++generation.current;
    setName(displayName);
    setError("");
    setPhase("preparing");
    try {
      const peer = await prepare(kind, epoch);
      await peer.setLocalDescription(await peer.createOffer({}));
      const offer = await gather(peer);
      if (generation.current !== epoch) return;
      const result = await api.startCall(channelId, kind, offer);
      if (generation.current !== epoch || !mounted.current) {
        await api.updateCall(result.data.id, "end");
        return;
      }
      remember(result.data);
      await nativeOutgoing(result.data, displayName);
      if (generation.current !== epoch || !mounted.current) {
        nativeEnd(result.data.nativeId);
        return;
      }
      setPhase("ringing");
    } catch (failure) {
      if (generation.current === epoch && mounted.current) await fail(failure);
    } finally {
      if (generation.current === epoch) busy.current = false;
    }
  };
  const answer = async () => {
    const current = callRef.current;
    if (!current?.offer || busy.current) return;
    busy.current = true;
    const epoch = ++generation.current;
    setError("");
    setPhase("preparing");
    try {
      const peer = await prepare(current.kind, epoch);
      await peer.setRemoteDescription({ type: "offer", sdp: current.offer });
      await peer.setLocalDescription(await peer.createAnswer());
      const description = await gather(peer);
      if (generation.current !== epoch) return;
      const result = await api.updateCall(
        current.id,
        "answer",
        description,
        current.offerHash || undefined,
      );
      if (generation.current !== epoch || !mounted.current) return;
      if (result.data.status !== "active")
        throw new Error("This call has already ended.");
      remember(result.data);
      appliedOffer.current = current.offerHash;
      setPhase(
        peer.connectionState === "connected" ? "connected" : "connecting",
      );
    } catch (failure) {
      if (generation.current === epoch && mounted.current) await fail(failure);
    } finally {
      if (generation.current === epoch) busy.current = false;
    }
  };
  const repair = async () => {
    const current = callRef.current;
    const peer = peerRef.current;
    if (
      !current ||
      !peer ||
      current.status !== "active" ||
      busy.current ||
      restarting.current
    )
      return;
    if (repairAttempts.current >= 3) {
      await fail(
        new Error(
          "The call couldn't reconnect. Check your connection and try calling again.",
        ),
      );
      return;
    }
    repairAttempts.current += 1;
    restarting.current = true;
    busy.current = true;
    const epoch = generation.current;
    setPhase("connecting");
    try {
      if (current.callerId === userId) {
        await peer.setLocalDescription(
          await peer.createOffer({ iceRestart: true }),
        );
        const offer = await gather(peer);
        const result = await api.updateCall(
          current.id,
          "restart",
          offer,
          current.offerHash || undefined,
        );
        if (mounted.current && generation.current === epoch)
          remember(result.data);
      } else {
        const result = await api.updateCall(current.id, "request-restart");
        if (mounted.current && generation.current === epoch)
          remember(result.data);
      }
    } catch {
      if (generation.current === epoch) restarting.current = false;
    } finally {
      if (generation.current === epoch) {
        busy.current = false;
        if (repairTimer.current) clearTimeout(repairTimer.current);
        repairTimer.current = setTimeout(() => {
          if (
            restarting.current ||
            peerRef.current?.connectionState !== "connected"
          ) {
            restarting.current = false;
            void repairRef.current();
          }
        }, 15000);
      }
    }
  };
  const pollRef = useRef<() => Promise<void>>(async () => {});
  const pollLatest = async () => {
    if (
      (AppState.currentState !== "active" && !callRef.current) ||
      busy.current
    )
      return;
    if (pollInFlight.current) return;
    pollInFlight.current = true;
    const current = callRef.current;
    const epoch = generation.current;
    try {
      if (!current) {
        const result = await api.incomingCall();
        if (
          !mounted.current ||
          callRef.current ||
          busy.current ||
          generation.current !== epoch ||
          !result.data
        )
          return;
        remember(result.data);
        await showNativeIncoming({
          callId: result.data.id,
          nativeId: result.data.nativeId,
          callerName: result.callerName || "Incoming call",
          kind: result.data.kind,
        });
        setPhase("incoming");
        setError("");
        setName(result.callerName || "Incoming call");
      } else {
        const result = await api.updateCall(current.id, "poll");
        pollFailures.current = 0;
        if (
          !mounted.current ||
          callRef.current?.id !== current.id ||
          generation.current !== epoch
        )
          return;
        if (["ended", "declined"].includes(result.data.status)) {
          nativeEnd(current.nativeId);
          generation.current += 1;
          remember(null);
          cleanup();
          setError(
            result.data.status === "declined" ? "Call declined" : "Call ended",
          );
          setPhase("finished");
          return;
        }
        const peer = peerRef.current;
        if (
          peer &&
          result.data.status === "active" &&
          current.calleeId === userId &&
          result.data.offer &&
          result.data.offerHash !== appliedOffer.current
        ) {
          busy.current = true;
          try {
            await peer.setRemoteDescription({
              type: "offer",
              sdp: result.data.offer,
            });
            await peer.setLocalDescription(await peer.createAnswer());
            const answer = await gather(peer);
            const accepted = await api.updateCall(
              current.id,
              "answer",
              answer,
              result.data.offerHash || undefined,
            );
            if (!mounted.current || generation.current !== epoch) return;
            appliedOffer.current = result.data.offerHash;
            restarting.current = false;
            if (repairTimer.current) clearTimeout(repairTimer.current);
            remember(accepted.data);
            setPhase(
              peer.connectionState === "connected" ? "connected" : "connecting",
            );
            return;
          } finally {
            busy.current = false;
          }
        }
        if (
          peer &&
          result.data.status === "active" &&
          current.callerId === userId &&
          !result.data.answer &&
          peer.remoteDescription &&
          !restarting.current
        ) {
          remember(result.data);
          await repair();
          return;
        }
        if (
          result.data.answer &&
          current.callerId === userId &&
          peer &&
          appliedAnswer.current !== result.data.answer
        ) {
          await peer.setRemoteDescription({
            type: "answer",
            sdp: result.data.answer,
          });
          appliedAnswer.current = result.data.answer;
          restarting.current = false;
          if (repairTimer.current) clearTimeout(repairTimer.current);
          if (mounted.current && generation.current === epoch)
            setPhase(
              peer.connectionState === "connected" ? "connected" : "connecting",
            );
        }
        remember(result.data);
      }
    } catch (failure) {
      if (mounted.current && current && generation.current === epoch) {
        pollFailures.current += 1;
        if (
          pollFailures.current >= 3 ||
          (failure instanceof ApiError &&
            [401, 403, 404, 410].includes(failure.status))
        )
          await fail(failure);
        else setPhase("connecting");
      }
    } finally {
      pollInFlight.current = false;
    }
  };
  const failRef = useRef(fail);
  const answerRef = useRef(answer);
  const finishRef = useRef(finish);
  useLayoutEffect(() => {
    pollRef.current = pollLatest;
    failRef.current = fail;
    answerRef.current = answer;
    finishRef.current = finish;
    repairRef.current = repair;
  });
  useEffect(
    () =>
      subscribeRealtime((event) => {
        if (event.type === "call.updated" || event.type === "ready")
          void pollRef.current();
      }),
    [],
  );
  useEffect(
    () =>
      subscribeNativeCalls((action) => {
        void (async () => {
          let current = callRef.current;
          if (
            current &&
            current.nativeId.toLowerCase() !== action.nativeId.toLowerCase()
          )
            return;
          if (!current) {
            current = await pendingNativeCall(action.nativeId);
            if (
              !current ||
              current.calleeId !== userId ||
              current.status !== "ringing"
            ) {
              if (action.type === "answer") nativeEnd(action.nativeId);
              return;
            }
            remember(current);
            setName("Incoming call");
            setPhase("incoming");
          }
          if (action.type === "answer") await answerRef.current();
          if (action.type === "end")
            await finishRef.current(
              current.status === "ringing" && current.calleeId === userId
                ? "decline"
                : "end",
            );
          if (action.type === "mute") {
            streamRef.current?.getAudioTracks().forEach((track) => {
              track.enabled = !action.muted;
            });
            setMuted(action.muted ?? false);
          }
        })().catch((failure: unknown) => {
          void failRef.current(failure);
        });
      }),
    [userId, setPhase],
  );
  useEffect(() => {
    const current = callRef.current;
    if (phase === "connected" && current)
      void nativeConnected(current, current.callerId === userId).catch(
        (failure: unknown) => {
          void failRef.current(failure);
        },
      );
  }, [phase, userId]);
  useEffect(() => {
    mounted.current = true;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        await pollRef.current();
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 3000);
    const subscription = AppState.addEventListener("change", (state) => {
      // Audio continues through the system call service; camera capture pauses offscreen.
      if (state === "background")
        streamRef.current?.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      else if (state === "active") {
        streamRef.current?.getVideoTracks().forEach((track) => {
          track.enabled = !cameraOffRef.current;
        });
        void poll();
      }
    });
    return () => {
      mounted.current = false;
      onActiveChange(false);
      generation.current += 1;
      clearInterval(timer);
      subscription.remove();
      const current = callRef.current;
      if (current) nativeEnd(current.nativeId);
      callRef.current = null;
      cleanup();
      if (current)
        void api.updateCall(current.id, "end").catch(() => {
          /* Lost connections are cleared by server leases. */
        });
    };
  }, [onActiveChange]);
  useEffect(() => {
    if (phase !== "connecting") return;
    const timer = setTimeout(
      () =>
        void failRef.current(
          new Error(
            "The call could not connect. Check the network and TURN relay configuration.",
          ),
        ),
      45000,
    );
    return () => clearTimeout(timer);
  }, [phase]);
  return (
    <Calling.Provider
      value={{
        start: (id, kind, displayName) => {
          void start(id, kind, displayName);
        },
      }}
    >
      {children}
      <Modal
        visible={phase !== "idle"}
        animationType={reduceMotion ? "none" : "slide"}
        onRequestClose={() =>
          void finish(phase === "incoming" ? "decline" : "end")
        }
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPaper }}>
          <ScrollView contentContainerStyle={styles.sheet}>
            <View
              style={[styles.avatar, { backgroundColor: colors.bgCardAlt }]}
            >
              <Text style={{ fontSize: 36, color: colors.primary }}>
                {name.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text
              accessibilityRole="header"
              style={{
                fontSize: 32,
                fontWeight: "600",
                color: colors.ink,
                textAlign: "center",
              }}
            >
              {name}
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={{
                color: colors.inkMuted,
                textAlign: "center",
                fontSize: 16,
              }}
            >
              {error ||
                {
                  incoming: `Incoming ${call?.kind || "audio"} call`,
                  preparing: "Preparing camera and microphone…",
                  ringing: "Calling…",
                  connecting: "Connecting…",
                  connected:
                    call?.kind === "video" ? "Video call" : "Audio call",
                  finished: "Call ended",
                  idle: "",
                }[phase]}
            </Text>
            {Video && remote && call?.kind === "video" && (
              <Video
                streamURL={remote.toURL()}
                objectFit="cover"
                style={styles.remote}
              />
            )}
            {Video && local && call?.kind === "video" && (
              <Video
                streamURL={local.toURL()}
                mirror={frontCamera}
                objectFit="cover"
                style={styles.local}
              />
            )}
            <View style={styles.controls}>
              {phase === "incoming" ? (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Answer call"
                    style={[styles.button, { backgroundColor: colors.primary }]}
                    onPress={() => void answer()}
                  >
                    <AppIcon name="callFilled" size={25} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Answer</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.button, styles.end]}
                    onPress={() => void finish("decline")}
                  >
                    <AppIcon name="callFilled" size={25} color="#FFFFFF" />
                    <Text style={styles.buttonText}>Decline</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {local && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: muted }}
                      style={[
                        styles.button,
                        { backgroundColor: colors.primary },
                      ]}
                      onPress={() => {
                        local.getAudioTracks().forEach((t) => {
                          t.enabled = muted;
                        });
                        setMuted(!muted);
                        if (callRef.current)
                          nativeMute(callRef.current.nativeId, !muted);
                      }}
                    >
                      <AppIcon
                        name={muted ? "microphoneOff" : "microphone"}
                        size={25}
                        color={colors.onPrimary}
                      />
                      <Text style={styles.buttonText}>
                        {muted ? "Unmute" : "Mute"}
                      </Text>
                    </Pressable>
                  )}
                  {local && call?.kind === "video" && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: cameraOff }}
                      style={[
                        styles.button,
                        { backgroundColor: colors.primary },
                      ]}
                      onPress={() => {
                        local.getVideoTracks().forEach((t) => {
                          t.enabled = cameraOff;
                        });
                        setCameraOff(!cameraOff);
                      }}
                    >
                      <AppIcon
                        name={cameraOff ? "videoOff" : "video"}
                        size={25}
                        color={colors.onPrimary}
                      />
                      <Text style={styles.buttonText}>
                        {cameraOff ? "Camera on" : "Camera off"}
                      </Text>
                    </Pressable>
                  )}
                  {local && <CallAudioOutput nativeId={call?.nativeId} />}
                  {local && call?.kind === "video" && !cameraOff && (
                    <CallSwitchCamera
                      stream={local}
                      onSwitched={() => setFrontCamera((value) => !value)}
                    />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.button, styles.end]}
                    onPress={() => void finish()}
                  >
                    <AppIcon
                      name={phase === "finished" ? "close" : "callFilled"}
                      size={25}
                      color="#FFFFFF"
                    />
                    <Text style={styles.buttonText}>
                      {phase === "finished" ? "Close" : "End call"}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Calling.Provider>
  );
}
const styles = StyleSheet.create({
  sheet: {
    flexGrow: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  remote: { width: "100%", height: 320, borderRadius: 24 },
  local: { width: 120, height: 160, borderRadius: 16, alignSelf: "flex-end" },
  controls: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
    marginTop: 20,
  },
  button: {
    gap: 8,
    padding: 16,
    minHeight: 48,
    minWidth: 90,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  end: { backgroundColor: "#BC3445" },
  buttonText: { color: "#FFFFFF", fontWeight: "600" },
});
