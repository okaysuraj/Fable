import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Platform,
} from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';
import { Channel, CallParticipant, User } from '@/types';
import { MonogramAvatar } from '../brutal/MonogramAvatar';
import { BrutalCard } from '../brutal/BrutalCard';

interface MobileAudioHuddleProps {
  channel: Channel;
  participants: CallParticipant[];
  currentUser: User;
  isMuted: boolean;
  onToggleMute: () => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
  onLeaveCall: () => void;
  onUpgradeToVideo: () => void;
  onMinimizeToPiP: () => void;
}

export const MobileAudioHuddle: React.FC<MobileAudioHuddleProps> = ({
  channel,
  participants,
  currentUser,
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  onLeaveCall,
  onUpgradeToVideo,
  onMinimizeToPiP,
}) => {
  const [duration, setDuration] = useState(0);
  const [wavePhase, setWavePhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const waveTimer = setInterval(() => {
      setWavePhase((p) => (p + 1) % 100);
    }, 150);
    return () => clearInterval(waveTimer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const bars = [18, 35, 60, 40, 85, 95, 70, 50, 30, 65, 80, 45, 90, 60, 35, 75, 55, 40];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ═══ HUDDLE HEADER ═══ */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.huddleBadge}>
            <Text style={styles.huddleBadgeText}>◉</Text>
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.huddleTitle}>VOICE HUDDLE</Text>
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.channelName}>#{channel.name}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.timerBadge}>
            <Text style={styles.timerText}>{formatTime(duration)}</Text>
          </View>
          <Pressable onPress={onMinimizeToPiP} style={styles.minimizeBtn}>
            <Text style={styles.minimizeBtnText}>▼</Text>
          </Pressable>
        </View>
      </View>

      {/* ═══ ACOUSTIC VISUALIZER ═══ */}
      <View style={styles.visualizerContainer}>
        <Text style={styles.visualizerLabel}>SPATIAL AUDIO SPECTRUM</Text>
        <View style={styles.spectrumRow}>
          {bars.map((bar, i) => {
            const heightMultiplier = Math.sin((wavePhase * 0.1) + i * 0.4);
            const dynamicHeight = Math.max(8, Math.floor(bar * 0.45 * (0.6 + 0.4 * Math.abs(heightMultiplier))));
            const isActive = i % 2 === 0;

            return (
              <View
                key={i}
                style={[
                  styles.spectrumBar,
                  {
                    height: dynamicHeight,
                    backgroundColor: isActive
                      ? BrutalColors.accentGreen
                      : BrutalColors.ink,
                  },
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* ═══ PARTICIPANTS GRID ═══ */}
      <ScrollView contentContainerStyle={styles.participantsScroll}>
        <View style={styles.grid}>
          {participants.map((p) => {
            const isSpeaking = p.isSpeaking;

            return (
              <BrutalCard
                key={p.id}
                style={[
                  styles.participantCard,
                  isSpeaking && styles.participantCardSpeaking,
                ]}
              >
                <View style={styles.avatarHolder}>
                  <MonogramAvatar
                    monogram={p.user.monogram}
                    backgroundColor={p.user.avatarColor || BrutalColors.accentYellow}
                    size={48}
                  />
                  {isSpeaking && <View style={styles.speakingAura} />}
                </View>

                <Text style={styles.participantName} numberOfLines={1}>
                  {p.user.name}
                </Text>
                <Text style={styles.participantRole} numberOfLines={1}>
                  {p.user.role}
                </Text>

                <View style={styles.statusRow}>
                  {isSpeaking ? (
                    <View style={styles.speakingBadge}>
                      <Text style={styles.speakingText}>SPEAKING</Text>
                    </View>
                  ) : p.isMuted ? (
                    <View style={styles.mutedBadge}>
                      <Text style={styles.mutedText}>MUTED</Text>
                    </View>
                  ) : (
                    <View style={styles.listeningBadge}>
                      <Text style={styles.listeningText}>LISTENING</Text>
                    </View>
                  )}
                </View>
              </BrutalCard>
            );
          })}
        </View>
      </ScrollView>

      {/* ═══ BOTTOM CONTROL DOCK ═══ */}
      <View style={styles.controlsDock}>
        <Pressable
          onPress={onToggleMute}
          style={[
            styles.controlCircle,
            isMuted && styles.controlCircleAlert,
          ]}
        >
          <Text style={styles.controlCircleIcon}>
            {isMuted ? '🔇' : '🎙️'}
          </Text>
          <Text style={styles.controlCircleLabel}>
            {isMuted ? 'UNMUTE' : 'MUTE'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onToggleDeafen}
          style={[
            styles.controlCircle,
            isDeafened && styles.controlCircleAlert,
          ]}
        >
          <Text style={styles.controlCircleIcon}>
            {isDeafened ? '🚫' : '🎧'}
          </Text>
          <Text style={styles.controlCircleLabel}>
            {isDeafened ? 'UNDEAF' : 'DEAFEN'}
          </Text>
        </Pressable>

        <Pressable onPress={onUpgradeToVideo} style={styles.controlCircle}>
          <Text style={styles.controlCircleIcon}>📹</Text>
          <Text style={styles.controlCircleLabel}>VIDEO</Text>
        </Pressable>

        <Pressable
          onPress={onLeaveCall}
          style={[styles.controlCircle, styles.leaveCircle]}
        >
          <Text style={styles.leaveCircleIcon}>✕</Text>
          <Text style={styles.leaveCircleLabel}>LEAVE</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BrutalColors.bgPaper,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BrutalColors.bgCard,
    borderBottomWidth: 3,
    borderBottomColor: BrutalColors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  huddleBadge: {
    width: 36,
    height: 36,
    borderWidth: 2.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.accentPink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  huddleBadgeText: {
    fontFamily: Fonts?.mono,
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  huddleTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.4,
    color: BrutalColors.ink,
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: BrutalColors.accentGreen,
  },
  liveText: {
    fontFamily: Fonts?.mono,
    fontSize: 8,
    fontWeight: '900',
    color: BrutalColors.ink,
  },
  channelName: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '700',
    color: BrutalColors.inkMuted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerBadge: {
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.bgCardAlt,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  timerText: {
    fontFamily: Fonts?.mono,
    fontSize: 12,
    fontWeight: '800',
    color: BrutalColors.ink,
  },
  minimizeBtn: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizeBtnText: {
    fontSize: 12,
    fontWeight: '900',
  },
  visualizerContainer: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: BrutalColors.bgCardAlt,
    borderBottomWidth: 3,
    borderBottomColor: BrutalColors.border,
    alignItems: 'center',
    gap: 8,
  },
  visualizerLabel: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: BrutalColors.inkMuted,
  },
  spectrumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 44,
  },
  spectrumBar: {
    width: 5,
    borderRadius: 2.5,
  },
  participantsScroll: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  participantCard: {
    width: '47%',
    alignItems: 'center',
    padding: 14,
    gap: 6,
  },
  participantCardSpeaking: {
    borderColor: BrutalColors.accentGreen,
    borderWidth: 3.5,
  },
  avatarHolder: {
    position: 'relative',
    marginBottom: 4,
  },
  speakingAura: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderWidth: 2.5,
    borderColor: BrutalColors.accentGreen,
    borderRadius: 8,
  },
  participantName: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 13,
    color: BrutalColors.ink,
    textAlign: 'center',
  },
  participantRole: {
    fontFamily: Fonts?.sans,
    fontSize: 10,
    fontWeight: '600',
    color: BrutalColors.inkMuted,
    textAlign: 'center',
  },
  statusRow: {
    marginTop: 4,
  },
  speakingBadge: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  speakingText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '900',
    color: BrutalColors.accentGreen,
  },
  mutedBadge: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: '#FFE0E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  mutedText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.accentPink,
  },
  listeningBadge: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: BrutalColors.bgCardAlt,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  listeningText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '700',
    color: BrutalColors.inkSecondary,
  },
  controlsDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: BrutalColors.bgCard,
    borderTopWidth: 3,
    borderTopColor: BrutalColors.border,
  },
  controlCircle: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 6,
    backgroundColor: BrutalColors.bgCardAlt,
  },
  controlCircleAlert: {
    backgroundColor: '#FFE0E9',
    borderColor: BrutalColors.accentPink,
  },
  controlCircleIcon: {
    fontSize: 18,
  },
  controlCircleLabel: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.ink,
  },
  leaveCircle: {
    backgroundColor: '#FFE0E9',
    borderColor: BrutalColors.accentPink,
  },
  leaveCircleIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: BrutalColors.accentPink,
  },
  leaveCircleLabel: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '900',
    color: BrutalColors.accentPink,
  },
});
