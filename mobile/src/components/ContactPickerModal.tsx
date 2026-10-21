import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { api } from "@/services/api";
import { photoBytes, releasePhoto, type PhotoDraft } from "@/services/photos";
import type { Channel, MediaAsset, User } from "@/types/chat";
import type { PhoneContact } from "@/hooks/use-phone-contacts";
import { useBrutalStyles, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { Fonts } from "@/constants/theme";
import { AppIcon } from "./ui/AppIcon";
import { MotionPressable } from "./ui/MotionPressable";
import { SearchField } from "./ui/SearchField";
import { PhoneContactsList } from "./PhoneContactsList";
import { BrutalButton } from "./brutal/BrutalButton";

export function ContactPickerModal({
  currentUser,
  photo,
  onClose,
  onCreated,
}: {
  currentUser: User;
  photo?: PhotoDraft;
  onClose: () => void;
  onCreated: (chat: Channel) => Promise<void> | void;
}) {
  const styles = useBrutalStyles(createStyles);
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PhoneContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [recipientLocked, setRecipientLocked] = useState(false);
  const [error, setError] = useState("");
  const search = useRef<TextInput>(null);
  const inFlight = useRef(false);
  const pending = useRef<{
    personId: string;
    chat: Channel;
    asset?: MediaAsset;
  } | null>(null);
  const mutation = useRef<string | null>(null);
  useEffect(() => () => releasePhoto(photo ?? null), [photo]);
  const open = async (person: PhoneContact) => {
    if (inFlight.current) return;
    if (photo) {
      setSelected(person);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await onCreated(await api.contactDirect(person.id));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Couldn't open this chat.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const send = async () => {
    if (!photo || !selected || inFlight.current) return;
    mutation.current ??= `camera_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    setRecipientLocked(true);
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      let operation = pending.current;
      if (!operation) {
        operation = {
          personId: selected.id,
          chat: await api.contactDirect(selected.id),
        };
        pending.current = operation;
      }
      if (!operation.asset)
        operation.asset = await api.uploadMedia(
          operation.chat.id,
          photo.name,
          await photoBytes(photo),
          operation.chat.workspaceId,
        );
      await api.sendMessage(
        operation.chat.id,
        "",
        {
          attachmentIds: [operation.asset.id],
          clientMutationId: mutation.current,
        },
        operation.chat.workspaceId,
      );
      await onCreated(operation.chat);
    } catch (failure) {
      if (!pending.current) setRecipientLocked(false);
      setError(
        failure instanceof Error
          ? failure.message
          : "The photo wasn't sent. You can retry here.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Modal
      visible
      presentationStyle="fullScreen"
      animationType={reducedMotion ? "none" : "slide"}
      onShow={() => {
        if (!photo) search.current?.focus();
      }}
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <MotionPressable
              accessibilityRole="button"
              accessibilityLabel={photo ? "Cancel photo" : "Close new chat"}
              disabled={busy}
              onPress={onClose}
              style={styles.iconButton}
            >
              <AppIcon name="back" />
            </MotionPressable>
            <Text accessibilityRole="header" style={styles.title}>
              {photo ? "Send photo" : "New chat"}
            </Text>
            {busy ? <ActivityIndicator /> : null}
          </View>
          {photo ? (
            <Image
              source={{ uri: photo.uri }}
              style={styles.preview}
              resizeMode="contain"
              accessibilityLabel="Photo to send"
            />
          ) : null}
          <View style={styles.search}>
            <SearchField
              inputRef={search}
              autoFocus={!photo}
              accessibilityLabel="Search contacts by name, number or full email address"
              placeholder="Name, number or email"
              maxLength={254}
              value={query}
              onChangeText={setQuery}
              editable={!busy && !recipientLocked}
            />
          </View>
          <PhoneContactsList
            selectionMode={photo ? "single" : "none"}
            onReady={() => {
              if (!photo) search.current?.focus();
            }}
            ownNumber={currentUser.phoneNumber}
            query={query}
            selected={selected ? [selected.id] : []}
            disabled={busy || recipientLocked}
            onSelect={(person) => void open(person)}
          />
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          {photo && (
            <View style={styles.send}>
              <BrutalButton
                title={
                  busy
                    ? "Sending…"
                    : selected
                      ? `Send to ${selected.contactName}`
                      : "Choose someone to send to"
                }
                size="lg"
                disabled={busy || !selected}
                onPress={() => void send()}
                icon={<AppIcon name="send" color="#FFFFFF" size={21} />}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const createStyles = (colors: BrutalPalette) =>
  StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: colors.bgPaper },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    title: {
      flex: 1,
      color: colors.ink,
      fontFamily: Fonts.medium,
      fontSize: 20,
    },
    iconButton: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    preview: { height: 180, width: "100%", backgroundColor: colors.bgCardAlt },
    search: { padding: 18 },
    send: {
      padding: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    error: { padding: 16, color: colors.dangerButton, fontSize: 14 },
  });
