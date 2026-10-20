import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { api } from "@/services/api";
import type { Channel, User } from "@/types/chat";
import type { PhoneContact } from "@/hooks/use-phone-contacts";
import { useBrutalStyles, useBrutalTheme, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { Fonts } from "@/constants/theme";
import { AppIcon } from "./ui/AppIcon";
import { MotionPressable } from "./ui/MotionPressable";
import { SearchField } from "./ui/SearchField";
import { UserAvatar } from "./ui/UserAvatar";
import { PhoneContactsList } from "./PhoneContactsList";

export function NewGroupModal({ currentUser, onClose, onCreated }: { currentUser: User; onClose: () => void; onCreated: (chat: Channel) => void | Promise<void> }) {
  const colors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState<"people" | "name">("people");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PhoneContact[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const search = useRef<TextInput>(null);
  const nameInput = useRef<TextInput>(null);
  const pending = useRef(false);
  const mutation = useRef(`group_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    const frame = requestAnimationFrame(() => (step === "people" ? search : nameInput).current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [step]);
  const submit = async () => {
    if (pending.current || !name.trim() || !selected.length) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const chat = await api.createGroup(name.trim(), selected.map((person) => person.id), mutation.current);
      await onCreated(chat);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Couldn't create this group. Your selections are saved here."); }
    finally { pending.current = false; setBusy(false); }
  };
  const canContinue = selected.length > 0 && (step === "people" || name.trim().length > 0);
  return <Modal visible presentationStyle="fullScreen" animationType={reducedMotion ? "none" : "slide"} onShow={() => search.current?.focus()} onRequestClose={() => { if (!busy) step === "name" ? setStep("people") : onClose(); }}>
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <MotionPressable accessibilityRole="button" accessibilityLabel={step === "people" ? "Cancel new group" : "Back to contacts"} disabled={busy} onPress={() => step === "people" ? onClose() : setStep("people")} style={styles.iconButton}><AppIcon name="back" /></MotionPressable>
          <View style={styles.headerBody}><Text accessibilityRole="header" style={styles.title}>{step === "people" ? "New Group" : "Name your group"}</Text><Text style={styles.subtitle}>{selected.length ? `${selected.length} ${selected.length === 1 ? "person" : "people"} selected` : "Select at least one person"}</Text></View>
          <MotionPressable accessibilityRole="button" accessibilityLabel={step === "people" ? "Continue to group name" : "Create group"} accessibilityState={{ disabled: busy || !canContinue, busy }} disabled={busy || !canContinue} onPress={() => { if (step === "people") { Keyboard.dismiss(); setStep("name"); } else void submit(); }} style={[styles.next, !canContinue && { opacity: 0.35 }]}>{busy ? <ActivityIndicator color={colors.onPrimary} /> : <AppIcon name={step === "people" ? "next" : "check"} color={colors.onPrimary} />}</MotionPressable>
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {step === "people" ? <>
          <View style={styles.search}><SearchField inputRef={search} autoFocus accessibilityLabel="Search contacts by name or number" placeholder="Search name or phone number" value={query} onChangeText={setQuery} /></View>
          {selected.length > 0 && <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipContent}>{selected.map((person) => <MotionPressable key={person.id} accessibilityRole="button" accessibilityLabel={`Remove ${person.contactName}`} onPress={() => setSelected((previous) => previous.filter((item) => item.id !== person.id))} style={styles.chip}><Text numberOfLines={1} style={styles.chipText}>{person.contactName}</Text><AppIcon name="close" size={16} /></MotionPressable>)}</ScrollView>}
          <PhoneContactsList ownNumber={currentUser.phoneNumber} query={query} selected={selected.map((person) => person.id)} onSelect={(person) => { setError(""); setSelected((previous) => previous.some((item) => item.id === person.id) ? previous.filter((item) => item.id !== person.id) : previous.length < 99 ? [...previous, person] : previous); }} />
        </> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.details}>
          <View style={styles.groupIcon}><AppIcon name="people" size={40} /></View>
          <Text style={styles.label}>Group name</Text>
          <TextInput ref={nameInput} autoFocus accessibilityLabel="Group name" placeholder="Give your group a name" placeholderTextColor={colors.inkMuted} value={name} onChangeText={setName} editable={!busy} maxLength={80} style={styles.nameInput} returnKeyType="done" onSubmitEditing={() => void submit()} />
          <Text style={styles.subtitle}>{name.length}/80 · Only selected people can see this group.</Text>
          <Text style={styles.label}>Members</Text>
          {selected.map((person) => <View key={person.id} style={styles.member}><UserAvatar user={person} size={42} /><Text style={styles.memberName}>{person.contactName}</Text></View>)}
        </ScrollView>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
const createStyles = (colors: BrutalPalette) => StyleSheet.create({ flex: { flex: 1 }, screen: { flex: 1, backgroundColor: colors.bgPaper }, header: { flexDirection: "row", alignItems: "center", padding: 12, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, headerBody: { flex: 1 }, title: { fontFamily: Fonts.medium, color: colors.ink, fontSize: 20 }, subtitle: { fontFamily: Fonts.sans, color: colors.inkMuted, fontSize: 13, lineHeight: 20, marginTop: 4 }, iconButton: { width: 44, height: 48, alignItems: "center", justifyContent: "center" }, next: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }, search: { padding: 18 }, chips: { maxHeight: 52 }, chipContent: { paddingHorizontal: 20, gap: 8, paddingBottom: 8 }, chip: { flexDirection: "row", alignItems: "center", backgroundColor: colors.selection, borderRadius: 20, gap: 8, paddingHorizontal: 12, minHeight: 38 }, chipText: { fontFamily: Fonts.medium, color: colors.primary, fontSize: 13, maxWidth: 150 }, details: { padding: 24, gap: 14 }, groupIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.selection, alignItems: "center", justifyContent: "center", alignSelf: "center", marginVertical: 16 }, label: { fontFamily: Fonts.medium, fontSize: 15, color: colors.ink, marginTop: 12 }, nameInput: { fontFamily: Fonts.sans, fontSize: 20, color: colors.ink, padding: 16, backgroundColor: colors.bgCardAlt, borderRadius: 14, minHeight: 56 }, member: { flexDirection: "row", gap: 12, alignItems: "center", minHeight: 64 }, memberName: { fontFamily: Fonts.sans, color: colors.ink, fontSize: 16 }, error: { color: colors.dangerButton, padding: 16, fontSize: 14, backgroundColor: colors.dangerSurface } });
