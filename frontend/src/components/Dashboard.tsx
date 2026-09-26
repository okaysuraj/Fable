import React, { useState, useEffect, useCallback } from 'react';
import {
  Channel,
  Message,
  CallMode,
  CallParticipant,
  WorkspaceSettings,
  User,
} from '../types/chat';
import {
  INITIAL_CALL_PARTICIPANTS,
  DEFAULT_SETTINGS,
} from '../data/mockData';
import { api } from '../services/api';
import { Sidebar } from './Sidebar';
import { MainStage } from './MainStage';
import { ContextDrawer } from './ContextDrawer';
import { SettingsModal } from './SettingsModal';
import { CommandPalette } from './CommandPalette';

interface DashboardProps {
  currentUser: User;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ currentUser, onLogout }) => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('');
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [participants] = useState<CallParticipant[]>(INITIAL_CALL_PARTICIPANTS);

  // Audio/Video and Call States
  const [callMode, setCallMode] = useState<CallMode>('none');
  const [isPiP, setIsPiP] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(false);

  // UI Panels and Modals
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Preferences
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);

  // Initial data load
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [fetchedChannels, allMessages, fetchedSettings, fetchedTeam] = await Promise.allSettled([
          api.fetchChannels(),
          api.fetchAllMessages(),
          api.fetchSettings(),
          api.fetchTeamMembers(),
        ]);

        if (mounted) {
          if (fetchedChannels.status === 'fulfilled' && fetchedChannels.value.length > 0) {
            setChannels(fetchedChannels.value);
            setActiveChannelId(fetchedChannels.value[0].id);
          }
          if (allMessages.status === 'fulfilled') {
            setMessages(allMessages.value);
          }
          if (fetchedSettings.status === 'fulfilled') {
            setSettings(fetchedSettings.value);
          }
          if (fetchedTeam.status === 'fulfilled') {
            setTeamMembers(fetchedTeam.value);
          }
        }
      } catch (err) {
        console.warn('Failed to load data:', err);
      }
    };

    loadData();
    return () => { mounted = false; };
  }, []);

  const activeChannel = channels.find((c) => c.id === activeChannelId) || channels[0];

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
        setIsSettingsOpen(false);
        return;
      }

      if (!isInput) {
        if (e.key.toLowerCase() === 'm') {
          e.preventDefault();
          setIsMuted((prev) => !prev);
        } else if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          setIsVideoOn((prev) => !prev);
        } else if (e.key.toLowerCase() === 'd') {
          e.preventDefault();
          setIsDeafened((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Send message
  const handleSendMessage = useCallback(
    async (content: string, voiceNote?: { duration: string; waveform: number[] }) => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      const timestamp = `${formattedHours}:${formattedMinutes} ${ampm}`;

      const tempId = `msg_${Date.now()}`;
      const optimisticMsg: Message = {
        id: tempId,
        channelId: activeChannelId,
        sender: currentUser,
        timestamp,
        content,
        voiceNote,
      };

      setMessages((prev) => ({
        ...prev,
        [activeChannelId]: [...(prev[activeChannelId] || []), optimisticMsg],
      }));

      try {
        const saved = await api.sendMessage(activeChannelId, content, voiceNote);
        setMessages((prev) => ({
          ...prev,
          [activeChannelId]: (prev[activeChannelId] || []).map((m) =>
            m.id === tempId ? saved : m
          ),
        }));
      } catch (err) {
        console.warn('Message sync failed:', err);
      }
    },
    [activeChannelId, currentUser]
  );

  // Toggle reactions
  const handleToggleReaction = useCallback(
    async (messageId: string, icon: string) => {
      setMessages((prev) => {
        const channelMessages = prev[activeChannelId] || [];
        const updated = channelMessages.map((msg) => {
          if (msg.id !== messageId) return msg;

          const existingReactions = msg.reactions ? [...msg.reactions] : [];
          const existingIndex = existingReactions.findIndex((r) => r.icon === icon);

          if (existingIndex >= 0) {
            const current = existingReactions[existingIndex];
            if (current.reactedByMe) {
              if (current.count <= 1) {
                existingReactions.splice(existingIndex, 1);
              } else {
                existingReactions[existingIndex] = {
                  ...current,
                  count: current.count - 1,
                  reactedByMe: false,
                };
              }
            } else {
              existingReactions[existingIndex] = {
                ...current,
                count: current.count + 1,
                reactedByMe: true,
              };
            }
          } else {
            existingReactions.push({ icon, count: 1, reactedByMe: true });
          }

          return { ...msg, reactions: existingReactions };
        });

        return { ...prev, [activeChannelId]: updated };
      });

      try {
        await api.toggleReaction(messageId, icon);
      } catch (err) {
        console.warn('Reaction sync failed:', err);
      }
    },
    [activeChannelId]
  );

  // Call management
  const handleStartCall = useCallback((mode: 'audio' | 'video') => {
    setCallMode(mode);
    setIsPiP(false);
    if (mode === 'video') setIsVideoOn(true);
  }, []);

  const handleLeaveCall = useCallback(() => {
    setCallMode('none');
    setIsPiP(false);
    setIsVideoOn(false);
  }, []);

  if (!activeChannel) {
    return (
      <div className="flex h-screen w-screen bg-[var(--bg-paper)] items-center justify-center">
        <div className="brutal-card p-8 text-center">
          <p className="font-display text-xl">LOADING STUDIO...</p>
          <p className="font-mono-code text-sm text-[var(--ink-muted)] mt-2">
            Connecting to Postgres
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-paper)] overflow-hidden font-sans">
      {/* Left Sidebar */}
      <Sidebar
        channels={channels}
        teamMembers={teamMembers}
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          if (callMode !== 'none') setIsPiP(true);
        }}
        currentUser={currentUser}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted((m) => !m)}
        isDeafened={isDeafened}
        onToggleDeafen={() => setIsDeafened((d) => !d)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        activeCallMode={callMode}
        onJoinHuddle={(channel, mode) => {
          setActiveChannelId(channel.id);
          handleStartCall(mode);
        }}
        onLogout={onLogout}
      />

      {/* Center Stage */}
      <MainStage
        channel={activeChannel}
        messages={messages[activeChannelId] || []}
        currentUser={currentUser}
        onSendMessage={handleSendMessage}
        onToggleReaction={handleToggleReaction}
        callMode={callMode}
        onStartCall={handleStartCall}
        onLeaveCall={handleLeaveCall}
        participants={participants}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted((m) => !m)}
        isDeafened={isDeafened}
        onToggleDeafen={() => setIsDeafened((d) => !d)}
        isVideoOn={isVideoOn}
        onToggleVideo={() => setIsVideoOn((v) => !v)}
        isPiP={isPiP}
        setIsPiP={setIsPiP}
        onToggleDrawer={() => setIsDrawerOpen((o) => !o)}
        isDrawerOpen={isDrawerOpen}
      />

      {/* Right Drawer */}
      <ContextDrawer
        channel={activeChannel}
        teamMembers={teamMembers}
        callParticipants={participants}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newVals) => {
          setSettings((prev) => ({ ...prev, ...newVals }));
          api.updateSettings(newVals).catch(() => {});
        }}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        channels={channels}
        teamMembers={teamMembers}
        onSelectChannel={(id) => setActiveChannelId(id)}
        onStartCall={handleStartCall}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleMute={() => setIsMuted((m) => !m)}
      />
    </div>
  );
};
