/** Administrators browse actual audit events one page at a time. */
import { useEffect, useState } from "react";
import { api, AuditPage } from "../services/api";

const empty: AuditPage = { data: [], hasMore: false, nextCursor: null };
const labels: Record<string, string> = {
  "workspace.create": "Workspace created",
  "workspace.rename": "Workspace renamed",
  "workspace.member.role": "Member role changed",
  "workspace.member.remove": "Member removed",
  "workspace.member.leave": "Member left",
  "workspace.ownership.transfer": "Workspace ownership transferred",
  "workspace.invitation.create": "Invitation created",
  "workspace.invitation.accept": "Invitation accepted",
  "workspace.invitation.revoke": "Invitation revoked",
  "channel.create": "Room created",
  "channel.update": "Room updated",
  "channel.delete": "Room deleted",
  "channel.ownership.transfer": "Room ownership transferred",
  "channel.member.add": "Room member added",
  "channel.member.remove": "Room member removed",
  "channel.member.leave": "Room member left",
};

export function WorkspaceActivity({ workspaceId }: { workspaceId: string }) {
  const [page, setPage] = useState(empty);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const before = cursors.at(-1);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setBusy(true);
    setError("");
    setPage(empty);
    void api
      .fetchAudit(before, controller.signal)
      .then((result) => {
        if (alive) setPage(result);
      })
      .catch((err: unknown) => {
        if (alive)
          setError(
            err instanceof Error
              ? err.message
              : "Workspace activity could not be loaded.",
          );
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
      controller.abort();
    };
  }, [workspaceId, before, revision]);
  return (
    <section
      className="space-y-3"
      aria-label="Workspace activity"
      aria-busy={busy}
    >
      <p className="text-xs">
        Recorded administrative activity, newest first. Message content is not
        shown here.
      </p>
      <button
        className="brutal-btn brutal-btn-outline brutal-btn-sm"
        disabled={busy}
        onClick={() => {
          setCursors([undefined]);
          setRevision((old) => old + 1);
        }}
      >
        Latest activity
      </button>
      {busy && (
        <p role="status" className="text-sm">
          Loading activity…
        </p>
      )}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-sm">
            {error}
          </p>
          <button
            className="brutal-btn brutal-btn-sm"
            onClick={() => setRevision((old) => old + 1)}
          >
            Retry activity
          </button>
        </div>
      )}
      {!busy && !error && !page.data.length && (
        <p role="status" className="text-sm">
          No activity recorded on this page.
        </p>
      )}
      {page.data.map((event) => (
        <article key={event.id} className="border-[2px] p-3 space-y-1">
          <p className="font-bold text-sm">
            {labels[event.action] || event.action}
          </p>
          <time className="text-xs" dateTime={event.createdAt}>
            {new Date(event.createdAt).toLocaleString()}
          </time>
          <p className="text-xs break-all">Actor: {event.actorId}</p>
          {event.targetId && (
            <p className="text-xs break-all">Target: {event.targetId}</p>
          )}
        </article>
      ))}
      {(page.hasMore || cursors.length > 1) && (
        <nav aria-label="Activity pages" className="flex flex-wrap gap-2">
          <button
            className="brutal-btn brutal-btn-sm"
            disabled={busy || cursors.length < 2}
            onClick={() => setCursors((old) => old.slice(0, -1))}
          >
            Previous activity
          </button>
          <button
            className="brutal-btn brutal-btn-sm"
            disabled={busy || !page.hasMore || !page.nextCursor}
            onClick={() => {
              if (page.nextCursor)
                setCursors((old) => [...old.slice(-99), page.nextCursor!]);
            }}
          >
            Earlier activity
          </button>
        </nav>
      )}
    </section>
  );
}
