import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';
import { Channel, Message, User, CallMode } from '@/types';
import { MonogramAvatar } from '../brutal/MonogramAvatar';
import { BrutalInput } from '../brutal/BrutalInput';
import { BrutalCard } from '../brutal/BrutalCard';

interface MobileChatViewProps {
  channel: Channel;
  messages: Message[];
  currentUser: User;
  onSendMessage: (content: string, voiceNote?: { duration: string; waveform: number[] }) => void;
  onToggleReaction: (messageId: string, icon: string) => void;
  onStartCall: (mode: 'audio' | 'video') => void;
  activeCallMode: CallMode;
  onToggleDrawer: () => void;
  onOpenContextDrawer: () => void;
}

export const MobileChatView: React.FC<MobileChatViewProps> = ({
  channel,
  messages,
  currentUser,
  onSendMessage,
  onToggleReaction,
  onStartCall,
  activeCallMode,
  onToggleDrawer,
  onOpenContextDrawer,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (isRecordingVoice) {
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecordingVoice]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleFinishVoiceRecord = () => {
    const mins = Math.floor(recordingSeconds / 60);
    const secs = recordingSeconds % 60;
    const duration = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    const waveform = Array.from({ length: 20 }, () => Math.floor(Math.random() * 70) + 20);
    onSendMessage('Voice Note', { duration, waveform });
    setIsRecordingVoice(false);
  };

  const handleCancelVoiceRecord = () => {
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const pinnedMessages = messages.filter((m) => m.isPinned);

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isMe = item.sender.id === currentUser.id;

    return (
      <View style={styles.messageItem}>
        <MonogramAvatar
          monogram={item.sender.monogram || 'SJ'}
          backgroundColor={item.sender.avatarColor || BrutalColors.accentYellow}
          size={36}
          status={item.sender.status}
        />

        <View style={styles.messageContent}>
          {/* Header row */}
          <View style={styles.senderHeader}>
            <Text style={styles.senderName}>{item.sender.name}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{item.sender.role || 'Member'}</Text>
            </View>
            <Text style={styles.timestamp}>{item.timestamp}</Text>
          </View>

          {/* Text Content */}
          {item.content && (
            <Text style={styles.messageText}>{item.content}</Text>
          )}

          {/* Code Snippet */}
          {item.codeSnippet && (
            <View style={styles.codeSnippetCard}>
              <View style={styles.codeSnippetHeader}>
                <Text style={styles.codeSnippetLang}>
                  {item.codeSnippet.language.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.codeSnippetContent}>
                {item.codeSnippet.code}
              </Text>
            </View>
          )}

          {/* Voice Note Player */}
          {item.voiceNote && (
            <Pressable
              onPress={() =>
                setPlayingVoiceId(playingVoiceId === item.id ? null : item.id)
              }
              style={styles.voiceNoteCard}
            >
              <View style={styles.voicePlayBtn}>
                <Text style={styles.voicePlayBtnText}>
                  {playingVoiceId === item.id ? '⏸' : '▶'}
                </Text>
              </View>
              <View style={styles.waveformContainer}>
                {item.voiceNote.waveform.map((bar, i) => (
                  <View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: Math.max(6, Math.floor(bar * 0.35)),
                        backgroundColor:
                          playingVoiceId === item.id && i < 10
                            ? BrutalColors.accentGreen
                            : BrutalColors.ink,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.voiceDurationBadge}>
                <Text style={styles.voiceDurationText}>
                  {item.voiceNote.duration}
                </Text>
              </View>
            </Pressable>
          )}

          {/* Reactions */}
          <View style={styles.reactionsRow}>
            {item.reactions?.map((reaction) => (
              <Pressable
                key={reaction.icon}
                onPress={() => onToggleReaction(item.id, reaction.icon)}
                style={[
                  styles.reactionPill,
                  reaction.reactedByMe && styles.reactionPillActive,
                ]}
              >
                <Text style={styles.reactionIcon}>
                  {reaction.icon === 'sparkle'
                    ? '✦'
                    : reaction.icon === 'check'
                    ? '✓'
                    : reaction.icon === 'heart'
                    ? '❤️'
                    : reaction.icon}
                </Text>
                <Text
                  style={[
                    styles.reactionCount,
                    reaction.reactedByMe && styles.reactionCountActive,
                  ]}
                >
                  {reaction.count}
                </Text>
              </Pressable>
            ))}

            {/* Quick add reaction button */}
            <Pressable
              onPress={() => onToggleReaction(item.id, 'sparkle')}
              style={styles.addReactionBtn}
            >
              <Text style={styles.addReactionText}>+ ✦</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ═══ CHANNEL HEADER ═══ */}
        <View style={styles.header}>
          <Pressable onPress={onToggleDrawer} style={styles.menuBtn}>
            <Text style={styles.menuBtnText}>☰</Text>
          </Pressable>

          <View style={styles.channelMeta}>
            <View style={styles.channelTitleRow}>
              <View
                style={[
                  styles.channelBadge,
                  {
                    backgroundColor:
                      channel.type === 'video'
                        ? BrutalColors.accentBlue
                        : channel.type === 'audio'
                        ? BrutalColors.accentPink
                        : BrutalColors.accentYellow,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.channelBadgeText,
                    channel.type !== 'text' && { color: '#FFFFFF' },
                  ]}
                >
                  {channel.type === 'video' ? '▶' : channel.type === 'audio' ? '◉' : '#'}
                </Text>
              </View>
              <Text style={styles.channelTitle} numberOfLines={1}>
                {channel.name}
              </Text>
            </View>
            <Text style={styles.channelTopic} numberOfLines={1}>
              {channel.topic}
            </Text>
          </View>

          {/* Action Call Controls */}
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => onStartCall('audio')}
              style={[
                styles.headerActionBtn,
                activeCallMode === 'audio' && styles.headerActionBtnActive,
              ]}
            >
              <Text style={styles.headerActionIcon}>🎙️</Text>
            </Pressable>

            <Pressable
              onPress={() => onStartCall('video')}
              style={[
                styles.headerActionBtn,
                activeCallMode === 'video' && styles.headerActionBtnActive,
              ]}
            >
              <Text style={styles.headerActionIcon}>📹</Text>
            </Pressable>

            <Pressable onPress={onOpenContextDrawer} style={styles.headerActionBtn}>
              <Text style={styles.headerActionIcon}>ℹ️</Text>
            </Pressable>
          </View>
        </View>

        {/* ═══ PINNED MESSAGE BANNER ═══ */}
        {pinnedMessages.length > 0 && (
          <View style={styles.pinnedBanner}>
            <View style={styles.pinnedTag}>
              <Text style={styles.pinnedTagText}>PINNED</Text>
            </View>
            <Text style={styles.pinnedText} numberOfLines={1}>
              {pinnedMessages[0].content}
            </Text>
          </View>
        )}

        {/* ═══ MESSAGES STREAM ═══ */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* ═══ INPUT BAR DOCK ═══ */}
        {isRecordingVoice ? (
          <View style={styles.voiceRecordDock}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTimerText}>
              RECORDING: {formatSecs(recordingSeconds)}
            </Text>
            <Pressable onPress={handleCancelVoiceRecord} style={styles.voiceCancelBtn}>
              <Text style={styles.voiceCancelBtnText}>CANCEL</Text>
            </Pressable>
            <Pressable onPress={handleFinishVoiceRecord} style={styles.voiceFinishBtn}>
              <Text style={styles.voiceFinishBtnText}>DONE ✓</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.inputDock}>
            <BrutalInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={`Message #${channel.name}...`}
              style={styles.chatInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />

            <Pressable
              onPress={() => setIsRecordingVoice(true)}
              style={styles.micBtn}
            >
              <Text style={styles.micBtnText}>🎙️</Text>
            </Pressable>

            <Pressable onPress={handleSend} style={styles.sendBtn}>
              <Text style={styles.sendBtnText}>→</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BrutalColors.bgCard,
    borderBottomWidth: 3,
    borderBottomColor: BrutalColors.border,
    gap: 10,
  },
  menuBtn: {
    width: 36,
    height: 36,
    borderWidth: 2.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.accentYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: BrutalColors.ink,
  },
  channelMeta: {
    flex: 1,
  },
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  channelBadge: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelBadgeText: {
    fontFamily: Fonts?.mono,
    fontWeight: '900',
    fontSize: 11,
    color: BrutalColors.ink,
  },
  channelTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 16,
    color: BrutalColors.ink,
  },
  channelTopic: {
    fontFamily: Fonts?.sans,
    fontSize: 11,
    color: BrutalColors.inkMuted,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionBtnActive: {
    backgroundColor: BrutalColors.accentGreen,
  },
  headerActionIcon: {
    fontSize: 14,
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: BrutalColors.bgCardAlt,
    borderBottomWidth: 2,
    borderBottomColor: BrutalColors.border,
  },
  pinnedTag: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: BrutalColors.accentYellow,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pinnedTagText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '900',
    color: BrutalColors.ink,
  },
  pinnedText: {
    flex: 1,
    fontFamily: Fonts?.sans,
    fontSize: 11,
    fontWeight: '600',
    color: BrutalColors.inkSecondary,
  },
  messagesList: {
    padding: 14,
    gap: 14,
  },
  messageItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  messageContent: {
    flex: 1,
    backgroundColor: BrutalColors.bgCard,
    borderWidth: 2.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    padding: 12,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: `2px 2px 0px ${BrutalColors.border}`,
      },
      default: {
        shadowColor: BrutalColors.border,
        shadowOffset: { width: 2, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 2,
      },
    }),
  },
  senderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  senderName: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 13,
    color: BrutalColors.ink,
  },
  roleBadge: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: BrutalColors.bgCardAlt,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  roleText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.inkSecondary,
  },
  timestamp: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    color: BrutalColors.inkMuted,
    marginLeft: 'auto',
  },
  messageText: {
    fontFamily: Fonts?.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: BrutalColors.ink,
  },
  codeSnippetCard: {
    backgroundColor: BrutalColors.ink,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    padding: 10,
    gap: 6,
  },
  codeSnippetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  codeSnippetLang: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.accentYellow,
  },
  codeSnippetContent: {
    fontFamily: Fonts?.mono,
    fontSize: 12,
    color: '#FFFFFF',
    lineHeight: 18,
  },
  voiceNoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: BrutalColors.bgCardAlt,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    padding: 10,
  },
  voicePlayBtn: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 14,
    backgroundColor: BrutalColors.accentYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voicePlayBtnText: {
    fontSize: 11,
    fontWeight: '900',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 28,
  },
  waveBar: {
    width: 3,
    borderRadius: 1.5,
  },
  voiceDurationBadge: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  voiceDurationText: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '800',
    color: BrutalColors.ink,
  },
  reactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.bgCardAlt,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  reactionPillActive: {
    backgroundColor: BrutalColors.accentYellow,
    borderWidth: 2,
  },
  reactionIcon: {
    fontSize: 11,
  },
  reactionCount: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '800',
    color: BrutalColors.ink,
  },
  reactionCountActive: {
    fontWeight: '900',
  },
  addReactionBtn: {
    borderWidth: 1.5,
    borderColor: BrutalColors.inkFaint,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'transparent',
  },
  addReactionText: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '700',
    color: BrutalColors.inkMuted,
  },
  inputDock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BrutalColors.bgCard,
    borderTopWidth: 3,
    borderTopColor: BrutalColors.border,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    paddingVertical: 10,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderWidth: 2.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnText: {
    fontSize: 18,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderWidth: 2.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.accentYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    fontFamily: Fonts?.mono,
    fontSize: 20,
    fontWeight: '900',
    color: BrutalColors.ink,
  },
  voiceRecordDock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFF0F3',
    borderTopWidth: 3,
    borderTopColor: BrutalColors.accentPink,
    gap: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BrutalColors.accentPink,
  },
  recordingTimerText: {
    flex: 1,
    fontFamily: Fonts?.mono,
    fontSize: 12,
    fontWeight: '800',
    color: BrutalColors.accentPink,
  },
  voiceCancelBtn: {
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  voiceCancelBtnText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '800',
    color: BrutalColors.ink,
  },
  voiceFinishBtn: {
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.accentGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  voiceFinishBtnText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '800',
    color: BrutalColors.ink,
  },
});
