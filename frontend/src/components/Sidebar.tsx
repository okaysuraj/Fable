import React from 'react';
import { Channel, User, CallMode } from '../types/chat';
import {
  IconHash,
  IconRadio,
  IconVideo,
  IconMic,
  IconMicOff,
  IconHeadphones,
  IconSettings,
  IconSearch,
} from './icons/Icons';

interface SidebarProps {
  channels: Channel[];
  teamMembers: User[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  currentUser: User;
  isMuted: boolean;
  onToggleMute: () => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  activeCallMode: CallMode;
  onJoinHuddle: (channel: Channel, mode: 'audio' | 'video') => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  channels,
  teamMembers,
  activeChannelId,
  onSelectChannel,
  currentUser,
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  onOpenSettings,
  onOpenCommandPalette,
  activeCallMode,
  onJoinHuddle,
  onLogout,
}) => {
  return (
    <aside className="w-72 h-full flex flex-col bg-[var(--bg-sidebar)] border-r-[3px] border-[var(--border)] select-none shrink-0 z-20">
      {/* Workspace Branding */}
      <div className="p-4 border-b-[3px] border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center font-display text-xl border-[3px] border-[var(--border)]"
            style={{ background: 'var(--accent-yellow)', boxShadow: 'var(--shadow-sm)' }}
          >
            F
          </div>
          <div>
            <h1 className="font-display text-lg tracking-tight leading-none">
              FABLE
            </h1>
            <p className="font-mono-code text-[10px] text-[var(--ink-muted)] uppercase tracking-widest mt-0.5">
              STUDIO v2.4
            </p>
          </div>
        </div>

        <button
          onClick={onOpenCommandPalette}
          title="Command Palette (Cmd+K)"
          className="brutal-btn brutal-btn-outline brutal-btn-sm p-2"
        >
          <IconSearch size={14} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Quick Search */}
        <button
          onClick={onOpenCommandPalette}
          className="w-full flex items-center justify-between px-3 py-2.5 border-[2px] border-[var(--border)] text-xs font-bold uppercase tracking-wider text-[var(--ink-muted)] hover:bg-[var(--bg-card-alt)] transition-colors cursor-pointer text-left"
        >
          <span className="flex items-center gap-2">
            <IconSearch size={13} />
            <span>SEARCH...</span>
          </span>
          <kbd className="font-mono-code px-1.5 py-0.5 text-[10px] border-[2px] border-[var(--border)] bg-white">
            ⌘K
          </kbd>
        </button>

        {/* Live Sessions */}
        {channels.some((c) => c.activeCall) && (
          <div className="space-y-2">
            <div className="px-2 flex items-center gap-2 font-display text-xs uppercase tracking-wider text-[var(--accent-green)]">
              <span className="w-2.5 h-2.5 bg-[var(--accent-green)] animate-pulse" />
              LIVE SESSIONS
            </div>
            {channels
              .filter((c) => c.activeCall)
              .map((channel) => (
                <div
                  key={`live_${channel.id}`}
                  className="p-3 border-[3px] border-[var(--accent-green)] bg-[#E8FFF0] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-8 h-8 flex items-center justify-center border-[2px] border-[var(--border)] shrink-0"
                      style={{ background: 'var(--accent-green)' }}
                    >
                      {channel.activeCall?.mode === 'video' ? (
                        <IconVideo size={13} />
                      ) : (
                        <IconRadio size={13} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">#{channel.name}</p>
                      <p className="text-[10px] font-mono-code text-[var(--ink-secondary)]">
                        {channel.activeCall?.participantCount} speaking
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => onJoinHuddle(channel, channel.activeCall!.mode)}
                    className="brutal-btn brutal-btn-green brutal-btn-sm"
                  >
                    JOIN
                  </button>
                </div>
              ))}
          </div>
        )}

        {/* Channels List */}
        <div className="space-y-1">
          <div className="px-2 font-display text-xs uppercase tracking-wider text-[var(--ink-muted)] mb-2 flex items-center justify-between">
            <span>ROOMS</span>
            <span className="font-mono-code text-[10px]">{channels.length}</span>
          </div>

          {channels.map((channel) => {
            const isActive = activeChannelId === channel.id;
            return (
              <button
                key={channel.id}
                onClick={() => onSelectChannel(channel.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wide transition-all cursor-pointer text-left border-[2px] ${
                  isActive
                    ? 'bg-[var(--accent-yellow)] border-[var(--border)] shadow-[var(--shadow-sm)]'
                    : 'border-transparent hover:bg-[var(--bg-card-alt)] hover:border-[var(--border)]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={isActive ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'}>
                    {channel.type === 'video' ? (
                      <IconVideo size={14} />
                    ) : channel.type === 'audio' ? (
                      <IconRadio size={14} />
                    ) : (
                      <IconHash size={14} />
                    )}
                  </span>
                  <span className="truncate">{channel.name}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {channel.unreadCount ? (
                    <span
                      className="px-1.5 py-0.5 text-[10px] font-mono-code font-bold border-[2px] border-[var(--border)]"
                      style={{ background: 'var(--accent-pink)', color: 'white' }}
                    >
                      {channel.unreadCount}
                    </span>
                  ) : null}
                  {channel.activeCall && (
                    <span className="w-2 h-2 bg-[var(--accent-green)]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Team Members */}
        <div className="space-y-1">
          <div className="px-2 font-display text-xs uppercase tracking-wider text-[var(--ink-muted)] mb-2 flex items-center justify-between">
            <span>TEAM</span>
            <span className="font-mono-code text-[10px]">
              {teamMembers.filter((m) => m.status !== 'offline').length} ONLINE
            </span>
          </div>

          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-[var(--bg-card-alt)] transition-colors cursor-pointer border-[2px] border-transparent hover:border-[var(--border)]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <div className="w-7 h-7 flex items-center justify-center font-mono-code text-[10px] font-bold border-[2px] border-[var(--border)] bg-white">
                    {member.monogram}
                  </div>
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-[2px] border-[var(--bg-sidebar)] ${
                      member.status === 'online'
                        ? 'bg-[var(--accent-green)]'
                        : member.status === 'in-huddle'
                        ? 'bg-[var(--accent-orange)]'
                        : member.status === 'idle'
                        ? 'bg-[var(--accent-yellow)]'
                        : 'bg-[var(--ink-faint)]'
                    }`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{member.name}</p>
                  <p className="text-[10px] text-[var(--ink-muted)] font-mono-code truncate">
                    {member.statusText || member.role}
                  </p>
                </div>
              </div>

              {member.status === 'in-huddle' && (
                <span className="brutal-tag text-[9px]" style={{ background: 'var(--accent-orange)', color: 'white', borderColor: 'var(--border)' }}>
                  LIVE
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Profile & Controls */}
      <div className="p-3 border-t-[3px] border-[var(--border)] bg-white flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div
              className="w-9 h-9 flex items-center justify-center font-mono-code text-xs font-bold border-[3px] border-[var(--border)]"
              style={{ background: 'var(--accent-yellow)' }}
            >
              {currentUser.monogram}
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[var(--accent-green)] border-[2px] border-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold truncate">{currentUser.name}</p>
              {activeCallMode !== 'none' && (
                <span className="brutal-tag text-[8px] py-0 px-1" style={{ background: 'var(--accent-green)', color: 'var(--ink)' }}>
                  LIVE
                </span>
              )}
            </div>
            <p className="text-[10px] font-mono-code text-[var(--ink-muted)] truncate">
              {currentUser.handle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            className={`brutal-btn brutal-btn-sm p-1.5 ${
              isMuted ? 'brutal-btn-pink' : 'brutal-btn-outline'
            }`}
          >
            {isMuted ? <IconMicOff size={14} /> : <IconMic size={14} />}
          </button>

          <button
            onClick={onToggleDeafen}
            title={isDeafened ? 'Undeafen (D)' : 'Deafen (D)'}
            className={`brutal-btn brutal-btn-sm p-1.5 ${
              isDeafened ? 'brutal-btn-pink' : 'brutal-btn-outline'
            }`}
          >
            <IconHeadphones size={14} />
          </button>

          <button
            onClick={onOpenSettings}
            title="Settings"
            className="brutal-btn brutal-btn-outline brutal-btn-sm p-1.5"
          >
            <IconSettings size={14} />
          </button>

          <button
            onClick={onLogout}
            title="Log out"
            className="brutal-btn brutal-btn-outline brutal-btn-sm p-1.5 text-[var(--accent-pink)]"
          >
            ✕
          </button>
        </div>
      </div>
    </aside>
  );
};
