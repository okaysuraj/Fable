/** Persist profile edits and require deliberate confirmation before account-wide logout. */
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Fonts } from "@/constants/theme";
import { User } from "@/types/chat";
import { BrutalButton } from "./brutal/BrutalButton";
import { BrutalInput } from "./brutal/BrutalInput";
import { MonogramAvatar } from "./brutal/MonogramAvatar";
import { api } from "@/services/api";

interface Props {
  user: User;
  onClose: () => void;
  onSave: (values: { name: string; statusText: string }) => Promise<void>;
  onLogout: () => void;
}
export function ProfileModal({ user, onClose, onSave, onLogout }: Props) {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const [name, setName] = useState(user.name);
  const [statusText, setStatusText] = useState(user.statusText || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmLogout, setConfirmLogout] = useState(false);
  const inFlight = useRef(false);
  const reduceMotion = useReducedMotion();
  const logoutAll = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await api.logoutAllDevices();
      onLogout();
    } catch (failure: unknown) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to sign out all devices.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const save = async () => {
    if (inFlight.current) return;
    if (!name.trim() || name.trim().length > 80) {
      setError("Display name must contain between 1 and 80 characters.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave({ name: name.trim(), statusText: statusText.trim() });
      onClose();
    } catch (failure: unknown) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your profile was not saved. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              Profile
            </Text>
            <BrutalButton
              title="Close"
              size="sm"
              variant="outline"
              disabled={busy}
              onPress={onClose}
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.identity}>
              <MonogramAvatar
                monogram={user.monogram}
                size={56}
                backgroundColor={user.avatarColor || BrutalColors.accentYellow}
              />
              <View>
                <Text style={styles.label}>{user.name}</Text>
                <Text style={styles.meta}>{user.handle}</Text>
              </View>
            </View>
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <Text style={styles.label}>Display name</Text>
            <BrutalInput
              accessibilityLabel="Display name"
              autoComplete="name"
              autoCapitalize="words"
              maxLength={80}
              value={name}
              onChangeText={setName}
              editable={!busy}
            />
            <Text style={styles.label}>Status message</Text>
            <BrutalInput
              accessibilityLabel="Status message"
              placeholder="What would you like your team to know?"
              maxLength={160}
              multiline
              value={statusText}
              onChangeText={setStatusText}
              editable={!busy}
              style={styles.status}
            />
            <Text style={styles.meta}>
              {statusText.length}/160 characters · Leave blank to clear your
              status message.
            </Text>
            <BrutalButton
              title={busy ? "Saving..." : "Save profile"}
              disabled={
                busy ||
                !name.trim() ||
                (name.trim() === user.name &&
                  statusText.trim() === (user.statusText || ""))
              }
              onPress={() => {
                void save();
              }}
            />
            <BrutalButton
              title="Cancel"
              variant="outline"
              disabled={busy}
              onPress={onClose}
            />
            <Text style={styles.label}>Account security</Text>
            {confirmLogout ? (
              <View style={{ gap: 12 }}>
                <Text accessibilityRole="alert" style={styles.meta}>
                  Sign out all devices? You will need to sign in again on every
                  device, including this one.
                </Text>
                <BrutalButton
                  title="Confirm sign out all devices"
                  variant="pink"
                  disabled={busy}
                  onPress={() => {
                    void logoutAll();
                  }}
                />
                <BrutalButton
                  title="Keep signed in"
                  variant="outline"
                  disabled={busy}
                  onPress={() => setConfirmLogout(false)}
                />
              </View>
            ) : (
              <BrutalButton
                title="Sign out all devices"
                variant="outline"
                disabled={busy}
                onPress={() => setConfirmLogout(true)}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: BrutalColors.bgPaper },
    header: {
      padding: 16,
      borderBottomWidth: 3,
      borderColor: BrutalColors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontFamily: Fonts.sans,
      fontWeight: "900",
      fontSize: 24,
      color: BrutalColors.ink,
    },
    content: { padding: 20, gap: 16 },
    identity: { flexDirection: "row", alignItems: "center", gap: 16 },
    label: {
      fontFamily: Fonts.sans,
      fontWeight: "700",
      fontSize: 16,
      color: BrutalColors.ink,
    },
    meta: {
      fontFamily: Fonts.sans,
      fontSize: 13,
      color: BrutalColors.inkMuted,
    },
    status: { minHeight: 100, textAlignVertical: "top" },
    error: { padding: 12, backgroundColor: "#FFE0E9", color: "#1A1A1A" },
  });
