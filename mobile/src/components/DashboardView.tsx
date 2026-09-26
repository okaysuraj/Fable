import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Pressable,
} from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';
import {
  Channel,
  Message,
  User,
  CallMode,
  CallParticipant,
  WorkspaceSettings,
} from '@/types';
import {
  INITIAL_CHANNELS,
  INITIAL_MESSAGES,
  TEAM_MEMBERS,
  INITIAL_CALL_PARTICIPANTS,
  DEFAULT_SETTINGS,
} from '@/data/mockData';
import { api } from '@/services/api';
import { MobileChatView } from './chat/MobileChatView';
import { MobileAudioHuddle } from './audio/MobileAudioHuddle';
import { MobileVideoSalon } from './video/MobileVideoSalon';
import { SidebarDrawer } from './SidebarDrawer';
import { ContextDrawerModal } from './ContextDrawerModal';
import { SettingsModalView } from './SettingsModalView';
import { CommandPaletteModal } from './CommandPaletteModal';

interface DashboardViewProps {
  currentUser: User;
  onLogout: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  onLogout,
}) => {
  const [channels, setChannels] = useState<Channel[]>(INITIAL_CHANNELS);
  const [activeChannelId, setActiveChannelId] = useState<string>(
    INITIAL_CHANNELS[0]?.id || ''
  );
  const [messages, setMessages] = useState<Record<string, Message[]>>(INITIAL_MESSAGES);
  const [teamMembers, setTeamMembers] = useState<User[]>(TEAM_MEMBERS);
  const [participants] = useState<CallParticipant[]>(INITIAL_CALL_PARTICIPANTS);

  // Call states
  const [callMode, setCallMode] = useState<CallMode>('none');
  const [isPiP, setIsPiP] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [isVideoOn, setIsVideoOn] = useState<boolean>(false);

  // Modals & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);

  // Settings
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);

  // Initial data load
  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [fetchedChannels, allMessages, fetchedSettings, fetchedTeam] =
          await Promise.allSettled([
            api.fetchChannels(),
            api.fetchAllMessages(),
            api.fetchSettings(),
            api.fetchTeamMembers(),
          ]);

        if (mounted) {
          if (fetchedChannels.status === 'fulfilled' && fetchedChannels.value.length > 0) {
            setChannels(fetchedChannels.value);
            if (!activeChannelId) {
              setActiveChannelId(fetchedChannels.value[0].id);
            }
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
        console.warn('Mobile data load failed:', err);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const activeChannel =
    channels.find((c) => c.id === activeChannelId) || channels[0];

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
        console.warn('Sync failed:', err);
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
        console.warn('Reaction sync error:', err);
      }
    },
    [activeChannelId]
  );

  // Call controls
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
      <SafeAreaView style={styles.loadingArea}>
        <View style={styles.loadingBox}>
          <Text style={styles.loadingTitle}>LOADING STUDIO...</Text>
          <Text style={styles.loadingSub}>Fable mobile environment</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={BrutalColors.bgPaper} />
      <View style={styles.container}>
        {/* Main Stage Content */}
        {callMode === 'audio' && !isPiP ? (
          <MobileAudioHuddle
            channel={activeChannel}
            participants={participants}
            currentUser={currentUser}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted((m) => !m)}
            isDeafened={isDeafened}
            onToggleDeafen={() => setIsDeafened((d) => !d)}
            onLeaveCall={handleLeaveCall}
            onUpgradeToVideo={() => handleStartCall('video')}
            onMinimizeToPiP={() => setIsPiP(true)}
          />
        ) : callMode === 'video' && !isPiP ? (
          <MobileVideoSalon
            channel={activeChannel}
            participants={participants}
            currentUser={currentUser}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted((m) => !m)}
            isVideoOn={isVideoOn}
            onToggleVideo={() => setIsVideoOn((v) => !v)}
            onLeaveCall={handleLeaveCall}
            onMinimizeToPiP={() => setIsPiP(true)}
          />
        ) : (
          <View style={styles.chatWrapper}>
            <MobileChatView
              channel={activeChannel}
              messages={messages[activeChannelId] || []}
              currentUser={currentUser}
              onSendMessage={handleSendMessage}
              onToggleReaction={handleToggleReaction}
              onStartCall={handleStartCall}
              activeCallMode={callMode}
              onToggleDrawer={() => setIsDrawerOpen(true)}
              onOpenContextDrawer={() => setIsContextDrawerOpen(true)}
            />

            {/* Floating PiP Bar if in call */}
            {callMode !== 'none' && isPiP && (
              <Pressable
                onPress={() => setIsPiP(false)}
                style={styles.pipBar}
              >
                <View style={styles.pipDot} />
                <Text style={styles.pipText}>
                  {callMode === 'audio' ? 'VOICE HUDDLE ACTIVE' : 'VIDEO SALON ACTIVE'} (#{activeChannel.name})
                </Text>
                <Pressable onPress={handleLeaveCall} style={styles.pipLeaveBtn}>
                  <Text style={styles.pipLeaveBtnText}>END</Text>
                </Pressable>
              </Pressable>
            )}
          </View>
        )}

        {/* ═══ SIDEBAR DRAWER MODAL ═══ */}
        <Modal
          visible={isDrawerOpen}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setIsDrawerOpen(false)}
        >
          <SidebarDrawer
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
            onOpenSettings={() => {
              setIsDrawerOpen(false);
              setIsSettingsOpen(true);
            }}
            onOpenSearch={() => {
              setIsDrawerOpen(false);
              setIsCommandPaletteOpen(true);
            }}
            activeCallMode={callMode}
            onJoinHuddle={(channel, mode) => {
              setActiveChannelId(channel.id);
              handleStartCall(mode);
            }}
            onLogout={onLogout}
            onClose={() => setIsDrawerOpen(false)}
          />
        </Modal>

        {/* ═══ CONTEXT / MEMBERS DRAWER ═══ */}
        <ContextDrawerModal
          visible={isContextDrawerOpen}
          onClose={() => setIsContextDrawerOpen(false)}
          channel={activeChannel}
          teamMembers={teamMembers}
          callParticipants={participants}
        />

        {/* ═══ WORKSPACE SETTINGS MODAL ═══ */}
        <SettingsModalView
          visible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={(newVals) => {
            setSettings((prev) => ({ ...prev, ...newVals }));
            api.updateSettings(newVals).catch(() => {});
          }}
        />

        {/* ═══ COMMAND PALETTE / SEARCH MODAL ═══ */}
        <CommandPaletteModal
          visible={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          channels={channels}
          teamMembers={teamMembers}
          onSelectChannel={(id) => setActiveChannelId(id)}
          onStartCall={handleStartCall}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleMute={() => setIsMuted((m) => !m)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BrutalColors.bgPaper,
  },
  container: {
    flex: 1,
  },
  chatWrapper: {
    flex: 1,
    position: 'relative',
  },
  pipBar: {
    position: 'absolute',
    top: 55,
    left: 14,
    right: 14,
    backgroundColor: BrutalColors.ink,
    borderWidth: 2.5,
    borderColor: BrutalColors.accentGreen,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 99,
  },
  pipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrutalColors.accentGreen,
  },
  pipText: {
    flex: 1,
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pipLeaveBtn: {
    borderWidth: 1.5,
    borderColor: BrutalColors.accentPink,
    borderRadius: 3,
    backgroundColor: '#FFE0E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pipLeaveBtnText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '900',
    color: BrutalColors.accentPink,
  },
  loadingArea: {
    flex: 1,
    backgroundColor: BrutalColors.bgPaper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    backgroundColor: BrutalColors.bgCard,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    padding: 24,
    borderRadius: 4,
    alignItems: 'center',
    gap: 8,
  },
  loadingTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 18,
    color: BrutalColors.ink,
  },
  loadingSub: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    color: BrutalColors.inkMuted,
  },
});
