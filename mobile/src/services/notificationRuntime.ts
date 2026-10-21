import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";

type NotificationRuntime =
  | {
      status: "ready";
      Notifications: typeof import("expo-notifications");
      TaskManager: typeof import("expo-task-manager") | null;
    }
  | { status: "unsupported" | "rebuild"; message: string };

let runtime: NotificationRuntime | undefined;

export function getNotificationRuntime(): NotificationRuntime {
  if (runtime) return runtime;
  if (Platform.OS === "web" || isRunningInExpoGo()) {
    return (runtime = {
      status: "unsupported",
      message:
        "Notifications require an installed Fable development or release build on a physical phone.",
    });
  }
  try {
    // Keep native imports behind the runtime check. Expo Go cannot load every
    // module exported by expo-notifications, even when no push API is called.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Headless tasks must be defined synchronously at startup.
    const Notifications: typeof import("expo-notifications") = require("expo-notifications");
    let TaskManager: typeof import("expo-task-manager") | null = null;
    if (Platform.OS === "android") {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Load only after the native runtime guard, before defining headless tasks.
      TaskManager = require("expo-task-manager");
    }
    return (runtime = { status: "ready", Notifications, TaskManager });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("Cannot find native module")
    )
      throw error;
    return (runtime = {
      status: "rebuild",
      message:
        "This Fable build is missing native notification support. Rebuild and reinstall the app to enable notifications.",
    });
  }
}
