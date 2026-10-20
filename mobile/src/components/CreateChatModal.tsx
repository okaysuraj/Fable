/** A focused create flow uses the existing authorized chat API. */
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { api } from "@/services/api";
import { Fonts } from "@/constants/theme";
import { useBrutalStyles, type BrutalPalette } from "@/hooks/use-brutal-theme";
import type { Channel } from "@/types/chat";
import { BrutalButton } from "./brutal/BrutalButton";
import { BrutalInput } from "./brutal/BrutalInput";
import { NewDirectChat } from "./NewDirectChat";

export function CreateChatModal({
  currentUserId,
  onClose,
  onCreated,
}: {
  onClose: () => void;
  currentUserId: string;
  onCreated: (chat: Channel) => void;
}) {
  const styles = useBrutalStyles(createStyles);
  const reduceMotion = useReducedMotion();
  const [name, setName] = useState("");
  const [group, setGroup] = useState(false);
  const [topic, setTopic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const submit = async () => {
    if (inFlight.current || !name.trim()) return;
    inFlight.current = true;
    setPending(true);
    setError("");
    try {
      const chat = await api.createChannel({
        name: name.trim(),
        topic: topic.trim(),
        type: "text",
        isPrivate,
      });
      onCreated(chat);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not start the chat. Try again.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  return (
    <Modal
      visible
      presentationStyle="pageSheet"
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={() => {
        if (!pending) onClose();
      }}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <Text accessibilityRole="header" style={styles.title}>
              New chat
            </Text>
            <NewDirectChat
              currentUserId={currentUserId}
              onCreated={onCreated}
            />
            <BrutalButton
              title={group ? "Hide group form" : "Create a group conversation"}
              variant="outline"
              onPress={() => setGroup(!group)}
            />
            {group && (
              <>
                <Text style={styles.copy}>
                  A place for a conversation with your group.
                </Text>
                <Text style={styles.label}>Chat name</Text>
                <BrutalInput
                  autoFocus
                  accessibilityLabel="Chat name"
                  value={name}
                  onChangeText={setName}
                  maxLength={80}
                  editable={!pending}
                />
                <Text style={styles.label}>Description (optional)</Text>
                <BrutalInput
                  accessibilityLabel="Chat description"
                  value={topic}
                  onChangeText={setTopic}
                  maxLength={500}
                  editable={!pending}
                />
                <View style={styles.row}>
                  <Text style={styles.label}>Private chat</Text>
                  <Switch
                    accessibilityLabel="Private chat"
                    value={isPrivate}
                    onValueChange={setIsPrivate}
                    disabled={pending}
                  />
                </View>
                <Text style={styles.copy}>
                  {isPrivate
                    ? "Only people you add can see this chat. Add them in Chat details after creating it."
                    : "Everyone in your group can see this chat."}
                </Text>
                {!!error && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                )}
                <BrutalButton
                  title={pending ? "Creating…" : "Create chat"}
                  disabled={pending || !name.trim()}
                  onPress={() => {
                    void submit();
                  }}
                />
              </>
            )}
            <BrutalButton
              title="Cancel"
              variant="outline"
              disabled={pending}
              onPress={onClose}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const createStyles = (colors: BrutalPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgPaper },
    content: { padding: 24, gap: 14 },
    title: {
      fontFamily: Fonts.display,
      fontSize: 28,
      fontWeight: "700",
      color: colors.ink,
    },
    copy: {
      fontFamily: Fonts.sans,
      fontSize: 14,
      lineHeight: 22,
      color: colors.inkMuted,
    },
    label: { fontFamily: Fonts.medium, fontSize: 15, color: colors.ink },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 8,
    },
    error: { fontFamily: Fonts.sans, fontSize: 14, color: colors.accentPink },
  });
