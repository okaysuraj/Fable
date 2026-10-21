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
import { AppState, Modal, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { MediaStream, RTCView } from "react-native-webrtc";
import {
  GroupCallConnection,
  type RemoteGroupStream,
} from "@/services/groupCalls";
import { subscribeNativeCalls } from "@/services/nativeCalls";
import { api } from "@/services/api";
import type { User } from "@/types/chat";
import { useBrutalTheme } from "@/hooks/use-brutal-theme";
import { MotionPressable } from "../ui/MotionPressable";
import { AppIcon } from "../ui/AppIcon";
import { UserAvatar } from "../ui/UserAvatar";
import { CallAudioOutput, CallSwitchCamera } from "./CallDeviceControls";

const Context = createContext<{
  start: (channelId: string, kind: "audio" | "video", name: string) => void;
} | null>(null);
export function useGroupCalling() {
  const value = useContext(Context);
  if (!value) throw new Error("Group calling provider is missing");
  return value;
}
export function GroupCallingProvider({
  children,
  onActiveChange,
}: {
  children: ReactNode;
  onActiveChange: (active: boolean) => void;
}) {
  const colors = useBrutalTheme();
  const connection = useRef<GroupCallConnection | null>(null);
  const [state, setState] = useState<{
    nativeId?: string;
    name: string;
    local: MediaStream | null;
    remote: RemoteGroupStream[];
    phase: "connecting" | "connected" | "ended";
    error?: string;
  } | null>(null);
  const [Video, setVideo] = useState<typeof RTCView | null>(null);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [frontCamera, setFrontCamera] = useState(true);
  const cameraOffRef = useRef(cameraOff);
  const mounted = useRef(true);
  useLayoutEffect(() => {
    cameraOffRef.current = cameraOff;
  }, [cameraOff]);
  const start = useCallback(
    (channelId: string, kind: "audio" | "video", name: string) => {
      if (connection.current) return;
      setState({ name, local: null, remote: [], phase: "connecting" });
      setMuted(false);
      setCameraOff(false);
      setFrontCamera(true);
      onActiveChange(true);
      const active = new GroupCallConnection((value) => {
        if (!mounted.current || connection.current !== active) return;
        setState({ name, ...value });
        if (value.phase === "ended") {
          connection.current = null;
          onActiveChange(false);
        }
      });
      connection.current = active;
      void import("react-native-webrtc")
        .then((rtc) => {
          if (mounted.current) setVideo(() => rtc.RTCView);
        })
        .catch(() => {
          void active.close(
            "A Fable development build is required for group calls.",
          );
        });
      void active.start(channelId, kind, name);
    },
    [onActiveChange],
  );
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (status) => {
      connection.current?.camera(status === "active" && !cameraOffRef.current);
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      const active = connection.current;
      connection.current = null;
      if (active) void active.close();
      onActiveChange(false);
    };
  }, [onActiveChange]);
  useEffect(
    () =>
      subscribeNativeCalls((action) => {
        const active = connection.current;
        if (active?.nativeId()?.toLowerCase() !== action.nativeId.toLowerCase())
          return;
        if (action.type === "end") void active?.close();
        if (action.type === "mute") {
          active?.mute(action.muted ?? false);
          setMuted(action.muted ?? false);
        }
      }),
    [],
  );
  const participantIds = [
    ...new Set(state?.remote.map((stream) => stream.userId) || []),
  ]
    .sort()
    .join(",");
  useEffect(() => {
    let alive = true;
    if (participantIds)
      void api
        .fetchGlobalProfiles(participantIds.split(","))
        .then((value) => {
          if (alive) setProfiles(value);
        })
        .catch(() => {
          /* Streams remain usable while authorized profile names reload. */
        });
    return () => {
      alive = false;
    };
  }, [participantIds]);
  return (
    <Context.Provider value={{ start }}>
      {children}
      <Modal
        visible={state !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          const active = connection.current;
          if (active) void active.close();
          else setState(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgPaper }}>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 28, fontWeight: "600", color: colors.ink }}
            >
              {state?.name}
            </Text>
            <Text
              accessibilityLiveRegion="polite"
              style={{ color: colors.inkMuted }}
            >
              {state?.error ||
                (state?.phase === "connecting"
                  ? "Connecting to group call…"
                  : state?.phase === "ended"
                    ? "Call ended"
                    : "Group call")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {participantIds
                .split(",")
                .filter(Boolean)
                .map((id) => {
                  const profile = profiles.find((entry) => entry.id === id);
                  const video = state?.remote.find(
                    (stream) => stream.userId === id && stream.kind === "video",
                  );
                  return (
                    <View
                      key={id}
                      style={{
                        width: "47%",
                        minHeight: 180,
                        backgroundColor: colors.bgCard,
                        borderRadius: 20,
                        padding: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                      }}
                    >
                      {video && Video ? (
                        <Video
                          streamURL={video.stream.toURL()}
                          objectFit="cover"
                          style={{
                            width: "100%",
                            height: 160,
                            borderRadius: 12,
                          }}
                        />
                      ) : profile ? (
                        <UserAvatar user={profile} size={60} />
                      ) : (
                        <AppIcon name="profile" size={48} />
                      )}
                      <Text style={{ color: colors.ink }}>
                        {profile?.name || "Participant"}
                      </Text>
                    </View>
                  );
                })}
            </View>
            {!participantIds && state?.phase === "connected" && (
              <Text style={{ color: colors.inkMuted }}>
                You’re the first person here. Other group members can join from
                the chat.
              </Text>
            )}
            {state?.local?.getVideoTracks().length && Video ? (
              <Video
                streamURL={state.local.toURL()}
                mirror={frontCamera}
                objectFit="cover"
                style={{
                  width: 140,
                  height: 180,
                  alignSelf: "center",
                  borderRadius: 16,
                }}
              />
            ) : null}
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 16,
              }}
            >
              {state?.phase !== "ended" && (
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    muted ? "Unmute microphone" : "Mute microphone"
                  }
                  onPress={() => {
                    connection.current?.mute(!muted);
                    setMuted(!muted);
                  }}
                  style={{
                    padding: 20,
                    borderRadius: 30,
                    backgroundColor: colors.bgCard,
                  }}
                >
                  <AppIcon
                    name={muted ? "microphoneOff" : "microphone"}
                    size={26}
                  />
                </MotionPressable>
              )}
              {state?.local?.getVideoTracks().length &&
              state.phase !== "ended" ? (
                <MotionPressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    cameraOff ? "Enable camera" : "Disable camera"
                  }
                  onPress={() => {
                    connection.current?.camera(cameraOff);
                    setCameraOff(!cameraOff);
                  }}
                  style={{
                    padding: 20,
                    borderRadius: 30,
                    backgroundColor: colors.bgCard,
                  }}
                >
                  <AppIcon name={cameraOff ? "videoOff" : "video"} size={26} />
                </MotionPressable>
              ) : null}
              {state?.phase !== "ended" && (
                <CallAudioOutput nativeId={state?.nativeId} />
              )}
              {state?.phase !== "ended" &&
                state?.local &&
                state.local.getVideoTracks().length > 0 &&
                !cameraOff && (
                  <CallSwitchCamera
                    stream={state.local}
                    onSwitched={() => setFrontCamera((value) => !value)}
                  />
                )}
              <MotionPressable
                accessibilityRole="button"
                accessibilityLabel={
                  state?.phase === "ended" ? "Close call" : "Leave call"
                }
                onPress={() => {
                  const active = connection.current;
                  if (active) void active.close();
                  else setState(null);
                }}
                style={{
                  padding: 20,
                  borderRadius: 30,
                  backgroundColor: "#D9304F",
                }}
              >
                <AppIcon
                  name={state?.phase === "ended" ? "close" : "call"}
                  size={26}
                  color="#FFFFFF"
                />
              </MotionPressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Context.Provider>
  );
}
