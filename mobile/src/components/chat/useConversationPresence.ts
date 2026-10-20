import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { api } from "@/services/api";
import type { ConversationPresence } from "@/types/chat";

export function useConversationPresence(channelId: string, draft: string) {
  const [presence, setPresence] = useState<ConversationPresence | null>(null);
  const [available, setAvailable] = useState(true);
  const lastTyping = useRef(0);
  const sentTyping = useRef(false);
  useEffect(() => {
    let alive = true;
    let busy = false;
    lastTyping.current = 0;
    sentTyping.current = false;
    const poll = async () => {
      if (busy || AppState.currentState !== "active") return;
      busy = true;
      try {
        const result = await api.fetchPresence(channelId);
        if (alive) {
          setPresence(result.data);
          setAvailable(true);
        }
      } catch {
        if (alive) {
          setPresence(null);
          setAvailable(false);
        }
      } finally {
        busy = false;
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 4000);
    const subscription = AppState.addEventListener("change", (state) => {
      setPresence(null);
      if (state === "active") void poll();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, [channelId]);
  useEffect(() => {
    let alive = true;
    if (
      draft.trim() &&
      Date.now() - lastTyping.current > 2500 &&
      AppState.currentState === "active"
    ) {
      lastTyping.current = Date.now();
      sentTyping.current = true;
      void api.setTyping(channelId, true).catch(() => {
        if (alive) setAvailable(false);
      });
    }
    const timer = setTimeout(
      () => {
        if (sentTyping.current) {
          sentTyping.current = false;
          void api.setTyping(channelId, false).catch(() => {
            if (alive) setAvailable(false);
          });
        }
      },
      draft.trim() ? 2500 : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [channelId, draft]);
  return { presence, available };
}
