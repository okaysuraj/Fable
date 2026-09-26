import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';
import { Channel, CallParticipant, User } from '@/types';
import { MonogramAvatar } from '../brutal/MonogramAvatar';

interface MobileVideoSalonProps {
  channel: Channel;
  participants: CallParticipant[];
  currentUser: User;
  isMuted: boolean;
  onToggleMute: () => void;
  isVideoOn: boolean;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
  onMinimizeToPiP: () => void;
}

export const MobileVideoSalon: React.FC<MobileVideoSalonProps> = ({
  channel,
  participants,
  currentUser,
  isMuted,
  onToggleMute,
  isVideoOn,
  onToggleVideo,
  onLeaveCall,
  onMinimizeToPiP,
}) => {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ═══ HEADER ═══ */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>▶</Text>
          </View>
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.headerTitle}>VIDEO SALON</Text>
              <View style={styles.liveTag}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>1080p</Text>
              </View>
            </View>
            <Text style={styles.headerSubtitle}>#{channel.name}</Text>
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

      {/* ═══ VIDEO TILES GRID ═══ */}
      <ScrollView contentContainerStyle={styles.videoGrid}>
        {participants.map((p) => {
          const isMe = p.user.id === currentUser.id;
          const showVideo = isMe ? isVideoOn : p.isVideoOn;
          const isSpeaking = p.isSpeaking;

          return (
            <View
              key={p.id}
              style={[
                styles.videoTile,
                isSpeaking && styles.videoTileSpeaking,
              ]}
            >
              {showVideo ? (
                <View style={styles.videoSim}>
                  <View style={styles.videoSimOverlay} />
                  <MonogramAvatar
                    monogram={p.user.monogram}
                    size={64}
                    backgroundColor={p.user.avatarColor || BrutalColors.accentYellow}
                  />
                  <Text style={styles.videoFeedText}>CAMERA ACTIVE</Text>
                </View>
              ) : (
                <View style={styles.videoOffPlaceholder}>
                  <MonogramAvatar
                    monogram={p.user.monogram}
                    size={56}
                    backgroundColor={p.user.avatarColor || BrutalColors.accentYellow}
                  />
                  <Text style={styles.videoOffText}>VIDEO OFF</Text>
                </View>
              )}

              {/* Tile Name Tag */}
              <View style={styles.tileNameTag}>
                <Text style={styles.tileNameText} numberOfLines={1}>
                  {p.user.name} {isMe ? '(You)' : ''}
                </Text>
                {isSpeaking ? (
                  <View style={styles.tileLiveDot} />
                ) : (p.isMuted || (isMe && isMuted)) ? (
                  <Text style={styles.tileMutedIcon}>🔇</Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* ═══ FLOATING CONTROLS DOCK ═══ */}
      <View style={styles.controlsDock}>
        <Pressable
          onPress={onToggleVideo}
          style={[
            styles.controlBtn,
            !isVideoOn && styles.controlBtnAlert,
          ]}
        >
          <Text style={styles.controlBtnIcon}>{isVideoOn ? '📹' : '🚫'}</Text>
          <Text style={styles.controlBtnText}>
            {isVideoOn ? 'CAM ON' : 'CAM OFF'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onToggleMute}
          style={[
            styles.controlBtn,
            isMuted && styles.controlBtnAlert,
          ]}
        >
          <Text style={styles.controlBtnIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
          <Text style={styles.controlBtnText}>
            {isMuted ? 'UNMUTE' : 'MUTE'}
          </Text>
        </Pressable>

        <Pressable onPress={onLeaveCall} style={[styles.controlBtn, styles.leaveBtn]}>
          <Text style={styles.leaveBtnIcon}>✕</Text>
          <Text style={styles.leaveBtnText}>LEAVE</Text>
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
  badge: {
    width: 36,
    height: 36,
    borderWidth: 2.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
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
  headerTitle: {
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
    backgroundColor: '#E0EAFF',
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: BrutalColors.accentBlue,
  },
  liveText: {
    fontFamily: Fonts?.mono,
    fontSize: 8,
    fontWeight: '900',
    color: BrutalColors.accentBlue,
  },
  headerSubtitle: {
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
  videoGrid: {
    padding: 16,
    gap: 14,
  },
  videoTile: {
    height: 220,
    backgroundColor: BrutalColors.ink,
    borderWidth: 3,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoTileSpeaking: {
    borderColor: BrutalColors.accentGreen,
    borderWidth: 4,
  },
  videoSim: {
    width: '100%',
    height: '100%',
    backgroundColor: '#23272F',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  videoSimOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  videoFeedText: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '800',
    color: BrutalColors.accentGreen,
    letterSpacing: 0.8,
  },
  videoOffPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1E232A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoOffText: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
  },
  tileNameTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tileNameText: {
    fontFamily: Fonts?.sans,
    fontWeight: '800',
    fontSize: 11,
    color: '#FFFFFF',
  },
  tileLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrutalColors.accentGreen,
  },
  tileMutedIcon: {
    fontSize: 10,
  },
  controlsDock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: BrutalColors.bgCard,
    borderTopWidth: 3,
    borderTopColor: BrutalColors.border,
  },
  controlBtn: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 6,
    backgroundColor: BrutalColors.bgCardAlt,
  },
  controlBtnAlert: {
    backgroundColor: '#FFE0E9',
    borderColor: BrutalColors.accentPink,
  },
  controlBtnIcon: {
    fontSize: 18,
  },
  controlBtnText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.ink,
  },
  leaveBtn: {
    backgroundColor: '#FFE0E9',
    borderColor: BrutalColors.accentPink,
  },
  leaveBtnIcon: {
    fontSize: 18,
    fontWeight: '900',
    color: BrutalColors.accentPink,
  },
  leaveBtnText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '900',
    color: BrutalColors.accentPink,
  },
});
