/** Edit the real profile and confirm account-wide token revocation. */
import React, { useEffect, useRef, useState } from "react";
import { User } from "../types/chat";
import { useDialog } from "./useDialog";
interface Props {
  isOpen: boolean;
  user: User;
  onClose: () => void;
  onSave: (profile: { name: string; statusText: string }) => Promise<void>;
  onLogoutAll: () => Promise<void>;
}
export const ProfileModal: React.FC<Props> = ({
  isOpen,
  user,
  onClose,
  onSave,
  onLogoutAll,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [name, setName] = useState(user.name);
  const [statusText, setStatusText] = useState(user.statusText || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);
  useDialog(isOpen, ref, () => {
    if (!pending) onClose();
  });
  useEffect(() => {
    if (isOpen) {
      setName(user.name);
      setStatusText(user.statusText || "");
      setError("");
      setConfirmLogout(false);
    }
  }, [isOpen, user.id]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onSave({ name: name.trim(), statusText: statusText.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Profile was not saved.");
    } finally {
      setPending(false);
    }
  };
  const logoutAll = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await onLogoutAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Your sessions could not be revoked.",
      );
    } finally {
      setPending(false);
    }
  };
  if (!isOpen) return null;
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
        aria-labelledby="profile-title"
        className="brutal-card p-6 max-w-lg max-h-[85dvh] overflow-auto w-full space-y-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="profile-title" className="font-display text-xl">
          Profile
        </h2>
        <p className="text-xs">{user.handle}</p>
        <form onSubmit={save} className="space-y-4">
          <label className="block font-bold text-sm">
            Display name
            <input
              aria-label="Display name"
              className="brutal-input mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              required
              disabled={pending}
              autoComplete="name"
            />
          </label>
          <label className="block font-bold text-sm">
            Status message
            <textarea
              aria-label="Status message"
              className="brutal-input mt-2"
              value={statusText}
              onChange={(event) => setStatusText(event.target.value)}
              maxLength={160}
              disabled={pending}
            />
          </label>
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-3">
            <button className="brutal-btn" disabled={pending || !name.trim()}>
              {pending ? "Saving..." : "Save profile"}
            </button>
            <button
              className="brutal-btn brutal-btn-outline"
              type="button"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
        <section className="border-t-[2px] pt-4 space-y-3">
          <h3 className="font-display text-sm">Account sessions</h3>
          {confirmLogout ? (
            <>
              <p className="text-sm">
                Log out on every device, including this one? You will need to
                sign in again.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="brutal-btn brutal-btn-pink brutal-btn-sm"
                  disabled={pending}
                  onClick={() => void logoutAll()}
                >
                  Confirm logout everywhere
                </button>
                <button
                  className="brutal-btn brutal-btn-outline brutal-btn-sm"
                  disabled={pending}
                  onClick={() => setConfirmLogout(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              className="brutal-btn brutal-btn-outline brutal-btn-sm"
              disabled={pending}
              onClick={() => setConfirmLogout(true)}
            >
              Log out all devices
            </button>
          )}
        </section>
      </div>
    </div>
  );
};
