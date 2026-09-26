import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';
import { Channel, User, CallMode } from '@/types';
import { MonogramAvatar } from './brutal/MonogramAvatar';

interface SidebarDrawerProps {
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
  onOpenSearch: () => void;
  activeCallMode: CallMode;
  onJoinHuddle: (channel: Channel, mode: 'audio' | 'video') => void;
  onLogout: () => void;
  onClose: () => void;
}

export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
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
  onOpenSearch,
  activeCallMode,
  onJoinHuddle,
  onLogout,
  onClose,
}) => {
  const textChannels = channels.filter((c) => c.type === 'text');
  const voiceChannels = channels.filter((c) => c.type === 'audio');
  const videoChannels = channels.filter((c) => c.type === 'video');

  return (
    <SafeAreaView style={styles.container}>
      {/* ═══ WORKSPACE BRANDING ═══ */}
      <View style={styles.brandingHeader}>
        <View style={styles.brandingLeft}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>F</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>FABLE</Text>
            <Text style={styles.brandSubtitle}>STUDIO v2.4</Text>
          </View>
        </View>

        <View style={styles.brandingRight}>
          <Pressable onPress={onOpenSearch} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>🔍</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>✕</Text>
          </Pressable>
        </View>
      </View>

      {/* ═══ SCROLLABLE CHANNEL TREE ═══ */}
      <ScrollView contentContainerStyle={styles.scrollList} showsVerticalScrollIndicator={false}>
        {/* Quick Search Jump Trigger */}
        <Pressable onPress={onOpenSearch} style={styles.searchBar}>
          <Text style={styles.searchBarText}>QUICK JUMP (SEARCH)</Text>
          <View style={styles.searchBadge}>
            <Text style={styles.searchBadgeText}>⌘K</Text>
          </View>
        </Pressable>

        {/* ─── TEXT ROOMS ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>TEXT ROOMS</Text>
            <Text style={styles.sectionCount}>{textChannels.length}</Text>
          </View>
          <View style={styles.channelList}>
            {textChannels.map((ch) => {
              const isActive = ch.id === activeChannelId;
              return (
                <Pressable
                  key={ch.id}
                  onPress={() => {
                    onSelectChannel(ch.id);
                    onClose();
                  }}
                  style={[
                    styles.channelItem,
                    isActive && styles.channelItemActive,
                  ]}
                >
                  <View
                    style={[
                      styles.channelIconBox,
                      {
                        backgroundColor: isActive
                          ? BrutalColors.accentYellow
                          : BrutalColors.bgCard,
                      },
                    ]}
                  >
                    <Text style={styles.channelIconText}>#</Text>
                  </View>
                  <Text
                    style={[
                      styles.channelName,
                      isActive && styles.channelNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {ch.name}
                  </Text>

                  {/* Active Call Badge if running in this channel */}
                  {ch.activeCall && (
                    <Pressable
                      onPress={() => onJoinHuddle(ch, ch.activeCall?.mode || 'audio')}
                      style={styles.activeCallBadge}
                    >
                      <View style={styles.liveDot} />
                      <Text style={styles.activeCallText}>
                        {ch.activeCall.participantCount} IN HUDDLE
                      </Text>
                    </Pressable>
                  )}

                  {/* Unread Count */}
                  {!ch.activeCall && ch.unreadCount && ch.unreadCount > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{ch.unreadCount}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── VOICE HUDDLES ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>VOICE HUDDLES</Text>
            <Text style={styles.sectionCount}>{voiceChannels.length}</Text>
          </View>
          <View style={styles.channelList}>
            {voiceChannels.map((ch) => {
              const isActive = ch.id === activeChannelId;
              return (
                <Pressable
                  key={ch.id}
                  onPress={() => {
                    onSelectChannel(ch.id);
                    onJoinHuddle(ch, 'audio');
                    onClose();
                  }}
                  style={[
                    styles.channelItem,
                    isActive && styles.channelItemActive,
                  ]}
                >
                  <View
                    style={[
                      styles.channelIconBox,
                      { backgroundColor: BrutalColors.accentPink },
                    ]}
                  >
                    <Text style={[styles.channelIconText, { color: '#FFFFFF' }]}>◉</Text>
                  </View>
                  <Text
                    style={[
                      styles.channelName,
                      isActive && styles.channelNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {ch.name}
                  </Text>
                  <View style={[styles.statusTag, { backgroundColor: BrutalColors.bgCardAlt }]}>
                    <Text style={styles.statusTagText}>DROP IN</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── VIDEO SALONS ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>VIDEO SALONS</Text>
            <Text style={styles.sectionCount}>{videoChannels.length}</Text>
          </View>
          <View style={styles.channelList}>
            {videoChannels.map((ch) => {
              const isActive = ch.id === activeChannelId;
              return (
                <Pressable
                  key={ch.id}
                  onPress={() => {
                    onSelectChannel(ch.id);
                    onJoinHuddle(ch, 'video');
                    onClose();
                  }}
                  style={[
                    styles.channelItem,
                    isActive && styles.channelItemActive,
                  ]}
                >
                  <View
                    style={[
                      styles.channelIconBox,
                      { backgroundColor: BrutalColors.accentBlue },
                    ]}
                  >
                    <Text style={[styles.channelIconText, { color: '#FFFFFF' }]}>▶</Text>
                  </View>
                  <Text
                    style={[
                      styles.channelName,
                      isActive && styles.channelNameActive,
                    ]}
                    numberOfLines={1}
                  >
                    {ch.name}
                  </Text>
                  <View style={[styles.statusTag, { backgroundColor: '#E0EAFF' }]}>
                    <Text style={[styles.statusTagText, { color: BrutalColors.accentBlue }]}>STAGE</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ─── DIRECT MESSAGES / TEAM MEMBERS ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>STUDIO TEAM</Text>
            <Text style={styles.sectionCount}>{teamMembers.length}</Text>
          </View>
          <View style={styles.channelList}>
            {teamMembers.map((member) => (
              <View key={member.id} style={styles.memberItem}>
                <MonogramAvatar
                  monogram={member.monogram}
                  status={member.status}
                  size={32}
                  backgroundColor={member.avatarColor || BrutalColors.accentYellow}
                />
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.name}
                  </Text>
                  <Text style={styles.memberRole} numberOfLines={1}>
                    {member.statusText || member.role}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* ═══ BOTTOM USER FOOTER ═══ */}
      <View style={styles.userFooter}>
        <View style={styles.userMeta}>
          <MonogramAvatar
            monogram={currentUser.monogram || 'SJ'}
            size={36}
            backgroundColor={BrutalColors.accentYellow}
            status={currentUser.status || 'online'}
          />
          <View style={styles.userTextCol}>
            <Text style={styles.userName} numberOfLines={1}>
              {currentUser.name}
            </Text>
            <Text style={styles.userHandle} numberOfLines={1}>
              {currentUser.handle}
            </Text>
          </View>
        </View>

        {/* Audio / Preference Controls */}
        <View style={styles.footerActions}>
          <Pressable
            onPress={onToggleMute}
            style={[
              styles.controlBtn,
              isMuted && styles.controlBtnAlert,
            ]}
          >
            <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎙️'}</Text>
          </Pressable>

          <Pressable
            onPress={onToggleDeafen}
            style={[
              styles.controlBtn,
              isDeafened && styles.controlBtnAlert,
            ]}
          >
            <Text style={styles.controlIcon}>{isDeafened ? '🚫' : '🎧'}</Text>
          </Pressable>

          <Pressable onPress={onOpenSettings} style={styles.controlBtn}>
            <Text style={styles.controlIcon}>⚙️</Text>
          </Pressable>

          <Pressable onPress={onLogout} style={[styles.controlBtn, { backgroundColor: '#FFE0E9' }]}>
            <Text style={styles.controlIcon}>🚪</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrutalColors.bgSidebar,
    borderRightWidth: 3,
    borderRightColor: BrutalColors.border,
  },
  brandingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: BrutalColors.border,
    backgroundColor: BrutalColors.bgCard,
  },
  brandingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandBadge: {
    width: 36,
    height: 36,
    backgroundColor: BrutalColors.accentYellow,
    borderWidth: 2.5,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 20,
    color: BrutalColors.ink,
  },
  brandTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 18,
    color: BrutalColors.ink,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.inkMuted,
    letterSpacing: 1,
  },
  brandingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  scrollList: {
    padding: 16,
    gap: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.bgCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchBarText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '700',
    color: BrutalColors.inkMuted,
  },
  searchBadge: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: BrutalColors.bgCardAlt,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  searchBadgeText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.inkSecondary,
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
    color: BrutalColors.inkSecondary,
  },
  sectionCount: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '800',
    color: BrutalColors.inkMuted,
  },
  channelList: {
    gap: 4,
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  channelItemActive: {
    backgroundColor: BrutalColors.bgCard,
    borderWidth: 2,
    borderColor: BrutalColors.border,
  },
  channelIconBox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelIconText: {
    fontFamily: Fonts?.mono,
    fontWeight: '900',
    fontSize: 12,
    color: BrutalColors.ink,
  },
  channelName: {
    flex: 1,
    fontFamily: Fonts?.sans,
    fontWeight: '700',
    fontSize: 14,
    color: BrutalColors.inkSecondary,
  },
  channelNameActive: {
    color: BrutalColors.ink,
    fontWeight: '900',
  },
  activeCallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BrutalColors.accentGreen,
  },
  activeCallText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.ink,
  },
  unreadBadge: {
    backgroundColor: BrutalColors.accentYellow,
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  unreadText: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '800',
    color: BrutalColors.ink,
  },
  statusTag: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusTagText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.inkSecondary,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontFamily: Fonts?.sans,
    fontWeight: '800',
    fontSize: 13,
    color: BrutalColors.ink,
  },
  memberRole: {
    fontFamily: Fonts?.sans,
    fontSize: 11,
    fontWeight: '500',
    color: BrutalColors.inkMuted,
  },
  userFooter: {
    borderTopWidth: 3,
    borderTopColor: BrutalColors.border,
    backgroundColor: BrutalColors.bgCard,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  userTextCol: {
    flex: 1,
  },
  userName: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 13,
    color: BrutalColors.ink,
  },
  userHandle: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '700',
    color: BrutalColors.inkMuted,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  controlBtn: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnAlert: {
    backgroundColor: '#FFE0E9',
    borderColor: BrutalColors.accentPink,
  },
  controlIcon: {
    fontSize: 13,
  },
});
