/** Persist appearance changes through the API and keep failed saves visible. */
import { useEffect, useRef, useState } from "react";
import { WorkspaceSettings } from "../types/chat";
import { useDialog } from "./useDialog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: WorkspaceSettings;
  onUpdateSettings: (settings: Partial<WorkspaceSettings>) => Promise<void>;
}

export function SettingsModal({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(isOpen, dialogRef, () => {
    if (!saving) onClose();
  });
  useEffect(() => {
    if (isOpen) {
      setError("");
      setSaved(false);
    }
  }, [isOpen]);
  const save = async (theme: "light" | "dark") => {
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await onUpdateSettings({ theme });
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Your preference was not saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
        className="brutal-card w-full max-w-lg max-h-[85dvh] overflow-y-auto p-6 space-y-5"
      >
        <div className="flex justify-between gap-4">
          <h2 id="settings-title" className="font-display text-xl">
            Preferences
          </h2>
          <button
            className="brutal-btn brutal-btn-sm"
            disabled={saving}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <p className="text-sm">
          Your appearance preference is saved to your account and used on web
          and mobile.
        </p>
        {error && (
          <p role="alert" className="text-sm">
            {error}
          </p>
        )}
        <label className="block text-sm font-bold">
          Appearance
          <select
            className="brutal-input mt-2"
            value={settings.theme}
            disabled={saving}
            onChange={(event) =>
              void save(event.target.value as "light" | "dark")
            }
          >
            <option value="light">Light paper</option>
            <option value="dark">Dark paper</option>
          </select>
        </label>
        <section className="space-y-2 border-t-[2px] pt-4">
          <h3 className="font-display">Keyboard shortcuts</h3>
          <p className="text-sm">
            Ctrl/Cmd + K opens the room palette. Escape closes dialogs and
            panels. Shift + Enter starts a new line in a message.
          </p>
        </section>
        {(saving || saved) && (
          <p role="status" className="text-sm">
            {saving ? "Saving preference..." : "Appearance saved."}
          </p>
        )}
      </div>
    </div>
  );
}
