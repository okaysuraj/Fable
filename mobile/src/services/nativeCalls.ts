import { Platform } from "react-native";
import { isRunningInExpoGo, requireOptionalNativeModule } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type CallKeep from "react-native-callkeep";
import { request } from "./session";
import type { CallSession } from "@/types/chat";

interface VoipModule {
  addListener(
    name: "tokenChanged",
    listener: (event: { token: string }) => void,
  ): { remove(): void };
  setEnabled(enabled: boolean): Promise<void>;
  getToken(): Promise<string | null>;
  getPendingCall(): Promise<{
    nativeId: string;
    callId: string;
    callerName: string;
    receivedAt: number;
  } | null>;
  acknowledge(uuid: string): Promise<void>;
}
export const voip =
  Platform.OS === "ios"
    ? requireOptionalNativeModule<VoipModule>("FableVoip")
    : null;
type Action = {
  type: "answer" | "end" | "mute";
  nativeId: string;
  muted?: boolean;
};
const listeners = new Set<(action: Action) => void>();
const queued: Action[] = [];
const displayed = new Set<string>();
let initialized: Promise<typeof CallKeep | null> | undefined;
let keep: typeof CallKeep | null = null;
const PENDING_KEY = "fable_incoming_call";
function dispatch(action: Action) {
  if (!listeners.size) {
    if (queued.length < 20) queued.push(action);
    void AsyncStorage.setItem(
      "fable_pending_native_action",
      JSON.stringify({ ...action, receivedAt: Date.now() }),
    );
    if (action.type === "answer" && Platform.OS === "android")
      keep?.backToForeground();
  } else for (const listener of listeners) listener(action);
}
export function subscribeNativeCalls(listener: (action: Action) => void) {
  listeners.add(listener);
  for (const action of queued.splice(0)) listener(action);
  let alive = true;
  void AsyncStorage.getItem("fable_pending_native_action").then(
    async (value) => {
      if (!value || !alive) return;
      await AsyncStorage.removeItem("fable_pending_native_action");
      const data: unknown = JSON.parse(value);
      if (
        data &&
        typeof data === "object" &&
        "type" in data &&
        ["answer", "end"].includes(String(data.type)) &&
        "nativeId" in data &&
        typeof data.nativeId === "string" &&
        "receivedAt" in data &&
        typeof data.receivedAt === "number" &&
        Date.now() - data.receivedAt < 90000
      )
        listener({
          type: data.type as "answer" | "end",
          nativeId: data.nativeId,
        });
    },
  );
  return () => {
    alive = false;
    listeners.delete(listener);
  };
}
async function initialize() {
  if (Platform.OS === "web" || isRunningInExpoGo()) return null;
  const module = (await import("react-native-callkeep")).default;
  keep = module;
  await module.setup({
    ios: {
      appName: "Fable",
      supportsVideo: true,
      maximumCallGroups: "1",
      maximumCallsPerCallGroup: "1",
      includesCallsInRecents: false,
    },
    android: {
      alertTitle: "Enable Fable calls",
      alertDescription: "Allow Fable to show and manage your internet calls.",
      cancelButton: "Cancel",
      okButton: "Continue",
      additionalPermissions: [],
      selfManaged: false,
      endCallsWhenReactNativeStops: true,
      foregroundService: {
        channelId: "fable-calls",
        channelName: "Ongoing calls",
        notificationTitle: "Fable call in progress",
      },
    },
  });
  module.addEventListener("answerCall", ({ callUUID }) =>
    dispatch({ type: "answer", nativeId: callUUID }),
  );
  module.addEventListener("endCall", ({ callUUID }) =>
    dispatch({ type: "end", nativeId: callUUID }),
  );
  module.addEventListener(
    "didPerformSetMutedCallAction",
    ({ callUUID, muted }) =>
      dispatch({ type: "mute", nativeId: callUUID, muted }),
  );
  if (Platform.OS === "ios") {
    module.addEventListener("didActivateAudioSession", () => {
      void import("react-native-webrtc").then((rtc) =>
        rtc.RTCAudioSession.audioSessionDidActivate(),
      );
    });
    module.addEventListener("didDeactivateAudioSession", () => {
      void import("react-native-webrtc").then((rtc) =>
        rtc.RTCAudioSession.audioSessionDidDeactivate(),
      );
    });
  }
  if (Platform.OS === "android") module.setAvailable(true);
  const initial = await module.getInitialEvents();
  for (const event of initial) {
    if (event.name === "RNCallKeepPerformAnswerCallAction")
      dispatch({ type: "answer", nativeId: event.data.callUUID });
    if (event.name === "RNCallKeepPerformEndCallAction")
      dispatch({ type: "end", nativeId: event.data.callUUID });
  }
  module.clearInitialEvents();
  keep = module;
  return module;
}
export function initializeNativeCalls() {
  const operation = (initialized ??= initialize().catch((error: unknown) => {
    initialized = undefined;
    throw error;
  }));
  return operation.then((module) => {
    if (module && Platform.OS === "android") module.setAvailable(true);
    return module;
  });
}
export async function showNativeIncoming(data: unknown) {
  if (
    !data ||
    typeof data !== "object" ||
    !("callId" in data) ||
    !("nativeId" in data) ||
    typeof data.callId !== "string" ||
    typeof data.nativeId !== "string"
  )
    return;
  // Persist only identifiers so cold-start answer/reject actions can resolve the authorized call.
  const pending = {
    callId: data.callId,
    nativeId: data.nativeId,
    receivedAt: Date.now(),
  };
  const nativeId = data.nativeId;
  await AsyncStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  const module = await initializeNativeCalls();
  if (!module || displayed.has(nativeId)) return;
  const appleCalls =
    Platform.OS === "ios" ? await module.getCalls() : undefined;
  if (
    appleCalls &&
    appleCalls.some(
      (call) => call.callUUID.toLowerCase() === nativeId.toLowerCase(),
    )
  )
    return;
  displayed.add(data.nativeId);
  module.displayIncomingCall(
    data.nativeId,
    data.callId,
    "callerName" in data && typeof data.callerName === "string"
      ? data.callerName
      : "Fable call",
    "generic",
    "kind" in data && data.kind === "video",
  );
}
export async function pendingNativeCall(
  nativeId: string,
): Promise<CallSession | null> {
  const apple = await voip?.getPendingCall();
  const stored = await AsyncStorage.getItem(PENDING_KEY);
  let callId: string | undefined;
  if (
    apple?.nativeId.toLowerCase() === nativeId.toLowerCase() &&
    Date.now() / 1000 - apple.receivedAt < 90
  )
    callId = apple.callId;
  if (!callId && stored) {
    const parsed: unknown = JSON.parse(stored);
    if (
      parsed &&
      typeof parsed === "object" &&
      "nativeId" in parsed &&
      typeof parsed.nativeId === "string" &&
      parsed.nativeId.toLowerCase() === nativeId.toLowerCase() &&
      "callId" in parsed &&
      typeof parsed.callId === "string" &&
      "receivedAt" in parsed &&
      typeof parsed.receivedAt === "number" &&
      Date.now() - parsed.receivedAt < 90000
    )
      callId = parsed.callId;
  }
  if (!callId) return null;
  return (
    await request<{ data: CallSession }>(`/calls/${encodeURIComponent(callId)}`)
  ).data;
}
export async function nativeOutgoing(
  call: Pick<CallSession, "id" | "nativeId" | "kind">,
  name: string,
) {
  const module = await initializeNativeCalls();
  module?.startCall(
    call.nativeId,
    call.id,
    name,
    "generic",
    call.kind === "video",
  );
}
export async function nativeConnected(
  call: Pick<CallSession, "id" | "nativeId" | "kind">,
  outgoing: boolean,
) {
  await voip?.acknowledge(call.nativeId);
  if (Platform.OS === "android") keep?.setCurrentCallActive(call.nativeId);
  else if (outgoing) keep?.reportConnectedOutgoingCallWithUUID(call.nativeId);
}
export function nativeEnd(nativeId: string) {
  keep?.reportEndCallWithUUID(nativeId, 2);
  displayed.delete(nativeId);
  void voip?.acknowledge(nativeId);
}
export function nativeMute(nativeId: string, muted: boolean) {
  keep?.setMutedCall(nativeId, muted);
}
export async function nativeAudioRoutes() {
  const module = await initializeNativeCalls();
  if (!module)
    throw new Error("Audio routing requires an installed Fable app.");
  const routes = await module.getAudioRoutes();
  if (!routes.length)
    throw new Error("No audio outputs are currently available.");
  return routes;
}
export async function nativeAudioRoute(nativeId: string, name: string) {
  const module = await initializeNativeCalls();
  if (!module)
    throw new Error("Audio routing requires an installed Fable app.");
  await module.setAudioRoute(nativeId, name);
}
export async function clearNativeCalls() {
  keep?.endAllCalls();
  queued.splice(0);
  displayed.clear();
  await AsyncStorage.removeItem(PENDING_KEY);
  await AsyncStorage.removeItem("fable_pending_native_action");
  await voip?.setEnabled(false);
  if (Platform.OS === "android") keep?.setAvailable(false);
}
