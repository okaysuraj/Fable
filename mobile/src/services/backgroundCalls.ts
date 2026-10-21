import { Platform } from "react-native";
import type { NotificationTaskPayload } from "expo-notifications";
import { getNotificationRuntime } from "./notificationRuntime";
import { getSessionToken, request } from "./session";
import { showNativeIncoming } from "./nativeCalls";
import type { CallSession } from "@/types/chat";

export const INCOMING_CALL_TASK = "fable-incoming-call";
export async function receiveCallPush(payload: unknown) {
  if (
    Platform.OS !== "android" ||
    !payload ||
    typeof payload !== "object" ||
    !("type" in payload) ||
    payload.type !== "call" ||
    !("callId" in payload) ||
    typeof payload.callId !== "string"
  )
    return false;
  if (!(await getSessionToken())) return false;
  const { data: call } = await request<{ data: CallSession }>(
    `/calls/${encodeURIComponent(payload.callId)}`,
  );
  if (call.status !== "ringing") return false;
  await showNativeIncoming({ ...payload, nativeId: call.nativeId });
  return true;
}
// Android headless launches need this definition during module evaluation.
// The runtime adapter skips native notification imports entirely in Expo Go.
const runtime = getNotificationRuntime();
if (runtime.status === "ready" && runtime.TaskManager) {
  const { Notifications, TaskManager } = runtime;
  if (!TaskManager.isTaskDefined(INCOMING_CALL_TASK))
    TaskManager.defineTask<NotificationTaskPayload>(
      INCOMING_CALL_TASK,
      async ({ data, error }) => {
        if (error || !data || "actionIdentifier" in data) return;
        try {
          const payload: unknown =
            typeof data.data.dataString === "string"
              ? JSON.parse(data.data.dataString)
              : data.data;
          const handled = await receiveCallPush(payload);
          return handled
            ? Notifications.BackgroundNotificationTaskResult.NewData
            : Notifications.BackgroundNotificationTaskResult.NoData;
        } catch {
          return Notifications.BackgroundNotificationTaskResult.Failed;
        }
      },
    );
}
