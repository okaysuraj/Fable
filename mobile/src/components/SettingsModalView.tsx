import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Fonts } from "@/constants/theme";
import {
  useBrutalStyles,
  useBrutalTheme,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import type { WorkspaceSettings } from "@/types/chat";
import { api } from "@/services/api";
import { devAuthEnabled } from "@/services/developmentAuth";
import { AppIcon } from "./ui/AppIcon";
import { MotionPressable } from "./ui/MotionPressable";
import { BrutalButton } from "./brutal/BrutalButton";

export function SettingsModalView({
  visible,
  onClose,
  settings,
  onUpdateSettings,
  onLogout,
  onManageGroups,
}: {
  visible: boolean;
  onClose: () => void;
  settings: WorkspaceSettings;
  onUpdateSettings: (values: Partial<WorkspaceSettings>) => Promise<void>;
  onLogout: () => void;
  onManageGroups: () => void;
}) {
  const colors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const reducedMotion = useReducedMotion();
  const changeTheme = async (dark: boolean) => {
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      await onUpdateSettings({ theme: dark ? "dark" : "light" });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your theme couldn't be saved.",
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  return (
    <Modal
      visible={visible}
      presentationStyle="fullScreen"
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <MotionPressable
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            disabled={saving}
            onPress={onClose}
            style={styles.iconButton}
          >
            <AppIcon name="back" />
          </MotionPressable>
          <Text accessibilityRole="header" style={styles.title}>
            Settings
          </Text>
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.sectionTitle}>APPEARANCE</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.symbol}>
                <AppIcon
                  name={settings.theme === "dark" ? "moon" : "sun"}
                  size={24}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.label}>Dark theme</Text>
                <Text style={styles.detail}>
                  {settings.theme === "dark" ? "Dark" : "Light"} appearance
                </Text>
              </View>
              {saving ? <ActivityIndicator color={colors.primary} /> : null}
              <Switch
                accessibilityLabel="Dark theme"
                accessibilityHint="Turn off for light theme"
                value={settings.theme === "dark"}
                disabled={saving}
                onValueChange={(value) => void changeTheme(value)}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
          <Text style={styles.hint}>
            Your appearance is saved to your account.
          </Text>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Text style={styles.sectionTitle}>GROUP ACCESS</Text>
          <MotionPressable
            accessibilityRole="button"
            disabled={saving}
            onPress={onManageGroups}
            style={[styles.card, styles.row]}
          >
            <View style={styles.symbol}>
              <AppIcon name="groups" size={24} />
            </View>
            <Text style={[styles.label, styles.rowBody]}>
              Manage group access
            </Text>
            <AppIcon name="forward" size={18} color={colors.inkFaint} />
          </MotionPressable>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <BrutalButton
            title="Sign out"
            variant="pink"
            size="lg"
            disabled={saving}
            onPress={onLogout}
            icon={<AppIcon name="logout" size={21} color="#FFFFFF" />}
          />
          {!devAuthEnabled && (
            <BrutalButton
              title="Sign out all devices"
              variant="outline"
              disabled={saving}
              onPress={() =>
                Alert.alert(
                  "Sign out all devices?",
                  "You’ll need to sign in again on every device.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Sign out",
                      style: "destructive",
                      onPress: () => {
                        if (pending.current) return;
                        pending.current = true;
                        setSaving(true);
                        setError("");
                        void api
                          .logoutAllDevices()
                          .then(onLogout)
                          .catch((failure: unknown) =>
                            setError(
                              failure instanceof Error
                                ? failure.message
                                : "Couldn't sign out all devices.",
                            ),
                          )
                          .finally(() => {
                            pending.current = false;
                            setSaving(false);
                          });
                      },
                    },
                  ],
                )
              }
            />
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const createStyles = (colors: BrutalPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bgSidebar },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      backgroundColor: colors.bgPaper,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    iconButton: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontFamily: Fonts.medium, color: colors.ink, fontSize: 20 },
    body: {
      padding: 22,
      gap: 12,
      maxWidth: 600,
      width: "100%",
      alignSelf: "center",
    },
    sectionTitle: {
      color: colors.inkMuted,
      fontFamily: Fonts.medium,
      fontSize: 12,
      letterSpacing: 0.7,
      marginTop: 20,
      paddingHorizontal: 6,
    },
    card: { borderRadius: 18, backgroundColor: colors.bgCard, padding: 16 },
    row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 68 },
    rowBody: { flex: 1 },
    symbol: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: colors.selection,
      justifyContent: "center",
      alignItems: "center",
    },
    label: { fontFamily: Fonts.medium, fontSize: 16, color: colors.ink },
    detail: {
      fontFamily: Fonts.sans,
      fontSize: 13,
      color: colors.inkMuted,
      marginTop: 4,
    },
    hint: {
      fontFamily: Fonts.sans,
      fontSize: 13,
      lineHeight: 20,
      color: colors.inkMuted,
      paddingHorizontal: 6,
    },
    error: { color: colors.dangerButton, fontSize: 14, lineHeight: 21 },
  });
