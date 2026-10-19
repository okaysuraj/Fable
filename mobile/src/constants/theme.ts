/** Only the active paper palette and platform font choices live here; dark mode is in the theme provider. */
import { Platform } from "react-native";

export const BrutalColors = {
  // Neo-Brutalism Paper Palette
  bgPaper: "#F5F0E8",
  bgCard: "#FFFFFF",
  bgCardAlt: "#FFF8E7",
  bgSidebar: "#FFFDF7",
  bgInput: "#FFFFFF",

  ink: "#1A1A1A",
  inkSecondary: "#4A4A4A",
  inkMuted: "#8A8A8A",
  inkFaint: "#D4CEBF",

  border: "#1A1A1A",

  accentYellow: "#FFD700",
  accentPink: "#FF3366",
  accentBlue: "#4169E1",
  accentGreen: "#00C853",
  accentOrange: "#FF6B35",
  accentPurple: "#7C3AED",
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: "System",
    mono: "Courier",
    display: "System",
  },
  android: {
    sans: "sans-serif",
    mono: "monospace",
    display: "sans-serif-medium",
  },
  default: {
    sans: "System",
    mono: "monospace",
    display: "System",
  },
  web: {
    sans: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "'Space Mono', 'Courier New', monospace",
    display: "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif",
  },
});
