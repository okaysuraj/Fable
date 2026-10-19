/** Versioned message actions preserve an unsaved edit when the server rejects a stale version. */
import React, { useEffect, useRef, useState } from "react";
import { Message } from "../../types/chat";
import { useDialog } from "../useDialog";

interface Props {
  message: Message | undefined;
  onClose: () => void;
  onEdit: (message: Message, content: string) => Promise<void>;
  onDelete: (message: Message) => Promise<void>;
  onPin: (message: Message, pinned: boolean) => Promise<void>;
}
export const MessageActionsDialog: React.FC<Props> = ({
  message,
  onClose,
  onEdit,
  onDelete,
  onPin,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"actions" | "edit" | "delete">("actions");
  const [baseVersion, setBaseVersion] = useState(message?.version || 0);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useDialog(Boolean(message), ref, onClose);
  useEffect(() => {
    setMode("actions");
    setDraft(message?.content || "");
    setBaseVersion(message?.version || 0);
    setError("");
  }, [message?.id]);
  useEffect(() => {
    if (message?.deletedAt) {
      setError(
        mode === "edit"
          ? "This message was deleted. Your draft is still available to copy."
          : "This message has been deleted.",
      );
    }
  }, [message?.deletedAt, mode]);
  const run = async (action: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await action();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The message could not be updated.",
      );
    } finally {
      setPending(false);
    }
  };
  if (!message) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 p-4 flex items-center justify-center"
      onClick={() => {
        if (!pending) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="message-actions-title"
        className="brutal-card max-w-lg w-full max-h-[85dvh] overflow-auto p-6 space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="message-actions-title" className="font-display text-xl">
          {mode === "edit"
            ? "Edit message"
            : mode === "delete"
              ? "Delete message"
              : "Message actions"}
        </h2>
        <p className="text-xs text-[var(--ink-secondary)]">
          {message.sender.name}
        </p>
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        {mode === "actions" && (
          <div className="flex flex-col gap-3">
            {message.canEdit && !message.deletedAt && (
              <button
                className="brutal-btn brutal-btn-outline"
                disabled={pending}
                onClick={() => {
                  setBaseVersion(message.version);
                  setMode("edit");
                }}
              >
                Edit message
              </button>
            )}
            {message.canPin && !message.deletedAt && (
              <button
                className="brutal-btn brutal-btn-outline"
                disabled={pending}
                onClick={() => run(() => onPin(message, !message.isPinned))}
              >
                {message.isPinned ? "Unpin message" : "Pin message"}
              </button>
            )}
            {message.canDelete && !message.deletedAt && (
              <button
                className="brutal-btn brutal-btn-pink"
                disabled={pending}
                onClick={() => {
                  setBaseVersion(message.version);
                  setMode("delete");
                }}
              >
                Delete message
              </button>
            )}
            {!message.canEdit && !message.canDelete && !message.canPin && (
              <p className="text-sm">No message actions are available.</p>
            )}
          </div>
        )}
        {mode !== "actions" &&
          message.version !== baseVersion &&
          !message.deletedAt && (
            <div
              role="status"
              className="p-3 border-[3px] bg-[var(--bg-card-alt)] space-y-2"
            >
              <p>Message changed while you were editing.</p>
              <p className="text-sm break-words">
                Latest saved text: {message.content}
              </p>
              <button
                className="brutal-btn brutal-btn-sm"
                disabled={pending}
                onClick={() => setBaseVersion(message.version)}
              >
                Use latest version
              </button>
            </div>
          )}
        {mode === "edit" && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                draft.trim() &&
                message.canEdit &&
                !message.deletedAt &&
                message.version === baseVersion
              )
                run(() =>
                  onEdit({ ...message, version: baseVersion }, draft.trim()),
                );
            }}
          >
            <label className="block text-sm font-bold">
              Message text
              <textarea
                autoFocus
                aria-label="Edit message text"
                className="brutal-input mt-2 min-h-32"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={10000}
                required
                disabled={pending}
                readOnly={Boolean(message.deletedAt)}
              />
            </label>
            <button
              className="brutal-btn"
              disabled={
                pending ||
                !draft.trim() ||
                Boolean(message.deletedAt) ||
                message.version !== baseVersion
              }
            >
              {pending ? "Saving..." : "Save changes"}
            </button>
          </form>
        )}
        {mode === "delete" && (
          <div className="space-y-4">
            <p>Delete this message? This cannot be undone.</p>
            <button
              className="brutal-btn brutal-btn-pink"
              disabled={
                pending ||
                Boolean(message.deletedAt) ||
                message.version !== baseVersion
              }
              onClick={() =>
                run(() => onDelete({ ...message, version: baseVersion }))
              }
            >
              {pending ? "Deleting..." : "Delete message"}
            </button>
          </div>
        )}
        <button
          className="brutal-btn brutal-btn-outline"
          disabled={pending}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
