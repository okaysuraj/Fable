import React, { createContext, useContext } from "react";
import { BrutalColors } from "@/constants/theme";
import type { ThemeMode } from "@/types/chat";

export type BrutalPalette = { [K in keyof typeof BrutalColors]: string };
const darkPalette: BrutalPalette = {
  ...BrutalColors,
  bgPaper: "#171A20",
  bgCard: "#22262E",
  bgCardAlt: "#2B3039",
  bgSidebar: "#1D2128",
  bgInput: "#22262E",
  ink: "#F7F2E9",
  inkSecondary: "#D9D4CA",
  inkMuted: "#AEA99E",
  inkFaint: "#50545E",
  border: "#BBB5A9",
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
