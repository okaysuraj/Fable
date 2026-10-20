/** Instrument Serif branding/conversations and system UI; dark colors live in the provider. */
import { Platform } from "react-native";

export const BrutalColors = {
  bgPaper: "#FFFFFF",
  bgCard: "#FFFFFF",
  bgCardAlt: "#F2F2F4",
  bgSidebar: "#F3F3F5",
  bgInput: "#FFFFFF",

  ink: "#1D1D1F",
  inkSecondary: "#535358",
  inkMuted: "#6C6C72",
  inkFaint: "#909096",

  border: "#E1E1E5",
  controlBorder: "#89898F",
  primary: "#0067DD",
  primaryHover: "#0059C1",
  onPrimary: "#FFFFFF",
  selection: "#E3EDFC",
  selectionInk: "#005BC5",
  bubbleSent: "#0067DD",
  bubbleReceived: "#E9E9EB",
  chatBackground: "#EFEAE2",
  chatOutgoing: "#D9FDD3",
  chatReceived: "#FFFFFF",
  chatInk: "#111B21",
  chatMuted: "#667781",
  chatAccent: "#008069",
  chatHeader: "#FFFFFF",
  chatComposer: "#F0F2F5",
  dangerSurface: "#FFF0F3",
  dangerButton: "#B43E61",
  codeBg: "#F2F2F4",

  accentYellow: "#E3EDFC",
  accentPink: "#B43E61",
  accentBlue: "#0067DD",
  accentGreen: "#21816E",
  accentOrange: "#9A5A37",
  accentPurple: "#0067DD",
} as const;

export const Fonts = {
  editorial: "InstrumentSerif-Regular",
  sans: Platform.select({
    ios: "HelveticaNeue",
    android: "sans-serif",
    default: "system-ui",
  }),
  medium: Platform.select({
    ios: "HelveticaNeue-Medium",
    android: "sans-serif-medium",
    default: "system-ui",
  }),
  semibold: Platform.select({
    ios: "HelveticaNeue-Medium",
    android: "sans-serif-medium",
    default: "system-ui",
  }),
  display: Platform.select({
    ios: "HelveticaNeue-Bold",
    android: "sans-serif",
    default: "system-ui",
  }),
  mono: Platform.select({
    ios: "Menlo",
    android: "monospace",
    web: "Consolas, monospace",
    default: "monospace",
  }),
};
