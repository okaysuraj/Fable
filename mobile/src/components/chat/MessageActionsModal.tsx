/** Keep native message edits and version-conflict recovery equivalent to the web dialog. */
import { useBrutalStyles, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Message } from "@/types/chat";
import { Fonts } from "@/constants/theme";
import { BrutalButton } from "../brutal/BrutalButton";
import { BrutalInput } from "../brutal/BrutalInput";

export interface MessageActionPermissions {
  edit: boolean;
  delete: boolean;
  pin: boolean;
}
interface Props {
  message: Message;
  permissions: MessageActionPermissions;
  onClose: () => void;
  onReply: () => void;
  onEdit: (message: Message, content: string) => Promise<void>;
  onDelete: (message: Message) => Promise<void>;
  onPin: (message: Message, isPinned: boolean) => Promise<void>;
  onToggleReaction: (id: string, icon: string) => void;
}

export function MessageActionsModal({
  message,
  permissions,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onPin,
  onToggleReaction,
}: Props) {
  const styles = useBrutalStyles(createStyles);
  const [mode, setMode] = useState<"actions" | "edit" | "delete">("actions");
  const [content, setContent] = useState(message.content);
  const [baseMessage, setBaseMessage] = useState(message);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const reduceMotion = useReducedMotion();
  const perform = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      onClose();
    } catch (failure: unknown) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The message could not be updated. Please try again.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const cancel = () => {
    setMode("actions");
    setError("");
  };
  return (
    <Modal
      visible
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView style={styles.sheet} edges={["left", "right", "bottom"]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <View style={styles.header}>
              <Text accessibilityRole="header" style={styles.title}>
                {mode === "edit"
                  ? "Edit message"
                  : mode === "delete"
                    ? "Delete message"
                    : "Message actions"}
              </Text>
              <BrutalButton
                title="Close"
                size="sm"
                variant="outline"
                disabled={busy}
                onPress={onClose}
              />
            </View>
            <Text style={styles.meta}>{message.sender.name}</Text>
            {message.deletedAt ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {mode === "edit"
                  ? "This message was deleted. Your draft is still available to copy."
                  : "This message was deleted."}
              </Text>
            ) : null}
            {error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            ) : null}
            {mode === "actions" ? (
              <>
                {message.deletedAt ? (
                  <Text style={styles.preview}>Deleted message</Text>
                ) : message.content ? (
                  <Text selectable numberOfLines={6} style={styles.preview}>
                    {message.content}
                  </Text>
                ) : (
                  <Text style={styles.preview}>
                    {message.attachments?.[0]?.name || "Code snippet"}
                  </Text>
                )}
                {!message.deletedAt && (
                  <View style={styles.reactions}>
                    {[
                      { icon: "👎", symbol: "👎" },
                      { icon: "‼️", symbol: "‼️" },
                      { icon: "❓", symbol: "❓" },
                      { icon: "🎉", symbol: "🎉" },
                      { icon: "😮", symbol: "😮" },
                      { icon: "😢", symbol: "😢" },
                      { icon: "heart", symbol: "♥" },
                      { icon: "thumbs-up", symbol: "👍" },
                      { icon: "laugh", symbol: "😄" },
                      { icon: "check", symbol: "✓" },
                      { icon: "eyes", symbol: "👀" },
                      { icon: "sparkle", symbol: "✦" },
                    ].map(({ icon, symbol }) => {
                      const selected = message.reactions?.some(
                        (reaction) =>
                          reaction.icon === icon && reaction.reactedByMe,
                      );
                      return (
                        <Pressable
                          key={icon}
                          accessibilityRole="button"
                          accessibilityLabel={`${selected ? "Remove" : "Add"} ${icon} reaction`}
                          accessibilityState={{ selected: Boolean(selected) }}
                          style={[
                            styles.reaction,
                            selected && styles.selectedReaction,
                          ]}
                          onPress={() => {
                            onToggleReaction(message.id, icon);
                            onClose();
                          }}
                        >
                          <Text style={styles.reactionSymbol}>{symbol}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                {!message.deletedAt && (
                  <BrutalButton
                    title="Reply"
                    variant="outline"
                    onPress={onReply}
                  />
                )}
                {permissions.edit && (
                  <BrutalButton
                    title="Edit message"
                    disabled={busy}
                    variant="outline"
                    onPress={() => {
                      setBaseMessage(message);
                      setContent(message.content);
                      setMode("edit");
                    }}
                  />
                )}
                {permissions.pin && (
                  <BrutalButton
                    title={message.isPinned ? "Unpin message" : "Pin message"}
                    disabled={busy}
                    variant="yellow"
                    onPress={() => {
                      void perform(() => onPin(message, !message.isPinned));
                    }}
                  />
                )}
                {permissions.delete && (
                  <BrutalButton
                    title="Delete message"
                    disabled={busy}
                    variant="pink"
                    onPress={() => {
                      setBaseMessage(message);
                      setMode("delete");
                    }}
                  />
                )}
              </>
            ) : mode === "edit" ? (
              <>
                <BrutalInput
                  accessibilityLabel="Edit message content"
                  autoFocus
                  multiline
                  value={content}
                  onChangeText={setContent}
                  maxLength={10000}
                  editable={!busy}
                  readOnly={Boolean(message.deletedAt)}
                  style={styles.editor}
                />
                {baseMessage.version !== message.version &&
                  !message.deletedAt && (
                    <View style={styles.conflict}>
                      <Text accessibilityRole="alert" style={styles.preview}>
                        This message changed while you were editing. Your draft
                        has been kept.
                      </Text>
                      <Text style={styles.meta}>Latest saved text</Text>
                      <Text selectable style={styles.preview}>
                        {message.content}
                      </Text>
                      <BrutalButton
                        title="Use latest version"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onPress={() => {
                          setBaseMessage(message);
                          setError("");
                        }}
                      />
                    </View>
                  )}
                <BrutalButton
                  title={busy ? "Saving…" : "Save changes"}
                  disabled={
                    busy ||
                    Boolean(message.deletedAt) ||
                    baseMessage.version !== message.version ||
                    (!content.trim() && !message.codeSnippet) ||
                    content.trim() === message.content
                  }
                  onPress={() => {
                    void perform(() => onEdit(baseMessage, content.trim()));
                  }}
                />
                <BrutalButton
                  title="Cancel"
                  variant="outline"
                  disabled={busy}
                  onPress={cancel}
                />
              </>
            ) : (
              <>
                <Text accessibilityRole="alert" style={styles.preview}>
                  Delete this message? This cannot be undone.
                </Text>
                <Text selectable numberOfLines={6} style={styles.preview}>
                  {message.content || "Code snippet"}
                </Text>
                {baseMessage.version !== message.version &&
                  !message.deletedAt && (
                    <View style={styles.conflict}>
                      <Text accessibilityRole="alert" style={styles.preview}>
                        This message changed. Review the latest text before
                        deleting.
                      </Text>
                      <BrutalButton
                        title="Use latest version"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onPress={() => {
                          setBaseMessage(message);
                          setError("");
                        }}
                      />
                    </View>
                  )}
                <BrutalButton
                  title={busy ? "Deleting…" : "Delete message"}
                  variant="pink"
                  disabled={
                    busy ||
                    Boolean(message.deletedAt) ||
                    baseMessage.version !== message.version
                  }
                  onPress={() => {
                    void perform(() => onDelete(baseMessage));
                  }}
                />
                <BrutalButton
                  title="Cancel"
                  variant="outline"
                  disabled={busy}
                  onPress={cancel}
                />
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    reactions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      paddingVertical: 8,
    },
    reaction: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: BrutalColors.border,
      backgroundColor: BrutalColors.bgCardAlt,
    },
    selectedReaction: {
      borderColor: BrutalColors.primary,
      backgroundColor: BrutalColors.selection,
    },
    reactionSymbol: { color: BrutalColors.ink, fontSize: 23 },
    overlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(26,26,26,0.6)",
    },
    sheet: {
      maxHeight: "85%",
      backgroundColor: BrutalColors.bgPaper,
      borderTopWidth: 1,
      borderColor: BrutalColors.border,
    },
    content: { padding: 20, gap: 16 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
    },
    title: {
      flex: 1,
      fontFamily: Fonts.display,
      fontSize: 22,
      fontWeight: "400",
      color: BrutalColors.ink,
    },
    meta: {
      fontFamily: Fonts.sans,
      fontSize: 13,
      color: BrutalColors.inkMuted,
    },
    preview: {
      fontFamily: Fonts.sans,
      fontSize: 18,
      lineHeight: 25,
      color: BrutalColors.ink,
    },
    editor: {
      minHeight: 160,
      maxHeight: 300,
      textAlignVertical: "top",
      fontFamily: Fonts.sans,
      fontSize: 18,
      lineHeight: 25,
    },
    error: {
      padding: 12,
      backgroundColor: BrutalColors.dangerSurface,
      color: BrutalColors.accentPink,
    },
    conflict: { padding: 12, backgroundColor: BrutalColors.bgCardAlt, gap: 12 },
  });
