import type { DirectoryState } from "./useDirectory";

// Controls consume navigation and display state, never a directory's typed record setters.
type DirectoryControlsState = Omit<
  DirectoryState<unknown>,
  "setPage" | "setData"
>;

/** One directory state supplies search, counts, loading feedback and bounded navigation. */
export function DirectoryControls({
  label,
  directory,
}: {
  label: string;
  directory: DirectoryControlsState;
}) {
  const {
    query,
    search: onSearch,
    loading,
    total,
    data,
    hasPrevious,
    hasMore,
    previous: onPrevious,
    next: onNext,
    error,
    refresh: onRetry,
    first: onFirst,
  } = directory;
  const count = data.length;
  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold">
        {label}
        <input
          className="brutal-input mt-1"
          value={query}
          maxLength={120}
          onChange={(event) => onSearch(event.target.value)}
        />
      </label>
      <p role="status" className="text-xs">
        {loading
          ? "Loading results..."
          : `Showing ${count} of ${total} results`}
      </p>
      {error && (
        <div>
          <p role="alert" className="text-xs">
            {error}
          </p>
          <button
            type="button"
            className="brutal-btn brutal-btn-sm"
            onClick={onRetry}
          >
            Retry results
          </button>
        </div>
      )}
      {(hasPrevious || hasMore) && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="brutal-btn brutal-btn-sm"
            disabled={loading || !hasPrevious}
            onClick={onPrevious}
          >
            Previous results
          </button>
          <button
            type="button"
            className="brutal-btn brutal-btn-sm"
            disabled={loading || !hasMore}
            onClick={onNext}
          >
            Next results
          </button>
          {hasPrevious && onFirst && (
            <button
              type="button"
              className="brutal-btn brutal-btn-sm"
              disabled={loading}
              onClick={onFirst}
            >
              First results
            </button>
          )}
        </div>
      )}
    </div>
  );
}
