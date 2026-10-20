import React, { createContext, useContext } from "react";
import { BrutalColors } from "@/constants/theme";
import type { ThemeMode } from "@/types/chat";

export type BrutalPalette = { [K in keyof typeof BrutalColors]: string };
const darkPalette: BrutalPalette = {
  ...BrutalColors,
  bgPaper: "#18181A",
  bgCard: "#2B2B2E",
  bgCardAlt: "#343437",
  bgSidebar: "#232326",
  bgInput: "#242427",
  ink: "#F5F5F7",
  inkSecondary: "#D0D0D5",
  inkMuted: "#AAAAB2",
  inkFaint: "#93939C",
  border: "#414145",
  controlBorder: "#777780",
  primary: "#80B9FF",
  primaryHover: "#A6CEFF",
  onPrimary: "#10243D",
  selection: "#253F5E",
  selectionInk: "#D9EAFF",
  bubbleReceived: "#303034",
  chatBackground: "#0B141A",
  chatOutgoing: "#005C4B",
  chatReceived: "#202C33",
  chatInk: "#E9EDEF",
  chatMuted: "#AEBAC1",
  chatAccent: "#00A884",
  chatHeader: "#202C33",
  chatComposer: "#202C33",
  dangerSurface: "#49283B",
  dangerButton: "#9C3D59",
  codeBg: "#202023",
  accentYellow: "#E3EDFC",
  accentPink: "#FFABC4",
  accentBlue: "#80B9FF",
  accentGreen: "#87D9C7",
  accentOrange: "#E5B48A",
  accentPurple: "#80B9FF",
};
const ThemeContext = createContext<BrutalPalette>(BrutalColors);
export function BrutalThemeProvider({
  mode,
  children,
}: {
  mode: ThemeMode;
  children: React.ReactNode;
}) {
  return (
    <ThemeContext.Provider value={mode === "dark" ? darkPalette : BrutalColors}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useBrutalTheme() {
  return useContext(ThemeContext);
}
// Style sheets are created once per palette, including for virtualized message rows.
const styleCache = new WeakMap<object, WeakMap<object, object>>();
export function useBrutalStyles<T extends object>(
  factory: (palette: BrutalPalette) => T,
): T {
  const palette = useBrutalTheme();
  let variants = styleCache.get(factory);
  if (!variants) {
    variants = new WeakMap();
    styleCache.set(factory, variants);
  }
  const existing = variants.get(palette);
  if (existing) return existing as T;
  const styles = factory(palette);
  variants.set(palette, styles);
  return styles;
}
