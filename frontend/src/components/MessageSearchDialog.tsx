/** Search server history in bounded pages and open the exact selected message. */
import { useEffect, useRef, useState } from "react";
import { api, SearchPage, SearchResult } from "../services/api";
import { Channel } from "../types/chat";
import { useDialog } from "./useDialog";

interface Props {
  channel?: Channel;
  onClose: () => void;
  onOpenResult: (result: SearchResult) => void;
}
const empty: SearchPage = { data: [], hasMore: false, nextCursor: null };

export function MessageSearchDialog({ channel, onClose, onOpenResult }: Props) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [roomOnly, setRoomOnly] = useState(!!channel);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [page, setPage] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const cursor = cursors.at(-1);
  useDialog(true, ref, onClose);
  useEffect(() => {
    if (query.length < 2) return;
    let alive = true;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    setPage(empty);
    void api
      .searchMessages(
        query,
        cursor,
        roomOnly ? channel?.id : undefined,
        controller.signal,
      )
      .then((result) => {
        if (alive) setPage(result);
      })
      .catch((err: unknown) => {
        if (alive)
          setError(
            err instanceof Error
              ? err.message
              : "Messages could not be searched.",
          );
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [query, cursor, roomOnly, channel?.id, revision]);
  const search = (event: React.FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (value.length < 2) return;
    setQuery(value);
    setCursors([undefined]);
    setRevision((old) => old + 1);
  };
  return (
    <div
      className="fixed inset-0 z-50 p-4 bg-black/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-search-title"
        className="brutal-card p-5 sm:p-6 max-w-2xl w-full max-h-[90dvh] flex flex-col gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between gap-3">
          <h2 id="message-search-title" className="font-display text-xl">
            Search messages
          </h2>
          <button className="brutal-btn brutal-btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
        <form className="space-y-3" onSubmit={search}>
          <label className="block text-sm font-bold">
            Words to find
            <input
              className="brutal-input mt-2"
              value={input}
              maxLength={120}
              minLength={2}
              required
              onChange={(event) => setInput(event.target.value)}
              placeholder="Search the full conversation history"
            />
          </label>
          <div className="flex flex-wrap justify-between items-center gap-3">
            {channel && (
              <label className="flex gap-2 items-center text-sm">
                <input
                  type="checkbox"
                  checked={roomOnly}
                  onChange={(event) => {
                    setRoomOnly(event.target.checked);
                    setCursors([undefined]);
                  }}
                />
                Only #{channel.name}
              </label>
            )}
            <button
              className="brutal-btn brutal-btn-sm"
              disabled={busy || input.trim().length < 2}
            >
              Search
            </button>
          </div>
        </form>
        <p className="text-xs">
          Matches all entered words in accessible rooms, including older
          messages and code. Deleted messages are excluded.
        </p>
        {error && (
          <div className="space-y-2">
            <p role="alert" className="text-sm">
              {error}
            </p>
            <button
              className="brutal-btn brutal-btn-sm"
              onClick={() => setRevision((old) => old + 1)}
            >
              Retry search
            </button>
          </div>
        )}
        <div
          className="flex-1 min-h-0 overflow-auto space-y-3"
          aria-busy={busy}
        >
          {busy && (
            <p role="status" className="text-sm">
              Searching messages…
            </p>
          )}
          {!busy && query && !error && !page.data.length && (
            <p role="status" className="text-sm">
              No messages match “{query}”.
            </p>
          )}
          {page.data.map((result) => (
            <article
              key={result.message.id}
              className="border-[2px] p-3 space-y-2"
            >
              <p className="font-bold text-sm break-words">
                #{result.channel.name} · {result.message.sender.name}
              </p>
              <time dateTime={result.message.timestamp} className="text-xs">
                {new Date(result.message.timestamp).toLocaleString()}
              </time>
              <p className="text-sm whitespace-pre-wrap break-words">
                {result.message.content}
              </p>
              {result.message.codeSnippet && (
                <pre className="text-xs overflow-auto p-2 bg-[var(--bg-card-alt)] max-h-48">
                  <code>{result.message.codeSnippet.code}</code>
                </pre>
              )}
              <button
                className="brutal-btn brutal-btn-outline brutal-btn-sm"
                onClick={() => {
                  onOpenResult(result);
                  onClose();
                }}
              >
                Open message in room
              </button>
            </article>
          ))}
        </div>
        {(cursors.length > 1 || page.hasMore) && (
          <nav
            aria-label="Search result pages"
            className="flex flex-wrap gap-2"
          >
            <button
              className="brutal-btn brutal-btn-sm"
              disabled={busy || cursors.length < 2}
              onClick={() => setCursors((old) => old.slice(0, -1))}
            >
              Previous results
            </button>
            <button
              className="brutal-btn brutal-btn-sm"
              disabled={busy || !page.hasMore || !page.nextCursor}
              onClick={() => {
                if (page.nextCursor)
                  setCursors((old) => [...old.slice(-99), page.nextCursor!]);
              }}
            >
              Next results
            </button>
            {cursors.length > 1 && (
              <button
                className="brutal-btn brutal-btn-outline brutal-btn-sm"
                disabled={busy}
                onClick={() => {
                  setCursors([undefined]);
                  setRevision((old) => old + 1);
                }}
              >
                First results
              </button>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
