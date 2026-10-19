import { useCallback, useEffect, useRef, useState } from "react";
import { DirectoryPage, DirectoryQuery } from "../services/api";

// Retain one visible page and at most 100 cursor strings, never every record.
export function useDirectory<T>(
  fetchPage: (query: DirectoryQuery) => Promise<DirectoryPage<T>>,
  scope: string,
  enabled: boolean,
) {
  const [query, setQuery] = useState("");
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState<DirectoryPage<T>>({
    data: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;
  const previousScope = useRef(scope);
  const after = cursors.at(-1);
  useEffect(() => {
    if (previousScope.current !== scope) {
      previousScope.current = scope;
      setQuery("");
      setCursors([undefined]);
      setPage({ data: [], total: 0, hasMore: false, nextCursor: null });
      setRevision((old) => old + 1);
      return;
    }
    if (!enabled) return;
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = window.setTimeout(
      () => {
        void fetchRef
          .current({ limit: 50, after, q: query, signal: controller.signal })
          .then((next) => {
            if (alive) setPage(next);
          })
          .catch((err: unknown) => {
            if (alive)
              setError(
                err instanceof Error
                  ? err.message
                  : "Results could not be loaded.",
              );
          })
          .finally(() => {
            if (alive) setLoading(false);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [scope, enabled, after, query, revision]);
  const search = useCallback((value: string) => {
    setQuery(value.slice(0, 120));
    setCursors([undefined]);
  }, []);
  return {
    ...page,
    query,
    search,
    loading,
    error,
    setPage,
    setData: (update: T[] | ((previous: T[]) => T[])) =>
      setPage((previous) => ({
        ...previous,
        data: typeof update === "function" ? update(previous.data) : update,
      })),
    hasPrevious: cursors.length > 1,
    previous: () => setCursors((old) => old.slice(0, -1)),
    next: () => {
      if (page.nextCursor)
        setCursors((old) => [...old.slice(-99), page.nextCursor!]);
    },
    first: () => {
      setCursors([undefined]);
      setRevision((old) => old + 1);
    },
    refresh: () => setRevision((old) => old + 1),
  };
}

export type DirectoryState<T> = ReturnType<typeof useDirectory<T>>;
