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
  Keyboard,
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
import { UserAvatar } from "../ui/UserAvatar";
import { MonogramAvatar } from "../brutal/MonogramAvatar";
import { ChatWallpaper } from "./ChatWallpaper";
import { AppIcon } from "../ui/AppIcon";
import { MotionPressable as Pressable } from "../ui/MotionPressable";
import { api } from "@/services/api";
import { useGroupCalling } from "../calling/GroupCallingProvider";
import { groupCalls, type GroupCallSummary } from "@/services/groupCalls";
import { subscribeRealtime } from "@/services/realtime";

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
  onOpenChatDetails: () => void;
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
  hideBackButton = false,
  channel,
  currentUser,
  messages,
  teamMembers,
  onSendMessage,
  onToggleReaction,
  onToggleDrawer,
  onOpenNavigation,
  onOpenChatDetails,
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
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const calling = useCalling();
  const groupCalling = useGroupCalling();
  const [groupCallingEnabled, setGroupCallingEnabled] = useState(false);
  const [groupCall, setGroupCall] = useState<{
    channelId: string;
    call: GroupCallSummary | null;
  } | null>(null);
  const liveGroupCall =
    groupCall?.channelId === channel.id ? groupCall.call : null;
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (channel.isDirect || !channel.isPrivate) return;
      const capability = await groupCalls.config();
      if (!alive) return;
      setGroupCallingEnabled(capability.data.enabled);
      if (capability.data.enabled) {
        const active = await groupCalls.active(channel.id);
        if (alive) setGroupCall({ channelId: channel.id, call: active });
      }
    };
    void load().catch(() => {
      /* Existing message synchronization continues during calling-service outages. */
    });
    const unsubscribe = subscribeRealtime((event) => {
      if (
        event.type === "ready" ||
        (event.type === "groupcall.updated" && event.channelId === channel.id)
      )
        void load().catch(() => {});
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [channel.id, channel.isDirect, channel.isPrivate]);
  const [reply, setReply] = useState<Message | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const { presence, available } = useConversationPresence(
    channel.id,
    inputText,
  );
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [muteState, setMuteState] = useState<{
    channelId: string;
    muted: boolean;
  } | null>(null);
  const muted = muteState?.channelId === channel.id ? muteState.muted : null;
  const mutePending = useRef(false);
  useEffect(() => {
    let alive = true;
    void api
      .notificationPreference(channel.id)
      .then((value) => {
        if (alive) setMuteState({ channelId: channel.id, muted: value.muted });
      })
      .catch(() => {
        if (alive) setSendError("Chat notification settings couldn't load.");
      });
    return () => {
      alive = false;
    };
  }, [channel.id]);
  const toggleMute = async () => {
    if (mutePending.current || muted === null) return;
    mutePending.current = true;
    try {
      const preference = await api.setNotificationPreference(
        channel.id,
        !muted,
      );
      setMuteState({ channelId: channel.id, muted: preference.muted });
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : "Couldn't update chat notifications.",
      );
    } finally {
      mutePending.current = false;
    }
  };
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
    ({ item, index }: { item: Message; index: number }) => (
      <MessageRow
        item={item}
        showSender={
          !channel.isDirect &&
          (index === reversedMessages.length - 1 ||
            reversedMessages[index + 1]?.sender.id !== item.sender.id)
        }
        dayLabel={
          index === reversedMessages.length - 1 ||
          new Date(reversedMessages[index + 1].timestamp).toDateString() !==
            new Date(item.timestamp).toDateString()
            ? new Intl.DateTimeFormat(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(item.timestamp))
            : undefined
        }
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
      reversedMessages,
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
          <ChatWallpaper />
          <View style={styles.header}>
            {!hideBackButton && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to chats"
                onPress={onToggleDrawer}
                style={styles.menuBtn}
              >
                <AppIcon
                  name="back"
                  size={26}
                  color={BrutalColors.chatAccent}
                />
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                channel.isDirect ? "Contact information" : "Group information"
              }
              onPress={onOpenChatDetails}
              style={styles.identity}
            >
              {channel.peer ? (
                <UserAvatar user={channel.peer} size={40} />
              ) : (
                <MonogramAvatar
                  monogram={channel.name.slice(0, 2).toUpperCase()}
                  size={40}
                  backgroundColor="#D3E9DE"
                />
              )}
              <View style={styles.channelMeta}>
                <Text style={styles.channelTitle} numberOfLines={1}>
                  {channel.name}
                </Text>
                <Text style={styles.channelTopic} numberOfLines={1}>
                  {presence?.typing.length
                    ? "typing…"
                    : channel.isDirect
                      ? channel.peer?.status === "online"
                        ? "online"
                        : "Tap here for contact info"
                      : `${channel.memberCount} members`}
                </Text>
              </View>
            </Pressable>
            <View style={styles.headerActions}>
              {(channel.isDirect ||
                (channel.isPrivate && groupCallingEnabled)) && (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start video call"
                    onPress={() =>
                      channel.isDirect
                        ? calling.start(channel.id, "video", channel.name)
                        : groupCalling.start(channel.id, "video", channel.name)
                    }
                    style={styles.headerActionBtn}
                  >
                    <AppIcon
                      name="video"
                      size={25}
                      color={BrutalColors.chatAccent}
                    />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start audio call"
                    onPress={() =>
                      channel.isDirect
                        ? calling.start(channel.id, "audio", channel.name)
                        : groupCalling.start(channel.id, "audio", channel.name)
                    }
                    style={styles.headerActionBtn}
                  >
                    <AppIcon
                      name="call"
                      size={23}
                      color={BrutalColors.chatAccent}
                    />
                  </Pressable>
                </>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Chat options"
                accessibilityState={{ expanded: headerMenuOpen }}
                onPress={() => {
                  Keyboard.dismiss();
                  setHeaderMenuOpen(!headerMenuOpen);
                }}
                style={styles.headerActionBtn}
              >
                <AppIcon
                  name={Platform.OS === "ios" ? "more" : "moreVertical"}
                  size={25}
                  color={BrutalColors.chatAccent}
                />
              </Pressable>
            </View>
          </View>
          {liveGroupCall && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Join ongoing group call"
              onPress={() =>
                groupCalling.start(channel.id, liveGroupCall.kind, channel.name)
              }
              style={{
                paddingHorizontal: 18,
                paddingVertical: 12,
                backgroundColor: BrutalColors.chatReceived,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <AppIcon
                name={liveGroupCall.kind === "video" ? "video" : "call"}
                size={22}
                color={BrutalColors.chatAccent}
              />
              <Text style={{ color: BrutalColors.chatInk, flex: 1 }}>
                Group call · {liveGroupCall.participants.length} joined
              </Text>
              <Text
                style={{ color: BrutalColors.chatAccent, fontWeight: "600" }}
              >
                Join
              </Text>
            </Pressable>
          )}
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
          {channel.type === "text" ? (
            <MediaComposer
              channelId={channel.id}
              disabled={sending}
              assets={assets}
              onUploaded={(asset) =>
                setAssets((previous) =>
                  previous.some((item) => item.id === asset.id)
                    ? previous
                    : [...previous, asset],
                )
              }
              onRemoved={(id) =>
                setAssets((previous) =>
                  previous.filter((asset) => asset.id !== id),
                )
              }
              onBusy={setMediaBusy}
              endControl={
                inputText.trim() || assets.length || sending ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Send message"
                    accessibilityState={{
                      busy: sending,
                      disabled: sending || mediaBusy,
                    }}
                    disabled={sending || mediaBusy}
                    onPress={() => void handleSend()}
                    style={[
                      styles.sendBtn,
                      (sending || mediaBusy) && { opacity: 0.5 },
                    ]}
                  >
                    {sending ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <AppIcon name="send" size={23} color="#FFFFFF" />
                    )}
                  </Pressable>
                ) : undefined
              }
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose emoji"
                accessibilityState={{ expanded: emojiOpen }}
                onPress={() => {
                  Keyboard.dismiss();
                  setEmojiOpen(!emojiOpen);
                }}
                style={{
                  minWidth: 42,
                  minHeight: 48,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <AppIcon
                  name="emoji"
                  size={25}
                  color={BrutalColors.chatMuted}
                />
              </Pressable>
              <BrutalInput
                accessibilityLabel="Message"
                value={inputText}
                editable={!sending && !mediaBusy}
                onChangeText={setInputText}
                onFocus={() => setEmojiOpen(false)}
                placeholder="Message"
                maxLength={10000}
                multiline
                submitBehavior="newline"
                style={styles.chatInput}
              />
            </MediaComposer>
          ) : (
            <Text style={[styles.messageText, { padding: 16 }]}>
              Open a direct conversation for an audio or video call.
            </Text>
          )}
          {headerMenuOpen && (
            <View style={styles.chatMenuLayer}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close chat options"
                onPress={() => setHeaderMenuOpen(false)}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.chatMenu}>
                {[
                  {
                    title: "Search messages",
                    icon: "search" as const,
                    action: onOpenMessageSearch,
                  },
                  {
                    title: channel.isDirect ? "Contact info" : "Group info",
                    icon: "info" as const,
                    action: onOpenChatDetails,
                  },
                  {
                    title: "Account menu",
                    icon: "menu" as const,
                    action: onOpenNavigation,
                  },
                ].map((option) => (
                  <Pressable
                    key={option.title}
                    accessibilityRole="button"
                    onPress={() => {
                      setHeaderMenuOpen(false);
                      option.action();
                    }}
                    style={styles.chatMenuRow}
                  >
                    <AppIcon
                      name={option.icon}
                      size={22}
                      color={BrutalColors.chatAccent}
                    />
                    <Text style={styles.chatMenuText}>{option.title}</Text>
                  </Pressable>
                ))}
                {muted !== null && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setHeaderMenuOpen(false);
                      void toggleMute();
                    }}
                    style={styles.chatMenuRow}
                  >
                    <AppIcon
                      name={muted ? "notifications" : "notificationsOff"}
                      size={22}
                      color={BrutalColors.chatAccent}
                    />
                    <Text style={styles.chatMenuText}>
                      {muted ? "Unmute notifications" : "Mute notifications"}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
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
            onReply={() => {
              setReply(selectedMessage);
              onActionMessageChanged(null);
            }}
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
    identity: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      minHeight: 48,
    },
    chatMenuLayer: { ...StyleSheet.absoluteFill, zIndex: 50 },
    chatMenu: {
      position: "absolute",
      top: 62,
      right: 12,
      width: 240,
      backgroundColor: BrutalColors.chatHeader,
      borderRadius: 16,
      paddingVertical: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: BrutalColors.border,
      boxShadow: "0 8px 28px #00000022",
    },
    chatMenuRow: {
      flexDirection: "row",
      gap: 14,
      alignItems: "center",
      minHeight: 52,
      paddingHorizontal: 18,
    },
    chatMenuText: {
      fontFamily: Fonts.sans,
      fontSize: 15,
      color: BrutalColors.chatInk,
    },
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
      backgroundColor: BrutalColors.chatBackground,
    },
    container: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: BrutalColors.chatHeader,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: BrutalColors.border,
      gap: 6,
    },
    menuBtn: {
      flexDirection: "row",
      minWidth: 34,
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
      fontSize: 17,
      lineHeight: 23,
      color: BrutalColors.chatInk,
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
      paddingHorizontal: 10,
      paddingVertical: 8,
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
      minWidth: 0,
      minHeight: 48,
      maxHeight: 128,
      borderWidth: 0,
      backgroundColor: "transparent",
      paddingHorizontal: 0,
      paddingVertical: 12,
      fontSize: 16,
      lineHeight: 22,
      color: BrutalColors.chatInk,
    },
    sendBtn: {
      width: 48,
      height: 48,
      borderWidth: 0,
      borderRadius: 24,
      backgroundColor: BrutalColors.chatAccent,
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
