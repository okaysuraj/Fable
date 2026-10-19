/** Own virtualized history navigation, composer drafts and native keyboard/scroll interactions. */
import { MessageRow } from "./MessageRow";
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Fonts } from "@/constants/theme";
import { Channel, Message, User } from "@/types/chat";
import { BrutalInput } from "../brutal/BrutalInput";
import { MessageActionsModal } from "./MessageActionsModal";

interface MobileChatViewProps {
  channel: Channel;
  messages: Message[];
  teamMembers: User[];
  onSendMessage: (content: string) => Promise<void>;
  onToggleReaction: (messageId: string, icon: string) => void;
  onToggleDrawer: () => void;
  onOpenContextDrawer: () => void;
  onOpenMessageSearch: () => void;
  highlightedMessageId?: string | null;
  loading?: boolean;
  onEditMessage: (message: Message, content: string) => Promise<void>;
  onDeleteMessage: (message: Message) => Promise<void>;
  onPinMessage: (message: Message, isPinned: boolean) => Promise<void>;
  pinnedMessages?: Message[];
  actionMessage: Message | null;
  onActionMessageChanged: (message: Message | null) => void;
  pinnedLoading?: boolean;
  pageRevision: number;
  pinPageRevision: number;
  archive: boolean;
  pinsArchive: boolean;
  hasOlder: boolean;
  hasNewer: boolean;
  hasOlderPins: boolean;
  hasNewerPins: boolean;
  onNavigateHistory: (
    direction: "earlier" | "newer" | "latest",
    pinned: boolean,
  ) => void;
  onPinnedViewChanged: (pinned: boolean) => void;
}
const keyExtractor = (item: Message) => item.id;
export const MobileChatView: React.FC<MobileChatViewProps> = ({
  channel,
  messages,
  teamMembers,
  onSendMessage,
  onToggleReaction,
  onToggleDrawer,
  onOpenContextDrawer,
  onOpenMessageSearch,
  highlightedMessageId,
  loading = false,
  archive,
  pinsArchive,
  pageRevision,
  pinPageRevision,
  hasOlder,
  hasNewer,
  hasOlderPins,
  hasNewerPins,
  onNavigateHistory,
  onPinnedViewChanged,
  onEditMessage,
  onDeleteMessage,
  onPinMessage,
  pinnedMessages = [],
  actionMessage,
  onActionMessageChanged,
  pinnedLoading = false,
}) => {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [showPinned, setShowPinned] = useState(false);
  const sendInFlight = useRef(false);
  const flatListRef = useRef<FlatList<Message>>(null);
  const nearBottom = useRef(true);
  const reduceMotion = useReducedMotion();
  const lastMessage = useRef<string | undefined>(undefined);
  const focusRetries = useRef(0);
  const focusedPage = useRef("");
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const displayedMessages = showPinned ? pinnedMessages : messages;
  const reversedMessages = useMemo(
    () => [...displayedMessages].reverse(),
    [displayedMessages],
  );
  const profiles = useMemo(
    () => new Map(teamMembers.map((member) => [member.id, member])),
    [teamMembers],
  );
  const selectedMessage = actionMessage;
  const actionLookup = useRef(new Map<string, Message>());
  useEffect(() => {
    actionLookup.current = new Map(
      [...messages, ...pinnedMessages].map((message) => [message.id, message]),
    );
  }, [messages, pinnedMessages]);
  const openActions = useCallback(
    (id: string) => {
      const message = actionLookup.current.get(id);
      if (message) onActionMessageChanged(message);
    },
    [onActionMessageChanged],
  );
  const renderMessageItem = useCallback(
    ({ item }: { item: Message }) => (
      <MessageRow
        item={item}
        sender={profiles.get(item.sender.id) || item.sender}
        onToggleReaction={onToggleReaction}
        onOpenActions={openActions}
        highlighted={item.id === highlightedMessageId}
      />
    ),
    [onToggleReaction, profiles, openActions, highlightedMessageId],
  );
  useEffect(() => {
    focusRetries.current = 0;
    if (!showPinned && highlightedMessageId && !loading) {
      const focusKey = `${highlightedMessageId}:${pageRevision}`;
      if (focusedPage.current === focusKey) return;
      const index = reversedMessages.findIndex(
        (message) => message.id === highlightedMessageId,
      );
      if (index >= 0) {
        focusedPage.current = focusKey;
        nearBottom.current = false;
        flatListRef.current?.scrollToIndex({
          index,
          animated: false,
          viewPosition: 0.5,
        });
      }
    }
    return () => {
      if (focusTimer.current) clearTimeout(focusTimer.current);
    };
  }, [
    highlightedMessageId,
    pageRevision,
    reversedMessages,
    showPinned,
    loading,
  ]);
  const handleSend = async () => {
    if (!inputText.trim() || sendInFlight.current) return;
    sendInFlight.current = true;
    setSending(true);
    setSendError("");
    const content = inputText.trim();
    try {
      await onSendMessage(content);
      setInputText("");
      setShowPinned(false);
      onPinnedViewChanged(false);
      nearBottom.current = true;
      flatListRef.current?.scrollToOffset({
        offset: 0,
        animated: !reduceMotion,
      });
    } catch (error: unknown) {
      setSendError(
        error instanceof Error
          ? error.message
          : "Message was not sent. Please try again.",
      );
    } finally {
      sendInFlight.current = false;
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open workspace menu"
            onPress={onToggleDrawer}
            style={styles.menuBtn}
            hitSlop={8}
          >
            <Text style={styles.menuBtnText}>☰</Text>
          </Pressable>
          <View style={styles.channelMeta}>
            <View style={styles.channelTitleRow}>
              <View style={styles.channelBadge}>
                <Text style={styles.channelBadgeText}>#</Text>
              </View>
              <Text style={styles.channelTitle} numberOfLines={1}>
                {channel.name}
              </Text>
            </View>
            <Text style={styles.channelTopic} numberOfLines={1}>
              {channel.topic}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search message history"
              onPress={onOpenMessageSearch}
              style={styles.headerActionBtn}
              hitSlop={8}
            >
              <Text style={styles.headerActionIcon}>⌕</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View channel details"
              onPress={onOpenContextDrawer}
              style={styles.headerActionBtn}
              hitSlop={8}
            >
              <Text style={styles.headerActionIcon}>ⓘ</Text>
            </Pressable>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showPinned ? "Back to conversation" : "Pinned messages"
          }
          onPress={() => {
            setShowPinned((value) => !value);
            onPinnedViewChanged(!showPinned);
            nearBottom.current = true;
          }}
          style={styles.pinnedBanner}
        >
          <View style={styles.pinnedTag}>
            <Text style={styles.pinnedTagText}>
              {showPinned ? "BACK" : "PINNED"}
            </Text>
          </View>
          <Text style={styles.pinnedText} numberOfLines={1}>
            {showPinned
              ? "Back to conversation"
              : `Pinned messages · ${pinnedMessages.length}${hasOlderPins ? "+" : ""}`}
          </Text>
        </Pressable>
        <View
          style={{
            padding: 10,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 8,
            borderBottomWidth: 2,
            borderColor: BrutalColors.border,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              showPinned ? "Earlier pins" : "Earlier messages"
            }
            disabled={
              (showPinned ? pinnedLoading : loading) ||
              !(showPinned ? hasOlderPins : hasOlder)
            }
            onPress={() => {
              nearBottom.current = true;
              onNavigateHistory("earlier", showPinned);
            }}
            style={[
              styles.historyButton,
              !(showPinned ? hasOlderPins : hasOlder) && { opacity: 0.4 },
            ]}
          >
            <Text style={styles.messageText}>
              {showPinned ? "Earlier pins" : "Earlier messages"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPinned ? "Newer pins" : "Newer messages"}
            disabled={
              (showPinned ? pinnedLoading : loading) ||
              !(showPinned ? hasNewerPins : hasNewer)
            }
            onPress={() => {
              nearBottom.current = true;
              onNavigateHistory("newer", showPinned);
            }}
            style={[
              styles.historyButton,
              !(showPinned ? hasNewerPins : hasNewer) && { opacity: 0.4 },
            ]}
          >
            <Text style={styles.messageText}>
              {showPinned ? "Newer pins" : "Newer messages"}
            </Text>
          </Pressable>
          {(showPinned ? pinsArchive || hasNewerPins : archive || hasNewer) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                showPinned ? "Latest pins" : "Latest messages"
              }
              disabled={showPinned ? pinnedLoading : loading}
              onPress={() => {
                nearBottom.current = true;
                onNavigateHistory("latest", showPinned);
              }}
              style={styles.historyButton}
            >
              <Text style={styles.messageText}>
                {showPinned ? "Latest pins" : "Latest messages"}
              </Text>
            </Pressable>
          )}
        </View>
        <FlatList
          key={
            showPinned
              ? `pinned:${pinPageRevision}`
              : `conversation:${pageRevision}`
          }
          ref={flatListRef}
          inverted
          data={reversedMessages}
          keyExtractor={keyExtractor}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.messagesList}
          onScrollToIndexFailed={(info) => {
            if (focusRetries.current >= 2) return;
            focusRetries.current += 1;
            flatListRef.current?.scrollToOffset({
              offset: Math.max(0, info.averageItemLength * info.index),
              animated: false,
            });
            if (focusTimer.current) clearTimeout(focusTimer.current);
            focusTimer.current = setTimeout(() => {
              flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: false,
                viewPosition: 0.5,
              });
            }, 100);
          }}
          initialNumToRender={16}
          maxToRenderPerBatch={10}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          ListEmptyComponent={
            <View style={{ padding: 24 }}>
              {(showPinned ? pinnedLoading : loading) ? (
                <ActivityIndicator color={BrutalColors.ink} />
              ) : (
                <Text style={styles.messageText}>
                  {showPinned
                    ? "No pinned messages."
                    : "No messages yet. Start the conversation."}
                </Text>
              )}
            </View>
          }
          onScroll={(event) => {
            nearBottom.current = event.nativeEvent.contentOffset.y < 100;
          }}
          scrollEventThrottle={64}
          onContentSizeChange={() => {
            const next = displayedMessages.at(-1)?.id;
            if (next !== lastMessage.current && nearBottom.current)
              flatListRef.current?.scrollToOffset({
                offset: 0,
                animated: !reduceMotion,
              });
            lastMessage.current = next;
          }}
        />
        {sendError ? (
          <Text
            accessibilityRole="alert"
            style={{
              padding: 12,
              color: "#1A1A1A",
              backgroundColor: "#FFE0E9",
            }}
          >
            {sendError}
          </Text>
        ) : null}
        {channel.type === "text" ? (
          <View style={styles.inputDock}>
            <BrutalInput
              accessibilityLabel="Message"
              value={inputText}
              editable={!sending}
              onChangeText={setInputText}
              placeholder={`Message #${channel.name}...`}
              maxLength={10000}
              style={styles.chatInput}
              onSubmitEditing={() => {
                void handleSend();
              }}
              returnKeyType="send"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              accessibilityState={{
                disabled: sending || !inputText.trim(),
                busy: sending,
              }}
              disabled={sending || !inputText.trim()}
              onPress={() => {
                void handleSend();
              }}
              style={[
                styles.sendBtn,
                (sending || !inputText.trim()) && { opacity: 0.5 },
              ]}
            >
              {sending ? (
                <ActivityIndicator color={BrutalColors.ink} />
              ) : (
                <Text style={styles.sendBtnText}>→</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.messageText, { padding: 16 }]}>
            Live audio and video are unavailable until the calling service is
            configured. Choose a text channel to send messages.
          </Text>
        )}
      </KeyboardAvoidingView>
      {selectedMessage && (
        <MessageActionsModal
          message={selectedMessage}
          permissions={{
            edit: selectedMessage.canEdit,
            delete: selectedMessage.canDelete,
            pin: selectedMessage.canPin,
          }}
          onClose={() => onActionMessageChanged(null)}
          onEdit={onEditMessage}
          onDelete={onDeleteMessage}
          onPin={onPinMessage}
        />
      )}
    </SafeAreaView>
  );
};
const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    historyButton: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      minHeight: 44,
      borderWidth: 2,
      borderColor: BrutalColors.border,
      backgroundColor: BrutalColors.bgCard,
    },
    safeArea: {
      flex: 1,
      backgroundColor: BrutalColors.bgPaper,
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: BrutalColors.bgCard,
      borderBottomWidth: 3,
      borderBottomColor: BrutalColors.border,
      gap: 10,
    },
    menuBtn: {
      width: 36,
      height: 36,
      borderWidth: 2.5,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      backgroundColor: BrutalColors.accentYellow,
      alignItems: "center",
      justifyContent: "center",
    },
    menuBtnText: {
      fontSize: 16,
      fontWeight: "900",
      color: "#1A1A1A",
    },
    channelMeta: {
      flex: 1,
    },
    channelTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    channelBadge: {
      width: 20,
      height: 20,
      borderWidth: 2,
      borderColor: BrutalColors.border,
      borderRadius: 3,
      alignItems: "center",
      justifyContent: "center",
    },
    channelBadgeText: {
      fontFamily: Fonts?.mono,
      fontWeight: "900",
      fontSize: 11,
      color: BrutalColors.ink,
    },
    channelTitle: {
      fontFamily: Fonts?.sans,
      fontWeight: "900",
      fontSize: 16,
      color: BrutalColors.ink,
    },
    channelTopic: {
      fontFamily: Fonts?.sans,
      fontSize: 11,
      color: BrutalColors.inkMuted,
      fontWeight: "500",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    headerActionBtn: {
      width: 34,
      height: 34,
      borderWidth: 2,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      backgroundColor: BrutalColors.bgCardAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    headerActionIcon: {
      fontSize: 14,
    },
    pinnedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: BrutalColors.bgCardAlt,
      borderBottomWidth: 2,
      borderBottomColor: BrutalColors.border,
    },
    pinnedTag: {
      borderWidth: 1.5,
      borderColor: BrutalColors.border,
      borderRadius: 3,
      backgroundColor: BrutalColors.accentYellow,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    pinnedTagText: {
      fontFamily: Fonts?.mono,
      fontSize: 9,
      fontWeight: "900",
      color: "#1A1A1A",
    },
    pinnedText: {
      flex: 1,
      fontFamily: Fonts?.sans,
      fontSize: 11,
      fontWeight: "600",
      color: BrutalColors.inkSecondary,
    },
    messagesList: {
      padding: 14,
      gap: 14,
    },
    messageText: {
      fontFamily: Fonts?.sans,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "500",
      color: BrutalColors.ink,
    },
    inputDock: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: BrutalColors.bgCard,
      borderTopWidth: 3,
      borderTopColor: BrutalColors.border,
      gap: 8,
    },
    chatInput: {
      flex: 1,
      paddingVertical: 10,
    },
    sendBtn: {
      width: 44,
      height: 44,
      borderWidth: 2.5,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      backgroundColor: BrutalColors.accentYellow,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnText: {
      fontFamily: Fonts?.mono,
      fontSize: 20,
      fontWeight: "900",
      color: "#1A1A1A",
    },
  });
