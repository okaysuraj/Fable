import {
  createContext,
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
import Constants from "expo-constants";
import { useReducedMotion } from "react-native-reanimated";
import type {
  MediaStream,
  RTCPeerConnection,
  RTCView,
} from "react-native-webrtc";
import { api } from "@/services/api";
import type { CallSession } from "@/types/chat";
import { useBrutalTheme } from "@/hooks/use-brutal-theme";
import { AppIcon } from "../ui/AppIcon";
import { MotionPressable as Pressable } from "../ui/MotionPressable";

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
  const setPhase = (value: Phase) => {
    setPhaseState(value);
    onActiveChange(value !== "idle");
  };
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [Video, setVideo] = useState<typeof RTCView | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const callRef = useRef<CallSession | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const cleanup = () => {
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
    if (Constants.appOwnership === "expo")
      throw new Error(
        "Calling requires a Fable development build. Messaging works in Expo Go.",
      );
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
    if (
      !mounted.current ||
      generation.current !== epoch ||
      AppState.currentState !== "active"
    ) {
      stream.getTracks().forEach((t) => t.stop());
      stream.release();
      throw new Error("Call cancelled");
    }
    streamRef.current = stream;
    setLocal(stream);
    setVideo(() => rtc.RTCView);
    const peer = new rtc.RTCPeerConnection({
      iceServers: config.data.iceServers,
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
      if (peer.connectionState === "connected") setPhase("connected");
      else if (peer.connectionState === "disconnected") setPhase("connecting");
      else if (peer.connectionState === "failed")
        void fail(
          new Error(
            "Media connection failed. A TURN relay may be needed between these networks.",
          ),
        );
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
      const result = await api.updateCall(current.id, "answer", description);
      if (generation.current !== epoch || !mounted.current) return;
      if (result.data.status !== "active")
        throw new Error("This call has already ended.");
      remember(result.data);
      setPhase(
        peer.connectionState === "connected" ? "connected" : "connecting",
      );
    } catch (failure) {
      if (generation.current === epoch && mounted.current) await fail(failure);
    } finally {
      if (generation.current === epoch) busy.current = false;
    }
  };
  const pollRef = useRef<() => Promise<void>>(async () => {});
  const pollLatest = async () => {
    if (AppState.currentState !== "active" || busy.current) return;
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
        setPhase("incoming");
        setError("");
        setName(result.callerName || "Incoming call");
      } else {
        const result = await api.updateCall(current.id, "poll");
        if (
          !mounted.current ||
          callRef.current?.id !== current.id ||
          generation.current !== epoch
        )
          return;
        if (["ended", "declined"].includes(result.data.status)) {
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
          result.data.answer &&
          current.callerId === userId &&
          peer &&
          !peer.remoteDescription
        ) {
          await peer.setRemoteDescription({
            type: "answer",
            sdp: result.data.answer,
          });
          if (mounted.current && generation.current === epoch)
            setPhase(
              peer.connectionState === "connected" ? "connected" : "connecting",
            );
        }
        remember(result.data);
      }
    } catch (failure) {
      if (mounted.current && current && generation.current === epoch)
        await fail(failure);
    }
  };
  const failRef = useRef(fail);
  useLayoutEffect(() => {
    pollRef.current = pollLatest;
    failRef.current = fail;
  });
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
      // Background calling needs OS call integration; stop capture explicitly for this foreground implementation.
      if (
        state === "background" &&
        (callRef.current || streamRef.current || busy.current)
      )
        void failRef.current(
          new Error("Call stopped when Fable went into the background."),
        );
      else if (state === "active") void poll();
    });
    return () => {
      mounted.current = false;
      onActiveChange(false);
      generation.current += 1;
      clearInterval(timer);
      subscription.remove();
      const current = callRef.current;
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
                mirror
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
