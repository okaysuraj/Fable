import React, { useState, useEffect, useRef } from 'react';
import { Channel, User } from '../types/chat';
import {
  IconSearch,
  IconHash,
  IconRadio,
  IconVideo,
  IconSettings,
  IconMic,
} from './icons/Icons';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  channels: Channel[];
  teamMembers: User[];
  onSelectChannel: (channelId: string) => void;
  onStartCall: (mode: 'audio' | 'video') => void;
  onOpenSettings: () => void;
  onToggleMute: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  channels,
  teamMembers,
  onSelectChannel,
  onStartCall,
  onOpenSettings,
  onToggleMute,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const channelItems = channels
    .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    .map((c) => ({
      id: `ch_${c.id}`,
      title: `#${c.name}`,
      subtitle: c.topic,
      icon: <IconHash size={14} />,
      action: () => onSelectChannel(c.id),
      category: 'ROOMS',
    }));

  const memberItems = teamMembers
    .filter(
      (m) =>
        m.name.toLowerCase().includes(query.toLowerCase()) ||
        m.handle.toLowerCase().includes(query.toLowerCase())
    )
    .map((m) => ({
      id: `usr_${m.id}`,
      title: `${m.name} (${m.handle})`,
      subtitle: `${m.role}`,
      icon: <IconSearch size={14} />,
      action: () => {},
      category: 'TEAM',
    }));

  const actionItems = [
    {
      id: 'act_audio',
      title: 'START AUDIO HUDDLE',
      subtitle: 'Open spatial voice room',
      icon: <IconRadio size={14} />,
      action: () => onStartCall('audio'),
      category: 'ACTIONS',
    },
    {
      id: 'act_video',
      title: 'START VIDEO SALON',
      subtitle: 'Connect 1080p camera',
      icon: <IconVideo size={14} />,
      action: () => onStartCall('video'),
      category: 'ACTIONS',
    },
    {
      id: 'act_mute',
      title: 'TOGGLE MUTE',
      subtitle: 'Shortcut: M',
      icon: <IconMic size={14} />,
      action: onToggleMute,
      category: 'ACTIONS',
    },
    {
      id: 'act_settings',
      title: 'OPEN PREFERENCES',
      subtitle: 'Hardware & acoustic settings',
      icon: <IconSettings size={14} />,
      action: onOpenSettings,
      category: 'ACTIONS',
    },
  ].filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  const allItems = [...channelItems, ...memberItems, ...actionItems];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (allItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + allItems.length) % (allItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl border-[3px] border-[var(--border)] bg-white overflow-hidden flex flex-col max-h-[65vh]"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Search Input */}
        <div className="h-14 px-4 border-b-[3px] border-[var(--border)] flex items-center gap-3 bg-[var(--accent-yellow)]">
          <IconSearch size={18} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="TYPE A COMMAND OR ROOM NAME..."
            className="flex-1 bg-transparent text-sm font-bold uppercase tracking-wide placeholder:text-[var(--ink-secondary)] focus:outline-none"
          />
          <kbd className="font-mono-code px-2 py-0.5 text-[10px] font-bold border-[2px] border-[var(--border)] bg-white">
            ESC
          </kbd>
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
                  className={`w-full flex items-center justify-between p-3 text-left text-xs transition-all cursor-pointer border-[2px] ${
                    isSelected
                      ? 'bg-[var(--accent-yellow)] border-[var(--border)] shadow-[var(--shadow-sm)]'
                      : 'border-transparent hover:bg-[var(--bg-card-alt)]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <p className="font-bold uppercase tracking-wide truncate">{item.title}</p>
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
