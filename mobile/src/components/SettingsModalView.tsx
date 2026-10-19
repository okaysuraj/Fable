/** Appearance changes are server-confirmed and shared with the web account. */
import { useBrutalStyles, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { useRef, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Fonts } from "@/constants/theme";
import type { ThemeMode, WorkspaceSettings } from "@/types/chat";
import { BrutalButton } from "./brutal/BrutalButton";

interface Props {
  visible: boolean;
  onClose: () => void;
  settings: WorkspaceSettings;
  onUpdateSettings: (values: Partial<WorkspaceSettings>) => Promise<void>;
}
export function SettingsModalView({
  visible,
  onClose,
  settings,
  onUpdateSettings,
}: Props) {
  const styles = useBrutalStyles(createStyles);
  const [theme, setTheme] = useState<ThemeMode>(settings.theme);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const reduceMotion = useReducedMotion();
  const save = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await onUpdateSettings({ theme });
      onClose();
    } catch (failure: unknown) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Preferences could not be saved.",
      );
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>PREFERENCES</Text>
          <BrutalButton
            title="Close"
            variant="outline"
            size="sm"
            disabled={saving}
            onPress={onClose}
          />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.heading}>APPEARANCE</Text>
          <Text style={styles.copy}>
            Your theme is saved to your account and applied on web and mobile.
          </Text>
          <View style={styles.row}>
            {(["light", "dark"] as const).map((mode) => (
              <BrutalButton
                key={mode}
                title={`${mode}${theme === mode ? " · selected" : ""}`}
                variant={theme === mode ? "yellow" : "outline"}
                disabled={saving}
                onPress={() => setTheme(mode)}
              />
            ))}
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={styles.copy}>
              {error}
            </Text>
          ) : null}
          <BrutalButton
            title={saving ? "Saving..." : "Save preferences"}
            disabled={saving}
            onPress={() => {
              void save();
            }}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: BrutalColors.bgPaper },
    header: {
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 3,
      borderColor: BrutalColors.border,
    },
    title: {
      fontFamily: Fonts.sans,
      fontWeight: "900",
      fontSize: 22,
      color: BrutalColors.ink,
    },
    body: { padding: 24, gap: 20 },
    heading: {
      fontFamily: Fonts.sans,
      fontWeight: "900",
      fontSize: 16,
      color: BrutalColors.ink,
    },
    copy: {
      fontFamily: Fonts.sans,
      fontSize: 15,
      lineHeight: 22,
      color: BrutalColors.inkSecondary,
    },
    row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  });
