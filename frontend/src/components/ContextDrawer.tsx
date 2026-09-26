import React from 'react';
import { Channel, User, CallParticipant } from '../types/chat';
import {
  IconClose,
  IconPin,
  IconUsers,
  IconMicOff,
} from './icons/Icons';

interface ContextDrawerProps {
  channel: Channel;
  teamMembers: User[];
  callParticipants: CallParticipant[];
  isOpen: boolean;
  onClose: () => void;
}

export const ContextDrawer: React.FC<ContextDrawerProps> = ({
  channel,
  teamMembers,
  callParticipants,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <aside className="w-72 h-full bg-[var(--bg-sidebar)] border-l-[3px] border-[var(--border)] flex flex-col shrink-0 z-20 select-none">
      {/* Header */}
      <div className="h-16 px-4 border-b-[3px] border-[var(--border)] flex items-center justify-between bg-white">
        <div className="flex items-center gap-2">
          <IconUsers size={15} />
          <h3 className="font-display text-sm uppercase tracking-tight">
            INSPECTOR
          </h3>
        </div>
        <button
          onClick={onClose}
          className="brutal-btn brutal-btn-outline brutal-btn-sm p-1.5"
        >
          <IconClose size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Room Info */}
        <div className="space-y-2">
          <span className="font-display text-[10px] uppercase tracking-widest text-[var(--ink-muted)]">
            ROOM
          </span>
          <div className="p-3 border-[3px] border-[var(--border)] bg-white" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-sm font-bold uppercase">#{channel.name}</p>
            <p className="text-[11px] text-[var(--ink-secondary)] mt-1 leading-relaxed">
              {channel.topic}
            </p>
          </div>
        </div>

        {/* Members */}
        <div className="space-y-2">
          <div className="flex items-center justify-between font-display text-[10px] uppercase tracking-widest text-[var(--ink-muted)]">
            <span>MEMBERS</span>
            <span className="font-mono-code">{teamMembers.length}</span>
          </div>

          <div className="space-y-1">
            {teamMembers.map((member) => {
              const inCall = callParticipants.some((p) => p.user.id === member.id);
              const participantData = callParticipants.find((p) => p.user.id === member.id);

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-2 hover:bg-[var(--bg-card-alt)] transition-colors border-[2px] border-transparent hover:border-[var(--border)]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 flex items-center justify-center font-mono-code text-[10px] font-bold border-[2px] border-[var(--border)] bg-white shrink-0">
                      {member.monogram}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{member.name}</p>
                      <p className="text-[10px] font-mono-code text-[var(--ink-muted)] truncate">
                        {member.role}
                      </p>
                    </div>
                  </div>

                  {inCall && (
                    <div className="flex items-center gap-1">
                      {participantData?.isMuted ? (
                        <IconMicOff size={11} className="text-[var(--accent-pink)]" />
                      ) : (
                        <span className="w-2.5 h-2.5 bg-[var(--accent-green)] animate-pulse" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Diagnostics */}
        <div className="space-y-2">
          <span className="font-display text-[10px] uppercase tracking-widest text-[var(--ink-muted)]">
            DIAGNOSTICS
          </span>
          <div className="p-3 border-[3px] border-[var(--border)] bg-white space-y-2 text-[11px] font-mono-code" style={{ boxShadow: 'var(--shadow-sm)' }}>
            {[
              { label: 'CODEC', value: 'Opus 48kHz' },
              { label: 'BITRATE', value: '128 kbps' },
              { label: 'LATENCY', value: '18 ms', color: 'var(--accent-green)' },
              { label: 'SECURITY', value: 'DTLS-SRTP (E2EE)' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[var(--ink-muted)]">{item.label}</span>
                <span className="font-bold" style={item.color ? { color: item.color } : {}}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pinned */}
        <div className="space-y-2">
          <span className="font-display text-[10px] uppercase tracking-widest text-[var(--ink-muted)]">
            PINNED
          </span>
          <div className="p-3 border-[3px] border-[var(--border)] bg-[var(--bg-card-alt)] space-y-1" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex items-center gap-1.5 text-[10px] font-mono-code font-bold" style={{ color: 'var(--accent-orange)' }}>
              <IconPin size={11} />
              TYPOGRAPHY GUIDANCE
            </div>
            <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
              Newsreader display headings set to -0.02em tracking. No raw pure blacks or harsh shadow filters.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
