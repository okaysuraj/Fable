import { useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { useBrutalStyles, useBrutalTheme, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { Fonts } from "@/constants/theme";
import type { User } from "@/types/chat";
import { api } from "@/services/api";
import { choosePhoto, photoBytes, releasePhoto } from "@/services/photos";
import { BrutalInput } from "./brutal/BrutalInput";
import { BrutalButton } from "./brutal/BrutalButton";
import { AppIcon } from "./ui/AppIcon";
import { MotionPressable } from "./ui/MotionPressable";
import { UserAvatar } from "./ui/UserAvatar";

export function ProfileModal({ user, onClose, onSave, onPhotoUpdated }: {
  user: User; onClose: () => void; onSave: (values: { name: string; phoneNumber: string | null }) => Promise<void>; onPhotoUpdated: (user: User) => void;
}) {
  const colors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phoneNumber || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const changePhoto = async () => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    let draft = null;
    try {
      draft = await choosePhoto("library", true);
      if (draft) onPhotoUpdated(await api.updateProfilePhoto(await photoBytes(draft, 2 * 1024 * 1024)));
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Couldn't save your photo."); }
    finally { releasePhoto(draft); inFlight.current = false; setBusy(false); }
  };
  const save = async () => {
    if (inFlight.current) return;
    const number = phone.trim() ? parsePhoneNumberFromString(phone.trim()) : null;
    if (phone.trim() && (!number?.isValid() || !phone.trim().startsWith("+"))) { setError("Enter your number with its country code, starting with +."); return; }
    inFlight.current = true; setBusy(true); setError("");
    try { await onSave({ name: name.trim(), phoneNumber: number?.number ?? null }); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Your profile couldn't be saved."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <Modal visible presentationStyle="fullScreen" animationType={reducedMotion ? "none" : "slide"} onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={styles.screen}><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <MotionPressable accessibilityRole="button" accessibilityLabel="Close your profile" disabled={busy} onPress={onClose} style={styles.iconButton}><AppIcon name="back" /></MotionPressable>
        <Text accessibilityRole="header" style={styles.title}>Your Profile</Text>
        <MotionPressable accessibilityRole="button" accessibilityLabel="Save profile" disabled={busy || !name.trim()} onPress={() => void save()} style={styles.iconButton}>{busy ? <ActivityIndicator color={colors.primary} /> : <AppIcon name="check" />}</MotionPressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.photoArea}>
          <MotionPressable accessibilityRole="button" accessibilityLabel="Choose profile photo" disabled={busy} onPress={() => void changePhoto()} style={styles.photo}>
            <UserAvatar user={user} size={112} self />
            <View style={styles.camera}><AppIcon name="camera" color={colors.onPrimary} size={20} /></View>
          </MotionPressable>
          <MotionPressable accessibilityRole="button" disabled={busy} onPress={() => void changePhoto()} style={styles.changePhoto}><Text style={styles.link}>Change photo</Text></MotionPressable>
          {Boolean(user.photoVersion) && <BrutalButton title="Remove photo" variant="outline" size="sm" disabled={busy} onPress={() => {
            if (inFlight.current) return;
            inFlight.current = true; setBusy(true); setError("");
            void api.removeProfilePhoto().then(onPhotoUpdated).catch((failure: unknown) => setError(failure instanceof Error ? failure.message : "Couldn't remove your photo.")).finally(() => { inFlight.current = false; setBusy(false); });
          }} />}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Text style={styles.label}>Name</Text>
        <BrutalInput accessibilityLabel="Your name" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" maxLength={80} editable={!busy} />
        <Text style={styles.label}>Email address</Text>
        <View style={styles.readOnly}><AppIcon name="mail" size={20} color={colors.inkMuted} /><Text selectable style={styles.email}>{user.email || "Email unavailable"}</Text><AppIcon name="lock" size={16} color={colors.inkFaint} /></View>
        <Text style={styles.hint}>Your sign-in email stays private.</Text>
        <Text style={styles.label}>Phone number</Text>
        <BrutalInput accessibilityLabel="Phone number with country code" value={phone} onChangeText={setPhone} placeholder="+ country code and number" keyboardType="phone-pad" autoComplete="tel" maxLength={24} editable={!busy} />
        <Text style={styles.hint}>People with this number can find you on Fable. Adding a number does not verify ownership.</Text>
        <BrutalButton title={busy ? "Saving…" : "Save profile"} size="lg" disabled={busy || !name.trim()} onPress={() => void save()} />
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}
const createStyles = (colors: BrutalPalette) => StyleSheet.create({
  flex: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.bgPaper }, header: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, padding: 12 }, iconButton: { width: 48, height: 48, alignItems: "center", justifyContent: "center" }, title: { flex: 1, fontFamily: Fonts.medium, color: colors.ink, fontSize: 20 }, content: { padding: 24, gap: 12, maxWidth: 560, width: "100%", alignSelf: "center" }, photoArea: { alignItems: "center", paddingVertical: 20, gap: 6 }, photo: { width: 112, height: 112 }, camera: { position: "absolute", right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: colors.bgPaper, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center" }, changePhoto: { minHeight: 44, justifyContent: "center" }, link: { fontFamily: Fonts.medium, fontSize: 15, color: colors.primary }, label: { fontFamily: Fonts.medium, fontSize: 14, color: colors.inkSecondary, marginTop: 12 }, readOnly: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderRadius: 14, paddingHorizontal: 16, backgroundColor: colors.bgCardAlt }, email: { flex: 1, color: colors.ink, fontFamily: Fonts.sans, fontSize: 15 }, hint: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, color: colors.inkMuted }, error: { fontSize: 14, color: colors.dangerButton, backgroundColor: colors.dangerSurface, padding: 14, borderRadius: 12 },
});
