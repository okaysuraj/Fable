/** Compact conversation bubbles keep message actions on long press. */
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  useBrutalStyles,
  useBrutalTheme,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import { Fonts } from "@/constants/theme";
import type { Message, User } from "@/types/chat";
import { MessageMedia } from "./MessageMedia";
import { AppIcon } from "../ui/AppIcon";
const reactionSymbols: Record<string, string> = {
  sparkle: "✦",
  check: "✓",
  heart: "♥",
  "thumbs-up": "👍",
  laugh: "😄",
  eyes: "👀",
};

const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});
interface Props {
  onReply: (message: Message) => void;
  replyPreview?: string;
  receipt?: string;
  item: Message;
  sender: User;
  onToggleReaction: (id: string, icon: string) => void;
  onOpenActions: (id: string) => void;
  highlighted: boolean;
  isSelf: boolean;
  showSender: boolean;
  dayLabel?: string;
}
export const MessageRow = memo(function MessageRow({
  onReply,
  replyPreview,
  receipt,
  item,
  sender,
  onToggleReaction,
  onOpenActions,
  highlighted,
  isSelf,
  showSender,
  dayLabel,
}: Props) {
  const styles = useBrutalStyles(createStyles);
  const colors = useBrutalTheme();
  const date = new Date(item.timestamp);
  const timestamp = Number.isNaN(date.getTime())
    ? ""
    : timestampFormatter.format(date);
  const canAct = !item.deletedAt;
  return (
    <View style={styles.wrapper}>
      {dayLabel ? (
        <View style={styles.dayRow}>
          <Text style={styles.day}>{dayLabel}</Text>
        </View>
      ) : null}
      <View style={[styles.messageItem, isSelf && styles.selfItem]}>
        <Pressable
          onLongPress={() => {
            if (canAct) onOpenActions(item.id);
          }}
          delayLongPress={300}
          accessibilityActions={
            canAct
              ? [
                  { name: "longpress", label: "Message actions" },
                  { name: "reply", label: "Reply" },
                ]
              : []
          }
          onAccessibilityAction={(event) => {
            if (!canAct) return;
            if (event.nativeEvent.actionName === "reply") onReply(item);
            else onOpenActions(item.id);
          }}
          style={[
            styles.bubble,
            isSelf && styles.selfBubble,
            highlighted && styles.highlighted,
          ]}
        >
          {showSender && !isSelf ? (
            <Text style={styles.senderName}>{sender.name}</Text>
          ) : null}
          {highlighted ? (
            <Text style={styles.caption}>Search result</Text>
          ) : null}
          {item.replyToId ? (
            <View style={styles.quote}>
              <Text style={styles.quoteLabel}>Reply</Text>
              <Text numberOfLines={2} style={styles.caption}>
                {replyPreview}
              </Text>
            </View>
          ) : null}
          {item.content || item.deletedAt ? (
            <Text
              selectable={!item.deletedAt}
              style={[
                styles.messageText,
                /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\p{Emoji_Component}\s]*$/u.test(
                  item.content,
                ) && { fontSize: 32, lineHeight: 42 },
              ]}
            >
              {item.deletedAt ? "This message was deleted" : item.content}
            </Text>
          ) : null}
          {!item.deletedAt && item.codeSnippet ? (
            <View style={styles.code}>
              <Text style={styles.caption}>{item.codeSnippet.language}</Text>
              <Text selectable style={styles.codeText}>
                {item.codeSnippet.code}
              </Text>
            </View>
          ) : null}
          {!item.deletedAt &&
            item.attachments?.map((asset) => (
              <MessageMedia key={asset.id} asset={asset} />
            ))}
          {Boolean(item.reactions?.length) && !item.deletedAt ? (
            <View style={styles.reactions}>
              {item.reactions?.map((reaction) => (
                <Pressable
                  key={reaction.icon}
                  accessibilityRole="button"
                  accessibilityLabel={`${reaction.reactedByMe ? "Remove" : "Add"} ${reaction.icon} reaction, ${reaction.count}`}
                  accessibilityState={{ selected: reaction.reactedByMe }}
                  onPress={() => onToggleReaction(item.id, reaction.icon)}
                  hitSlop={8}
                  style={[
                    styles.reaction,
                    reaction.reactedByMe && styles.selectedReaction,
                  ]}
                >
                  <Text style={styles.reactionText}>
                    {reactionSymbols[reaction.icon] || reaction.icon}{" "}
                    {reaction.count}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.metadata}>
            {item.isPinned ? (
              <AppIcon name="pin" size={12} color={colors.chatMuted} />
            ) : null}
            {item.editedAt && !item.deletedAt ? (
              <Text style={styles.caption}>edited</Text>
            ) : null}
            {receipt?.startsWith("Read by") ? (
              <Text style={styles.caption}>{receipt}</Text>
            ) : null}
            <Text style={styles.timestamp}>{timestamp}</Text>
            {isSelf && !item.deletedAt ? (
              <View accessible accessibilityLabel={receipt || "Sent"}>
                <AppIcon
                  name={receipt === "Read" ? "read" : "sent"}
                  size={16}
                  color={receipt === "Read" ? "#53BDEB" : colors.chatMuted}
                />
              </View>
            ) : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
});
const createStyles = (colors: BrutalPalette) =>
  StyleSheet.create({
    wrapper: { width: "100%" },
    dayRow: { alignItems: "center", paddingVertical: 12 },
    day: {
      backgroundColor: colors.chatHeader,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 7,
      color: colors.chatMuted,
      fontFamily: Fonts.medium,
      fontSize: 11,
      overflow: "hidden",
    },
    messageItem: {
      flexDirection: "row",
      justifyContent: "flex-start",
      width: "100%",
      paddingVertical: 3,
    },
    selfItem: { justifyContent: "flex-end" },
    bubble: {
      maxWidth: "85%",
      flexShrink: 1,
      backgroundColor: colors.chatReceived,
      borderRadius: 9,
      borderTopLeftRadius: 1,
      paddingHorizontal: 10,
      paddingTop: 7,
      paddingBottom: 4,
      gap: 3,
      boxShadow: "0 1px 1px #0000000D",
    },
    selfBubble: {
      backgroundColor: colors.chatOutgoing,
      borderTopLeftRadius: 9,
      borderTopRightRadius: 1,
    },
    highlighted: { borderWidth: 1, borderColor: colors.chatAccent },
    senderName: {
      color: colors.chatAccent,
      fontFamily: Fonts.medium,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 2,
    },
    messageText: {
      fontFamily: Fonts.sans,
      fontSize: 16,
      lineHeight: 22,
      color: colors.chatInk,
    },
    caption: {
      fontFamily: Fonts.sans,
      fontSize: 10,
      color: colors.chatMuted,
      lineHeight: 15,
    },
    metadata: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 4,
      minHeight: 17,
      paddingLeft: 20,
    },
    timestamp: {
      fontFamily: Fonts.sans,
      fontSize: 10,
      color: colors.chatMuted,
    },
    quote: {
      borderLeftWidth: 3,
      borderLeftColor: colors.chatAccent,
      backgroundColor: "#00000008",
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderRadius: 5,
      marginBottom: 4,
    },
    quoteLabel: {
      color: colors.chatAccent,
      fontFamily: Fonts.medium,
      fontSize: 12,
    },
    code: { backgroundColor: "#00000008", borderRadius: 6, padding: 9, gap: 5 },
    codeText: {
      fontFamily: Fonts.mono,
      fontSize: 12,
      lineHeight: 19,
      color: colors.chatInk,
    },
    reactions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 5,
      paddingTop: 3,
    },
    reaction: {
      paddingVertical: 4,
      paddingHorizontal: 7,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      backgroundColor: colors.chatHeader,
    },
    selectedReaction: { borderColor: colors.chatAccent },
    reactionText: {
      fontFamily: Fonts.sans,
      fontSize: 12,
      color: colors.chatInk,
    },
  });
