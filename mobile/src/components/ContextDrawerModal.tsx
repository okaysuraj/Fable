import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';
import { Channel, User, CallParticipant } from '@/types';
import { MonogramAvatar } from './brutal/MonogramAvatar';
import { BrutalCard } from './brutal/BrutalCard';

interface ContextDrawerModalProps {
  visible: boolean;
  onClose: () => void;
  channel: Channel;
  teamMembers: User[];
  callParticipants: CallParticipant[];
}

export const ContextDrawerModal: React.FC<ContextDrawerModalProps> = ({
  visible,
  onClose,
  channel,
  teamMembers,
  callParticipants,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>CHANNEL INTEL</Text>
              <Text style={styles.channelName}>#{channel.name}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Topic Card */}
            <BrutalCard style={styles.sectionCard}>
              <Text style={styles.sectionHeading}>TOPIC & OBJECTIVE</Text>
              <Text style={styles.topicText}>{channel.topic}</Text>
            </BrutalCard>

            {/* Active Huddle if any */}
            {channel.activeCall && (
              <BrutalCard alt style={styles.sectionCard}>
                <View style={styles.huddleHeader}>
                  <View style={styles.liveDot} />
                  <Text style={styles.huddleTitle}>ACTIVE CALL IN PROGRESS</Text>
                </View>
                <Text style={styles.huddleSub}>
                  {channel.activeCall.participantCount} members dropped in • Started {channel.activeCall.startedAt}
                </Text>
              </BrutalCard>
            )}

            {/* Members Section */}
            <View style={styles.membersSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>CHANNEL MEMBERS</Text>
                <Text style={styles.countText}>{teamMembers.length}</Text>
              </View>

              <View style={styles.membersList}>
                {teamMembers.map((m) => (
                  <View key={m.id} style={styles.memberRow}>
                    <MonogramAvatar
                      monogram={m.monogram}
                      backgroundColor={m.avatarColor || BrutalColors.accentYellow}
                      size={36}
                      status={m.status}
                    />
                    <View style={styles.memberTextCol}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={styles.memberRole}>{m.statusText || m.role}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor:
                            m.status === 'online'
                              ? '#D1FAE5'
                              : m.status === 'in-huddle'
                              ? '#FFE0E9'
                              : BrutalColors.bgCardAlt,
                        },
                      ]}
                    >
                      <Text style={styles.statusBadgeText}>
                        {m.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '85%',
    backgroundColor: BrutalColors.bgPaper,
    borderTopWidth: 4,
    borderTopColor: BrutalColors.border,
    borderLeftWidth: 3,
    borderRightWidth: 3,
    borderColor: BrutalColors.border,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 3,
    borderBottomColor: BrutalColors.border,
    backgroundColor: BrutalColors.bgCard,
  },
  headerTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 16,
    color: BrutalColors.ink,
    letterSpacing: 0.5,
  },
  channelName: {
    fontFamily: Fonts?.mono,
    fontSize: 12,
    fontWeight: '700',
    color: BrutalColors.inkMuted,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    backgroundColor: BrutalColors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: BrutalColors.ink,
  },
  scrollBody: {
    padding: 16,
    gap: 16,
  },
  sectionCard: {
    padding: 14,
    gap: 6,
  },
  sectionHeading: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.6,
    color: BrutalColors.inkSecondary,
  },
  topicText: {
    fontFamily: Fonts?.sans,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: BrutalColors.ink,
  },
  huddleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BrutalColors.accentPink,
  },
  huddleTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 12,
    color: BrutalColors.accentPink,
  },
  huddleSub: {
    fontFamily: Fonts?.sans,
    fontSize: 12,
    fontWeight: '600',
    color: BrutalColors.inkSecondary,
  },
  membersSection: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '800',
    color: BrutalColors.inkMuted,
  },
  membersList: {
    gap: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: BrutalColors.bgCard,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    padding: 10,
  },
  memberTextCol: {
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
  statusBadge: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.ink,
  },
});
