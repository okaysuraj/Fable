/** Keyboard navigation and quick selection use the currently authorized room/member directory. */
import React, { useState, useEffect, useRef } from "react";
import { useDialog } from "./useDialog";
import { useDirectory } from "./useDirectory";
import { api } from "../services/api";
import { Channel, User } from "../types/chat";
import { IconSearch, IconHash, IconSettings } from "./icons/Icons";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  teamMembers: User[];
  onSelectChannel: (channelId: string) => void;
  onOpenSettings: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  channels: _channels,
  teamMembers: _teamMembers,
  onSelectChannel,
  onOpenSettings,
}) => {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialog(isOpen, dialogRef, onClose);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rooms = useDirectory(
    api.fetchChannelDirectory,
    localStorage.getItem("fable_workspace") || "",
    isOpen,
  );

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      rooms.search("");
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const channelItems = rooms.data.map((c) => ({
    id: `ch_${c.id}`,
    title: `#${c.name}`,
    subtitle: c.topic,
    icon: <IconHash size={14} />,
    action: () => onSelectChannel(c.id),
    category: "ROOMS",
  }));

  const actionItems = [
    {
      id: "act_settings",
      title: "OPEN PREFERENCES",
      subtitle: "Account preferences",
      icon: <IconSettings size={14} />,
      action: onOpenSettings,
      category: "ACTIONS",
    },
  ].filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase()),
  );

  const allItems = [...channelItems, ...actionItems];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + allItems.length) % (allItems.length || 1),
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl border-[3px] border-[var(--border)] bg-[var(--bg-card)] overflow-hidden flex flex-col max-h-[65vh]"
        style={{ boxShadow: "var(--shadow-lg)" }}
      >
        {/* Search Input */}
        <div className="h-14 px-4 border-b-[3px] border-[var(--border)] flex items-center gap-3 bg-[var(--accent-yellow)]">
          <IconSearch size={18} />
          <input
            aria-label="Search rooms and commands"
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              rooms.search(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="TYPE A COMMAND OR ROOM NAME..."
            className="flex-1 bg-transparent text-sm font-bold uppercase tracking-wide placeholder:text-[var(--ink-secondary)] focus:outline-none"
          />
          <kbd className="font-mono-code px-2 py-0.5 text-[10px] font-bold border-[2px] border-[var(--border)] bg-[var(--bg-card)]">
            ESC
          </kbd>
        </div>

        <div className="p-2 border-b-[2px] space-y-2">
          <p role="status" className="text-xs">
            {rooms.loading
              ? "Searching rooms..."
              : `Showing ${rooms.data.length} of ${rooms.total} rooms`}
          </p>
          {rooms.error && (
            <p role="alert" className="text-xs">
              {rooms.error}
            </p>
          )}
          {(rooms.hasPrevious || rooms.hasMore) && (
            <div className="flex gap-2">
              <button
                className="brutal-btn brutal-btn-sm"
                disabled={rooms.loading || !rooms.hasPrevious}
                onClick={() => {
                  rooms.previous();
                  setSelectedIndex(0);
                }}
              >
                Previous results
              </button>
              <button
                className="brutal-btn brutal-btn-sm"
                disabled={rooms.loading || !rooms.hasMore}
                onClick={() => {
                  rooms.next();
                  setSelectedIndex(0);
                }}
              >
                Next results
              </button>
              {rooms.hasPrevious && (
                <button
                  className="brutal-btn brutal-btn-sm"
                  disabled={rooms.loading}
                  onClick={() => {
                    rooms.first();
                    setSelectedIndex(0);
                  }}
                >
                  First results
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {allItems.length === 0 ? (
            <div className="p-8 text-center font-mono-code text-xs text-[var(--ink-muted)] uppercase">
              NO RESULTS FOR "{query}"
            </div>
          ) : (
            allItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full flex items-center justify-between p-3 text-left text-xs transition-colors cursor-pointer border-[2px] ${
                    isSelected
                      ? "bg-[var(--accent-yellow)] border-[var(--border)] shadow-[var(--shadow-sm)]"
                      : "border-transparent hover:bg-[var(--bg-card-alt)]"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="font-bold uppercase tracking-wide truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] font-mono-code text-[var(--ink-muted)] truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  <span className="brutal-tag text-[9px] py-0 shrink-0 ml-2">
                    {item.category}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
