import React, { useState } from 'react';
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
import { Channel, User } from '@/types';
import { BrutalInput } from './brutal/BrutalInput';
import { MonogramAvatar } from './brutal/MonogramAvatar';

interface CommandPaletteModalProps {
  visible: boolean;
  onClose: () => void;
  channels: Channel[];
  teamMembers: User[];
  onSelectChannel: (channelId: string) => void;
  onStartCall: (mode: 'audio' | 'video') => void;
  onOpenSettings: () => void;
  onToggleMute: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  visible,
  onClose,
  channels,
  teamMembers,
  onSelectChannel,
  onStartCall,
  onOpenSettings,
  onToggleMute,
}) => {
  const [query, setQuery] = useState('');

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const filteredMembers = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.handle.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.modal}>
          {/* Search Header */}
          <View style={styles.header}>
            <BrutalInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search channels, team, commands..."
              autoFocus
              style={styles.searchInput}
            />
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.resultsList} keyboardShouldPersistTaps="handled">
            {/* Quick Actions */}
            {!query && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>COMMANDS & ACTIONS</Text>
                <Pressable
                  onPress={() => {
                    onClose();
                    onStartCall('audio');
                  }}
                  style={styles.resultItem}
                >
                  <Text style={styles.itemIcon}>🎙️</Text>
                  <Text style={styles.itemTitle}>Start / Join Audio Huddle</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    onClose();
                    onStartCall('video');
                  }}
                  style={styles.resultItem}
                >
                  <Text style={styles.itemIcon}>📹</Text>
                  <Text style={styles.itemTitle}>Start Video Salon Broadcast</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    onClose();
                    onToggleMute();
                  }}
                  style={styles.resultItem}
                >
                  <Text style={styles.itemIcon}>🔇</Text>
                  <Text style={styles.itemTitle}>Toggle Microphone Mute</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  style={styles.resultItem}
                >
                  <Text style={styles.itemIcon}>⚙️</Text>
                  <Text style={styles.itemTitle}>Open Studio Preferences</Text>
                </Pressable>
              </View>
            )}

            {/* Channels */}
            {filteredChannels.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>ROOMS & CHANNELS</Text>
                {filteredChannels.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      onSelectChannel(c.id);
                      onClose();
                    }}
                    style={styles.resultItem}
                  >
                    <View style={styles.channelIconBadge}>
                      <Text style={styles.channelIconText}>
                        {c.type === 'video' ? '▶' : c.type === 'audio' ? '◉' : '#'}
                      </Text>
                    </View>
                    <View style={styles.itemTextCol}>
                      <Text style={styles.itemTitle}>{c.name}</Text>
                      <Text style={styles.itemSubtitle} numberOfLines={1}>
                        {c.topic}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Team Members */}
            {filteredMembers.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>STUDIO TEAM</Text>
                {filteredMembers.map((m) => (
                  <View key={m.id} style={styles.resultItem}>
                    <MonogramAvatar
                      monogram={m.monogram}
                      backgroundColor={m.avatarColor || BrutalColors.accentYellow}
                      size={28}
                      status={m.status}
                    />
                    <View style={styles.itemTextCol}>
                      <Text style={styles.itemTitle}>{m.name}</Text>
                      <Text style={styles.itemSubtitle}>{m.handle}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 26, 0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    maxHeight: '80%',
    backgroundColor: BrutalColors.bgPaper,
    borderWidth: 3.5,
    borderColor: BrutalColors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    backgroundColor: BrutalColors.bgCard,
    borderBottomWidth: 3,
    borderBottomColor: BrutalColors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
  },
  closeBtn: {
    width: 36,
    height: 36,
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
  resultsList: {
    padding: 16,
    gap: 16,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 11,
    letterSpacing: 0.8,
    color: BrutalColors.inkSecondary,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: BrutalColors.bgCard,
    borderWidth: 2,
    borderColor: BrutalColors.border,
    borderRadius: 4,
    padding: 10,
  },
  itemIcon: {
    fontSize: 16,
  },
  channelIconBadge: {
    width: 26,
    height: 26,
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: BrutalColors.accentYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelIconText: {
    fontFamily: Fonts?.mono,
    fontSize: 11,
    fontWeight: '900',
    color: BrutalColors.ink,
  },
  itemTextCol: {
    flex: 1,
  },
  itemTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '800',
    fontSize: 13,
    color: BrutalColors.ink,
  },
  itemSubtitle: {
    fontFamily: Fonts?.sans,
    fontSize: 11,
    color: BrutalColors.inkMuted,
  },
});
