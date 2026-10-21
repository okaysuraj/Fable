import { Platform, AppState } from "react-native";
import * as Device from "expo-device";
import * as Application from "expo-application";
import * as SecureStore from "expo-secure-store";
import { randomUUID } from "expo-crypto";
import { request, getSessionToken } from "./session";
import { INCOMING_CALL_TASK, receiveCallPush } from "./backgroundCalls";
import { initializeNativeCalls, clearNativeCalls, voip } from "./nativeCalls";
import { getNotificationRuntime } from "./notificationRuntime";

const INSTALLATION_KEY = "fable_push_installation";
const taps = new Set<(data: NotificationDestination) => void>();
export interface NotificationDestination {
  channelId: string;
  workspaceId: string;
}
let pendingTap: NotificationDestination | null = null;
let foregroundChannel: string | null = null;
let installation: Promise<string> | undefined;
let notificationGeneration = 0;
let sessionActive = false;
let deviceWork: Promise<void> = Promise.resolve();
function serializeDevice(operation: () => Promise<void>) {
  const next = deviceWork.catch(() => {}).then(operation);
  deviceWork = next;
  return next;
}
export function setNotificationConversation(id: string | null) {
  foregroundChannel = id;
}
function destination(value: unknown): NotificationDestination | null {
  if (
    !value ||
    typeof value !== "object" ||
    !("channelId" in value) ||
    !("workspaceId" in value) ||
    typeof value.channelId !== "string" ||
    typeof value.workspaceId !== "string" ||
    value.channelId.length > 128 ||
    value.workspaceId.length > 128
  )
    return null;
  return { channelId: value.channelId, workspaceId: value.workspaceId };
}
export function subscribeNotificationTap(
  listener: (data: NotificationDestination) => void,
) {
  taps.add(listener);
  if (pendingTap) {
    const tap = pendingTap;
    pendingTap = null;
    listener(tap);
  }
  return () => {
    taps.delete(listener);
  };
}
function openNotification(data: unknown) {
  if (!sessionActive) return;
  const tap = destination(data);
  if (!tap) return;
  if (!taps.size) pendingTap = tap;
  else for (const listener of taps) listener(tap);
}
async function loadInstallationId() {
  let id = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (!id) {
    id = randomUUID();
    await SecureStore.setItemAsync(INSTALLATION_KEY, id);
  }
  return id;
}
export function installationId() {
  return (installation ??= loadInstallationId());
}
export async function enableNotifications() {
  const generation = notificationGeneration;
  const runtime = getNotificationRuntime();
  if (runtime.status !== "ready") throw new Error(runtime.message);
  if (!Device.isDevice)
    throw new Error(
      "Notifications require a Fable development or release build on a physical phone.",
    );
  const { Notifications } = runtime;
  const configuration = await request<{
    data: { apns: boolean; fcm: boolean };
  }>("/devices/config");
  if (
    !(Platform.OS === "ios" ? configuration.data.apns : configuration.data.fcm)
  )
    throw new Error(
      "Push notifications need to be configured on the Fable server before this phone can receive alerts.",
    );
  if (Platform.OS === "android")
    await Notifications.setNotificationChannelAsync("messages", {
      name: "Messages",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 200, 100, 200],
    });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Allow notifications in your phone settings to receive message alerts.",
    );
  const token = await Notifications.getDevicePushTokenAsync();
  await serializeDevice(async () => {
    if (!sessionActive || generation !== notificationGeneration)
      throw new Error("Sign in again before enabling notifications.");
    if (Platform.OS === "android")
      await Notifications.registerTaskAsync(INCOMING_CALL_TASK);
    await initializeNativeCalls();
    if (!sessionActive || generation !== notificationGeneration) return;
    await voip?.setEnabled(true);
    await writeToken(String(token.data), generation);
  });
}
function registerToken(token: string) {
  const generation = notificationGeneration;
  return serializeDevice(() => writeToken(token, generation));
}
async function writeToken(token: string, generation: number) {
  if (!sessionActive || generation !== notificationGeneration) return;
  const voipToken = await voip?.getToken();
  if (!sessionActive || generation !== notificationGeneration) return;
  await request<void>("/devices", {
    method: "PUT",
    body: JSON.stringify({
      id: await installationId(),
      provider: Platform.OS === "ios" ? "apns" : "fcm",
      token,
      ...(voipToken ? { voipToken } : {}),
      sandbox:
        Platform.OS === "ios" &&
        (await Application.getIosPushNotificationServiceEnvironmentAsync()) ===
          "development",
    }),
  });
}
export async function unregisterNotifications() {
  notificationGeneration += 1;
  sessionActive = false;
  pendingTap = null;
  foregroundChannel = null;
  const runtime = getNotificationRuntime();
  const Notifications =
    runtime.status === "ready" && Device.isDevice
      ? runtime.Notifications
      : null;
  await serializeDevice(async () => {
    try {
      await clearNativeCalls();
      if (Platform.OS === "web") return;
      const id = await SecureStore.getItemAsync(INSTALLATION_KEY);
      if (id && (await getSessionToken()))
        await request<void>(`/devices/${id}`, { method: "DELETE" });
    } finally {
      if (Notifications) {
        await Notifications.unregisterForNotificationsAsync();
        await Notifications.clearLastNotificationResponseAsync();
        await Notifications.dismissAllNotificationsAsync();
      }
    }
  });
}
export function startNotifications(onError: (message: string) => void) {
  const runtime = getNotificationRuntime();
  if (runtime.status !== "ready") {
    if (runtime.status === "rebuild") onError(runtime.message);
    return () => {};
  }
  if (!Device.isDevice) return () => {};
  const { Notifications } = runtime;
  notificationGeneration += 1;
  sessionActive = true;
  let alive = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const viewing =
        AppState.currentState === "active" &&
        notification.request.content.data?.channelId === foregroundChannel;
      return {
        shouldShowBanner: !viewing,
        shouldShowList: !viewing,
        shouldPlaySound: !viewing,
        shouldSetBadge: false,
      };
    },
  });
  const response = Notifications.addNotificationResponseReceivedListener(
    (event) => {
      openNotification(event.notification.request.content.data);
      void Notifications.clearLastNotificationResponseAsync();
    },
  );
  const rotated = Notifications.addPushTokenListener((token) => {
    void registerToken(String(token.data)).catch(() => {
      if (alive)
        onError(
          "Notification registration couldn't update. Open Settings to retry.",
        );
    });
  });
  const received = Notifications.addNotificationReceivedListener((event) => {
    void receiveCallPush(event.request.content.data).catch(() => {
      if (alive) onError("An incoming call couldn't be opened.");
    });
  });
  const voipToken = voip?.addListener("tokenChanged", () => {
    void Notifications.getDevicePushTokenAsync()
      .then((token) => registerToken(String(token.data)))
      .catch(() => {
        if (alive)
          onError("Call alerts couldn't update. Open Settings to retry.");
      });
  });
  const refresh = async () => {
    try {
      const permissions = await Notifications.getPermissionsAsync();
      if (permissions.granted && alive) await enableNotifications();
      else if (alive) {
        const id = await SecureStore.getItemAsync(INSTALLATION_KEY);
        if (id) await request<void>(`/devices/${id}`, { method: "DELETE" });
      }
    } catch {
      if (alive)
        onError(
          "Notifications aren't connected on this device. Open Settings to enable them.",
        );
    }
  };
  void Notifications.getLastNotificationResponseAsync()
    .then((event) => {
      if (alive && event) {
        openNotification(event.notification.request.content.data);
        void Notifications.clearLastNotificationResponseAsync();
      }
    })
    .catch(() => {
      if (alive)
        onError(
          "The saved notification couldn't be opened. Open the chat from your list.",
        );
    });
  void refresh();
  const state = AppState.addEventListener("change", (value) => {
    if (value === "active") void refresh();
  });
  return () => {
    notificationGeneration += 1;
    sessionActive = false;
    alive = false;
    response.remove();
    rotated.remove();
    received.remove();
    voipToken?.remove();
    state.remove();
    foregroundChannel = null;
  };
}
