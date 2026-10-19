import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { DirectoryOptions, DirectoryPage } from "@/services/api";

/** One visible server page, bounded navigation metadata, and no background requests. */
export function useDirectory<T, P extends DirectoryPage<T> = DirectoryPage<T>>(
  load: (options: DirectoryOptions) => Promise<P>,
  enabled = true,
) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState<{
    after?: string;
    previous: (string | undefined)[];
  }>({ previous: [] });
  const [page, setPage] = useState<P | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  const search = useCallback((value: string) => {
    sequence.current += 1;
    setQuery(value.slice(0, 120));
    setLocation({ previous: [] });
    setPage(null);
    setError("");
    setLoading(true);
  }, []);
  const reload = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      if (AppState.currentState && AppState.currentState !== "active") return;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      const currentSequence = ++sequence.current;
      setLoading(true);
      setError("");
      load({ limit: 50, after: location.after, q: query.trim(), signal })
        .then((result) => {
          if (
            !disposed &&
            !signal.aborted &&
            currentSequence === sequence.current
          )
            setPage(result);
        })
        .catch((failure: unknown) => {
          if (
            !disposed &&
            !signal.aborted &&
            currentSequence === sequence.current
          )
            setError(
              failure instanceof Error
                ? failure.message
                : "Unable to load results.",
            );
        })
        .finally(() => {
          if (
            !disposed &&
            !signal.aborted &&
            currentSequence === sequence.current
          )
            setLoading(false);
        });
    };
    timer = setTimeout(run, query.trim() ? 250 : 0);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
      else {
        controller?.abort();
        if (timer) clearTimeout(timer);
      }
    });
    return () => {
      disposed = true;
      controller?.abort();
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [load, enabled, query, location.after, revision]);
  const next = () => {
    if (loading || !page?.hasMore || !page.nextCursor) return;
    sequence.current += 1;
    setLocation((previous) => ({
      after: page.nextCursor!,
      previous: [...previous.previous, previous.after].slice(-100),
    }));
    setPage(null);
    setLoading(true);
  };
  const previous = () => {
    if (loading || !location.previous.length) return;
    sequence.current += 1;
    setLocation((current) => ({
      after: current.previous.at(-1),
      previous: current.previous.slice(0, -1),
    }));
    setPage(null);
    setLoading(true);
  };
  const first = () => {
    sequence.current += 1;
    setLocation({ previous: [] });
    setPage(null);
    setLoading(true);
    setRevision((value) => value + 1);
  };
  return {
    query,
    search,
    page,
    loading,
    error,
    reload,
    next,
    previous,
    first,
    canPrevious: location.previous.length > 0,
    isFirst: !location.after,
  };
}
