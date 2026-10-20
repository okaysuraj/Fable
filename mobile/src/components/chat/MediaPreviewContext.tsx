import { createContext, useContext, useState, type ReactNode } from "react";
const Preview = createContext<{
  active: string | null;
  select: (id: string | null) => void;
} | null>(null);
export function MediaPreviewProvider({ children }: { children: ReactNode }) {
  const [active, select] = useState<string | null>(null);
  return (
    <Preview.Provider value={{ active, select }}>{children}</Preview.Provider>
  );
}
export function useMediaPreview() {
  const context = useContext(Preview);
  if (!context) throw new Error("Media preview provider is missing");
  return context;
}
