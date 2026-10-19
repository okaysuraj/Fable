import { useRef, useState, type FormEvent } from "react";
import { api } from "../services/api";
import type { Channel } from "../types/chat";
import { useDialog } from "./useDialog";

interface RoomFormProps {
  onCreated: (room: Channel) => void;
  onError: (error: unknown) => void;
  onCancel?: () => void;
  onPendingChange?: (pending: boolean) => void;
  autoFocus?: boolean;
}

/** The empty-state form and modal use the same validation and server-confirmed create. */
export function RoomForm({
  onCreated,
  onError,
  onCancel,
  onPendingChange,
  autoFocus,
}: RoomFormProps) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    onPendingChange?.(true);
    setError("");
    try {
      const room = await api.createChannel(
        name.trim(),
        topic.trim(),
        "text",
        isPrivate,
      );
      onCreated(room);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to create this room.",
      );
      onError(failure);
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block">
        Room name
        <input
          autoFocus={autoFocus}
          className="brutal-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={80}
          disabled={pending}
        />
      </label>
      <label className="block">
        Topic
        <input
          className="brutal-input"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          maxLength={500}
          disabled={pending}
        />
      </label>
      <label className="flex gap-2">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(event) => setIsPrivate(event.target.checked)}
          disabled={pending}
        />
        Private room
      </label>
      {isPrivate && (
        <p className="text-xs">
          Choose members in Room information after creating this private room.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="flex gap-3">
        <button className="brutal-btn" disabled={pending || !name.trim()}>
          {pending ? "Creating..." : "Create room"}
        </button>
        {onCancel && (
          <button
            type="button"
            className="brutal-btn brutal-btn-outline"
            disabled={pending}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

/** Keep focus and dismissal behavior at the dialog boundary, outside the dashboard. */
export function CreateRoomDialog({
  onCreated,
  onError,
  onClose,
}: Omit<RoomFormProps, "onCancel" | "onPendingChange" | "autoFocus"> & {
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const close = () => {
    if (!pending) onClose();
  };
  useDialog(true, dialogRef, close);

  return (
    <div
      className="fixed inset-0 z-50 p-4 bg-black/50 flex items-center justify-center"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create room"
        className="brutal-card p-6 max-w-md w-full space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="font-display text-xl">Create room</h2>
        <RoomForm
          autoFocus
          onCreated={onCreated}
          onError={onError}
          onCancel={close}
          onPendingChange={setPending}
        />
      </div>
    </div>
  );
}
