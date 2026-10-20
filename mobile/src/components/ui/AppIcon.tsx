/** One optical family for navigation and actions, independent of the system text font. */
import type { ComponentProps } from "react";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useBrutalTheme } from "@/hooks/use-brutal-theme";

const glyphs = {
  chats: "chatbubbles-outline",
  chatsFilled: "chatbubbles",
  call: "call-outline",
  callFilled: "call",
  people: "people-outline",
  peopleFilled: "people",
  video: "videocam-outline",
  camera: "camera-outline",
  next: "arrow-forward",
  selected: "checkmark-circle",
  circle: "ellipse-outline",
  videoOff: "videocam-off-outline",
  menu: "menu-outline",
  close: "close",
  back: "chevron-back",
  forward: "chevron-forward",
  compose: "create-outline",
  search: "search-outline",
  settings: "settings-outline",
  sun: "sunny-outline",
  moon: "moon-outline",
  profile: "person-circle-outline",
  groups: "people-circle-outline",
  info: "information-circle-outline",
  logout: "log-out-outline",
  add: "add",
  attach: "attach-outline",
  microphone: "mic-outline",
  microphoneOff: "mic-off-outline",
  stop: "stop-circle",
  emoji: "happy-outline",
  send: "arrow-up",
  reply: "arrow-undo-outline",
  more: "ellipsis-horizontal",
  pin: "pin-outline",
  edit: "pencil-outline",
  trash: "trash-outline",
  mail: "mail-outline",
  lock: "lock-closed-outline",
  eye: "eye-outline",
  eyeOff: "eye-off-outline",
  google: "logo-google",
  check: "checkmark-circle-outline",
  alert: "alert-circle-outline",
  refresh: "refresh-outline",
  document: "document-outline",
  download: "download-outline",
  play: "play",
  pause: "pause",
} as const satisfies Record<string, ComponentProps<typeof Ionicons>["name"]>;

export type AppIconName = keyof typeof glyphs;

export function AppIcon({
  name,
  size = 24,
  color,
}: {
  name: AppIconName;
  size?: number;
  color?: string;
}) {
  const colors = useBrutalTheme();
  return (
    <Ionicons
      name={glyphs[name]}
      size={size}
      color={color ?? colors.primary}
      accessible={false}
      importantForAccessibility="no"
      allowFontScaling={false}
    />
  );
}
