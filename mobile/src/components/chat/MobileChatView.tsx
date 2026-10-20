/** Own virtualized history navigation, composer drafts and native keyboard/scroll interactions. */
import { MessageRow } from "./MessageRow";
import { useConversationPresence } from "./useConversationPresence";
import { useCalling } from "../calling/CallingProvider";
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
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Fonts } from "@/constants/theme";
import { Channel, Message, User, MediaAsset } from "@/types/chat";
import { MediaComposer } from "./MediaComposer";
import { MediaPreviewProvider } from "./MediaPreviewContext";
import { BrutalInput } from "../brutal/BrutalInput";
import { MessageActionsModal } from "./MessageActionsModal";
import { NavigationMenuButton } from "../NavigationDrawer";
import { AppIcon } from "../ui/AppIcon";
import { MotionPressable as Pressable } from "../ui/MotionPressable";

interface MobileChatViewProps {
  hideBackButton?: boolean;
  channel: Channel;
  currentUser: User;
  messages: Message[];
  teamMembers: User[];
  onSendMessage: (
    content: string,
    replyToId?: string,
    attachmentIds?: string[],
  ) => Promise<void>;
  onToggleReaction: (messageId: string, icon: string) => void;
  onToggleDrawer: () => void;
  onOpenNavigation: () => void;
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
  hideBackButton = false,
  channel,
  currentUser,
  messages,
  teamMembers,
  onSendMessage,
  onToggleReaction,
  onToggleDrawer,
  onOpenNavigation,
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
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const calling = useCalling();
  const [reply, setReply] = useState<Message | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const { presence, available } = useConversationPresence(
    channel.id,
    inputText,
  );
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
        isSelf={item.sender.id === currentUser.id}
        onReply={setReply}
        replyPreview={
          item.replyToId
            ? (() => {
                const parent = messages.find((m) => m.id === item.replyToId);
                return parent
                  ? parent.deletedAt
                    ? "Deleted message"
                    : `${parent.sender.name}: ${parent.content}`
                  : "Earlier message";
              })()
            : undefined
        }
        receipt={
          presence?.receipt?.messageId === item.id
            ? presence.receipt.readCount > 0
              ? channel.isDirect
                ? "Read"
                : `Read by ${presence.receipt.readCount}`
              : "Sent"
            : undefined
        }
      />
    ),
    [
      onToggleReaction,
      profiles,
      openActions,
      highlightedMessageId,
      currentUser.id,
      messages,
      presence,
      channel.isDirect,
    ],
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
    if (
      (!inputText.trim() && !assets.length) ||
      sendInFlight.current ||
      mediaBusy
    )
      return;
    sendInFlight.current = true;
    setSending(true);
    setSendError("");
    const content = inputText.trim();
    try {
      await onSendMessage(
        content,
        reply?.id,
        assets.map((a) => a.id),
      );
      setInputText("");
      setReply(null);
      setEmojiOpen(false);
      setAssets([]);
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
    <MediaPreviewProvider>
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            {!hideBackButton && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to chats"
                onPress={onToggleDrawer}
                style={styles.menuBtn}
                hitSlop={8}
              >
                <AppIcon name="back" size={25} />
                <Text style={styles.menuBtnText}>Chats</Text>
              </Pressable>
            )}
            <View style={styles.channelMeta}>
              <View style={styles.channelTitleRow}>
                <Text style={styles.channelTitle} numberOfLines={1}>
                  {channel.name}
                </Text>
              </View>
              <Text style={styles.channelTopic} numberOfLines={1}>
                {channel.topic ||
                  `${channel.memberCount} ${channel.memberCount === 1 ? "person" : "people"}`}
              </Text>
            </View>
            <View style={styles.headerActions}>
              {channel.isDirect && (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start audio call"
                    onPress={() =>
                      calling.start(channel.id, "audio", channel.name)
                    }
                    style={styles.headerActionBtn}
                  >
                    <AppIcon name="call" size={23} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start video call"
                    onPress={() =>
                      calling.start(channel.id, "video", channel.name)
                    }
                    style={styles.headerActionBtn}
                  >
                    <AppIcon name="video" size={25} />
                  </Pressable>
                </>
              )}
              <NavigationMenuButton onPress={onOpenNavigation} />
            </View>
          </View>
          {(showPinned || pinnedMessages.length > 0 || hasOlderPins) && (
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
                  {showPinned ? "Back" : "Pinned"}
                </Text>
              </View>
              <Text style={styles.pinnedText} numberOfLines={1}>
                {showPinned
                  ? "Back to conversation"
                  : `Pinned messages · ${pinnedMessages.length}${hasOlderPins ? "+" : ""}`}
              </Text>
            </Pressable>
          )}
          {(showPinned
            ? hasOlderPins || hasNewerPins || pinsArchive
            : hasOlder || hasNewer || archive) && (
            <View
              style={{
                padding: 10,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                borderBottomWidth: 1,
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
                accessibilityLabel={
                  showPinned ? "Newer pins" : "Newer messages"
                }
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
              {(showPinned
                ? pinsArchive || hasNewerPins
                : archive || hasNewer) && (
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
          )}
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
              <View style={styles.emptyState}>
                {(showPinned ? pinnedLoading : loading) ? (
                  <ActivityIndicator color={BrutalColors.ink} />
                ) : (
                  <>
                    <View style={styles.emptyIcon}>
                      <AppIcon name="chats" size={28} />
                    </View>
                    <Text style={styles.emptyTitle}>
                      {showPinned ? "Keep the details close" : "Say hello"}
                    </Text>
                    <Text style={styles.emptyCopy}>
                      {showPinned
                        ? "Pin a message from the conversation to find it here."
                        : channel.topic ||
                          `Send the first message in ${channel.name}.`}
                    </Text>
                  </>
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
          {!!presence?.typing.length && (
            <Text
              accessibilityLiveRegion="polite"
              style={{
                paddingHorizontal: 20,
                paddingVertical: 8,
                color: BrutalColors.inkMuted,
              }}
            >
              {presence.typing.map((p) => p.name).join(", ")}{" "}
              {presence.typing.length === 1 ? "is" : "are"} typing…
            </Text>
          )}
          {!available && (
            <Text
              style={{ paddingHorizontal: 20, color: BrutalColors.inkMuted }}
            >
              Live status unavailable
            </Text>
          )}
          {reply && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 12,
                backgroundColor: BrutalColors.bgCardAlt,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: BrutalColors.primary }}>
                  Replying to {reply.sender.name}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: BrutalColors.inkMuted }}
                >
                  {reply.content}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel reply"
                onPress={() => setReply(null)}
                style={{ padding: 14 }}
              >
                <AppIcon name="close" size={21} />
              </Pressable>
            </View>
          )}
          {emojiOpen && (
            <View
              accessibilityLabel="Emoji"
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                padding: 8,
                backgroundColor: BrutalColors.bgCardAlt,
              }}
            >
              {[
                "😀",
                "😂",
                "🥹",
                "😍",
                "😎",
                "🤔",
                "😮",
                "😢",
                "😭",
                "❤️",
                "👍",
                "👎",
                "🙏",
                "🎉",
                "🔥",
                "✨",
                "💯",
                "👋",
                "🤝",
                "🫶",
                "🥳",
                "😊",
                "🤩",
                "🤣",
                "😅",
                "🙃",
                "😴",
                "🙌",
                "💙",
                "✅",
                "🎂",
                "🌈",
              ].map((emoji) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Insert ${emoji}`}
                  key={emoji}
                  disabled={sending || inputText.length + emoji.length > 10000}
                  onPress={() => setInputText((t) => t + emoji)}
                  style={{
                    width: "12.5%",
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ fontSize: 26 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
          )}
          {sendError ? (
            <Text
              accessibilityRole="alert"
              style={{
                padding: 12,
                color: BrutalColors.accentPink,
                backgroundColor: BrutalColors.dangerSurface,
              }}
            >
              {sendError}
            </Text>
          ) : null}
          {channel.type === "text" && (
            <MediaComposer
              channelId={channel.id}
              disabled={sending}
              assets={assets}
              onUploaded={(asset) =>
                setAssets((previous) =>
                  previous.some((a) => a.id === asset.id)
                    ? previous
                    : [...previous, asset],
                )
              }
              onRemoved={(id) =>
                setAssets((previous) => previous.filter((a) => a.id !== id))
              }
              onBusy={setMediaBusy}
            />
          )}
          {channel.type === "text" ? (
            <View style={styles.inputDock}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose emoji"
                accessibilityState={{ expanded: emojiOpen }}
                onPress={() => setEmojiOpen(!emojiOpen)}
                style={{
                  minWidth: 44,
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppIcon name="emoji" size={27} />
              </Pressable>
              <BrutalInput
                accessibilityLabel="Message"
                value={inputText}
                editable={!sending}
                onChangeText={setInputText}
                placeholder="Message"
                maxLength={10000}
                multiline
                submitBehavior="newline"
                style={styles.chatInput}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                accessibilityState={{
                  disabled:
                    sending ||
                    mediaBusy ||
                    (!inputText.trim() && !assets.length),
                  busy: sending,
                }}
                disabled={
                  sending || mediaBusy || (!inputText.trim() && !assets.length)
                }
                onPress={() => {
                  void handleSend();
                }}
                style={[
                  styles.sendBtn,
                  (sending ||
                    mediaBusy ||
                    (!inputText.trim() && !assets.length)) && { opacity: 0.5 },
                ]}
              >
                {sending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <AppIcon name="send" size={23} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.messageText, { padding: 16 }]}>
              Open a direct conversation for an audio or video call. Choose a
              text chat to send messages.
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
            onToggleReaction={onToggleReaction}
          />
        )}
      </SafeAreaView>
    </MediaPreviewProvider>
  );
};
const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    historyButton: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      minHeight: 44,
      borderWidth: 1,
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
      paddingVertical: 8,
      backgroundColor: "transparent",
      borderBottomWidth: 1,
      borderBottomColor: BrutalColors.border,
      gap: 6,
    },
    menuBtn: {
      flexDirection: "row",
      minWidth: 64,
      minHeight: 48,
      borderWidth: 0,
      borderColor: BrutalColors.border,
      borderRadius: 10,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    menuBtnText: {
      fontFamily: Fonts.sans,
      fontSize: 16,
      color: BrutalColors.primary,
    },
    channelMeta: {
      flex: 1,
      minWidth: 0,
    },
    channelTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    channelBadge: {
      width: 28,
      height: 28,
      backgroundColor: "transparent",
      borderWidth: 0,
      borderColor: BrutalColors.border,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    channelBadgeText: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 12,
      color: BrutalColors.selectionInk,
    },
    channelTitle: {
      fontFamily: Fonts.sans,
      fontWeight: "400",
      fontSize: 22,
      lineHeight: 28,
      color: BrutalColors.ink,
    },
    channelTopic: {
      fontFamily: Fonts.medium,
      fontSize: 12,
      color: BrutalColors.inkMuted,
      fontWeight: "400",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    headerActionBtn: {
      width: 44,
      height: 44,
      borderWidth: 0,
      borderColor: BrutalColors.border,
      borderRadius: 10,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    headerActionIcon: {
      fontSize: 21,
      color: BrutalColors.primary,
    },
    pinnedBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: BrutalColors.bgCardAlt,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: BrutalColors.border,
    },
    pinnedTag: {
      borderWidth: 1,
      borderColor: BrutalColors.border,
      borderRadius: 10,
      backgroundColor: BrutalColors.accentYellow,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    pinnedTagText: {
      fontFamily: Fonts.semibold,
      fontSize: 12,
      fontWeight: "400",
      color: "#1A1A1A",
    },
    pinnedText: {
      flex: 1,
      fontFamily: Fonts.semibold,
      fontSize: 12,
      fontWeight: "400",
      color: BrutalColors.inkSecondary,
    },
    messagesList: {
      flexGrow: 1,
      padding: 18,
      gap: 13,
    },
    messageText: {
      fontFamily: Fonts.medium,
      fontSize: 15,
      lineHeight: 24,
      fontWeight: "400",
      color: BrutalColors.ink,
    },
    inputDock: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: "transparent",
      borderTopWidth: 0,
      borderTopColor: BrutalColors.border,
      gap: 8,
    },
    chatInput: {
      flex: 1,
      fontFamily: Fonts.sans,
      fontSize: 18,
      lineHeight: 25,
      paddingVertical: 10,
      maxHeight: 132,
      textAlignVertical: "top",
      backgroundColor: BrutalColors.bgCard,
      borderColor: BrutalColors.controlBorder,
      borderRadius: 23,
      minHeight: 44,
    },
    sendBtn: {
      width: 48,
      height: 48,
      borderWidth: 0,
      borderRadius: 24,
      backgroundColor: BrutalColors.bubbleSent,
      alignItems: "center",
      justifyContent: "center",
    },
    sendBtnText: {
      fontFamily: Fonts.display,
      fontSize: 20,
      fontWeight: "400",
      color: "#FFFFFF",
    },
    emptyState: {
      flex: 1,
      padding: 28,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      minHeight: 280,
    },
    emptyIcon: {
      width: 58,
      height: 58,
      borderRadius: 19,
      backgroundColor: BrutalColors.selection,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 8,
    },
    emptyIconText: {
      fontFamily: Fonts.semibold,
      fontSize: 28,
      color: BrutalColors.primary,
    },
    emptyTitle: {
      fontFamily: Fonts.sans,
      fontSize: 25,
      lineHeight: 34,
      color: BrutalColors.ink,
      textAlign: "center",
    },
    emptyCopy: {
      fontFamily: Fonts.sans,
      fontSize: 15,
      lineHeight: 24,
      color: BrutalColors.inkMuted,
      textAlign: "center",
    },
  });
