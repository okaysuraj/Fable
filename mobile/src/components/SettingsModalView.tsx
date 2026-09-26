import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  Pressable,
  Switch,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { BrutalColors, Fonts } from '@/constants/theme';
import { WorkspaceSettings } from '@/types';
import { BrutalCard } from './brutal/BrutalCard';
import { BrutalButton } from './brutal/BrutalButton';

interface SettingsModalViewProps {
  visible: boolean;
  onClose: () => void;
  settings: WorkspaceSettings;
  onUpdateSettings: (newSettings: Partial<WorkspaceSettings>) => void;
}

export const SettingsModalView: React.FC<SettingsModalViewProps> = ({
  visible,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [noiseCancellation, setNoiseCancellation] = useState(settings.noiseCancellation);
  const [spatialAudio, setSpatialAudio] = useState(settings.spatialAudio);

  const handleSave = () => {
    onUpdateSettings({
      noiseCancellation,
      spatialAudio,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>STUDIO SETTINGS</Text>
              <Text style={styles.headerSubtitle}>AUDIO, VIDEO & PREFERENCES</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* Audio Processing */}
            <Text style={styles.sectionHeader}>AUDIO PROCESSING</Text>

            <BrutalCard style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>AI Noise Cancellation</Text>
                  <Text style={styles.settingDesc}>
                    Suppress keyboard clatter, air conditioners, and background studio noise
                  </Text>
                </View>
                <Switch
                  value={noiseCancellation}
                  onValueChange={setNoiseCancellation}
                  trackColor={{ false: BrutalColors.inkFaint, true: BrutalColors.accentGreen }}
                  thumbColor={BrutalColors.ink}
                />
              </View>
            </BrutalCard>

            <BrutalCard style={styles.settingCard}>
              <View style={styles.settingRow}>
                <View style={styles.settingTextCol}>
                  <Text style={styles.settingTitle}>Binaural Spatial Audio</Text>
                  <Text style={styles.settingDesc}>
                    Position huddle voices across the stereo field according to stage layout
                  </Text>
                </View>
                <Switch
                  value={spatialAudio}
                  onValueChange={setSpatialAudio}
                  trackColor={{ false: BrutalColors.inkFaint, true: BrutalColors.accentGreen }}
                  thumbColor={BrutalColors.ink}
                />
              </View>
            </BrutalCard>

            {/* Video Quality */}
            <Text style={styles.sectionHeader}>VIDEO & RENDERING</Text>
            <BrutalCard style={styles.settingCard}>
              <Text style={styles.settingTitle}>WebRTC Pipeline</Text>
              <Text style={styles.settingDesc}>
                1080p 60fps hardware accelerated canvas decoding
              </Text>
              <View style={styles.tagRow}>
                <View style={styles.pillActive}>
                  <Text style={styles.pillActiveText}>HARDWARE ACCEL</Text>
                </View>
                <View style={styles.pillInactive}>
                  <Text style={styles.pillInactiveText}>NEO-BRUTAL CSS</Text>
                </View>
              </View>
            </BrutalCard>

            {/* Save Button */}
            <BrutalButton
              title="APPLY & CLOSE →"
              onPress={handleSave}
              variant="yellow"
              size="lg"
              style={styles.saveBtn}
            />
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
  headerSubtitle: {
    fontFamily: Fonts?.mono,
    fontSize: 10,
    fontWeight: '800',
    color: BrutalColors.inkMuted,
    letterSpacing: 0.8,
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
    padding: 18,
    gap: 14,
  },
  sectionHeader: {
    fontFamily: Fonts?.sans,
    fontWeight: '900',
    fontSize: 12,
    color: BrutalColors.inkSecondary,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  settingCard: {
    padding: 14,
    gap: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  settingTextCol: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: Fonts?.sans,
    fontWeight: '800',
    fontSize: 14,
    color: BrutalColors.ink,
  },
  settingDesc: {
    fontFamily: Fonts?.sans,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: BrutalColors.inkMuted,
    marginTop: 2,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  pillActive: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillActiveText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '900',
    color: BrutalColors.accentGreen,
  },
  pillInactive: {
    borderWidth: 1.5,
    borderColor: BrutalColors.border,
    borderRadius: 3,
    backgroundColor: BrutalColors.bgCardAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillInactiveText: {
    fontFamily: Fonts?.mono,
    fontSize: 9,
    fontWeight: '800',
    color: BrutalColors.inkSecondary,
  },
  saveBtn: {
    marginTop: 10,
  },
});
