/** Real messages use aligned bubbles; actions remain reachable on touch devices. */
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useBrutalStyles, useBrutalTheme, type BrutalPalette } from "@/hooks/use-brutal-theme";
import { Fonts } from "@/constants/theme";
import type { Message, User } from "@/types/chat";
import { MessageMedia } from "./MessageMedia";
import { AppIcon } from "../ui/AppIcon";
import Animated, {
  FadeInDown,
  useReducedMotion,
} from "react-native-reanimated";

const reactionSymbols: Record<string, string> = {
  sparkle: "✦",
  check: "✓",
  heart: "♥",
  "thumbs-up": "👍",
  laugh: "😄",
  eyes: "👀",
};
const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : timestampFormatter.format(date);
}
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
}: Props) {
  const styles = useBrutalStyles(createStyles);
  const colors = useBrutalTheme();
  const reduceMotion = useReducedMotion();
  const canAct = !item.deletedAt;
  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.duration(180)}
      style={[styles.messageItem, isSelf && styles.selfItem]}
    >
      <View
        style={[
          styles.bubble,
          isSelf && styles.selfBubble,
          highlighted && styles.highlighted,
        ]}
      >
        {highlighted && (
          <Text style={[styles.caption, isSelf && styles.selfCaption]}>
            Search result
          </Text>
        )}
        {!isSelf && <Text style={styles.senderName}>{sender.name}</Text>}
        {item.replyToId && (
          <View
            style={{
              borderLeftWidth: 3,
              borderLeftColor: isSelf ? "#FFFFFF80" : "#0067DD",
              paddingLeft: 10,
            }}
          >
            <Text style={[styles.caption, isSelf && styles.selfCaption]}>
              Reply
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.caption, isSelf && styles.selfCaption]}
            >
              {replyPreview}
            </Text>
          </View>
        )}
        <Text
          selectable={!item.deletedAt}
          style={[
            styles.messageText,
            isSelf && styles.selfText,
            /^\p{Extended_Pictographic}[\p{Extended_Pictographic}\p{Emoji_Component}\s]*$/u.test(
              item.content,
            ) && { fontSize: 34, lineHeight: 44 },
          ]}
        >
          {item.deletedAt ? "Deleted message" : item.content}
        </Text>
        {!item.deletedAt && item.codeSnippet && (
          <View style={[styles.code, isSelf && styles.selfCode]}>
            <Text style={[styles.caption, isSelf && styles.selfCaption]}>
              {item.codeSnippet.language}
            </Text>
            <Text
              selectable
              style={[styles.codeText, isSelf && styles.selfText]}
            >
              {item.codeSnippet.code}
            </Text>
          </View>
        )}
        {!item.deletedAt &&
          item.attachments?.map((asset) => (
            <MessageMedia key={asset.id} asset={asset} />
          ))}
        {!item.deletedAt && (
          <View style={styles.reactions}>
            {item.reactions?.map((reaction) => (
              <Pressable
                key={reaction.icon}
                accessibilityRole="button"
                accessibilityLabel={
                  (reaction.reactedByMe ? "Remove " : "Add ") +
                  reaction.icon +
                  " reaction (" +
                  reaction.count +
                  ")"
                }
                accessibilityState={{ selected: reaction.reactedByMe }}
                onPress={() => onToggleReaction(item.id, reaction.icon)}
                hitSlop={8}
                style={[
                  styles.reaction,
                  reaction.reactedByMe && styles.selectedReaction,
                  isSelf && styles.selfReaction,
                ]}
              >
                <Text style={[styles.reactionText, isSelf && styles.selfText]}>
                  {reactionSymbols[reaction.icon] || reaction.icon}{" "}
                  {reaction.count}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.metadata}>
          {receipt && (
            <Text style={[styles.caption, isSelf && styles.selfCaption]}>
              {receipt}
            </Text>
          )}
          {item.isPinned && (
            <Text style={[styles.caption, isSelf && styles.selfCaption]}>
              Pinned
            </Text>
          )}
          {item.editedAt && !item.deletedAt && (
            <Text style={[styles.caption, isSelf && styles.selfCaption]}>
              Edited
            </Text>
          )}
          <Text style={[styles.timestamp, isSelf && styles.selfCaption]}>
            {formatTimestamp(item.timestamp)}
          </Text>
          {canAct && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Reply to ${sender.name}`}
              onPress={() => onReply(item)}
              style={styles.action}
            >
              <AppIcon name="reply" size={17} color={isSelf ? "#FFFFFF" : colors.inkMuted} />
            </Pressable>
          )}
          {canAct && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={"Message actions for " + sender.name}
              onPress={() => onOpenActions(item.id)}
              hitSlop={10}
              style={styles.action}
            >
              <AppIcon name="more" size={19} color={isSelf ? "#FFFFFF" : colors.inkMuted} />
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
});
const createStyles = (colors: BrutalPalette) =>
  StyleSheet.create({
    messageItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      width: "100%",
      paddingVertical: 4,
    },
    selfItem: { justifyContent: "flex-end" },
    bubble: {
      maxWidth: "84%",
      flexShrink: 1,
      backgroundColor: colors.bubbleReceived,
      borderRadius: 20,
      borderBottomLeftRadius: 6,
      paddingHorizontal: 15,
      paddingTop: 10,
      paddingBottom: 7,
      gap: 6,
    },
    selfBubble: {
      backgroundColor: colors.bubbleSent,
      borderBottomLeftRadius: 20,
      borderBottomRightRadius: 6,
    },
    highlighted: { borderWidth: 1, borderColor: colors.primary },
    senderName: {
      fontFamily: Fonts.sans,
      fontSize: 15,
      lineHeight: 19,
      color: colors.inkSecondary,
    },
    messageText: {
      fontFamily: Fonts.sans,
      fontSize: 18,
      lineHeight: 25,
      color: colors.ink,
    },
    selfText: { color: "#FFFFFF" },
    caption: {
      fontFamily: Fonts.sans,
      fontSize: 11,
      color: colors.inkSecondary,
    },
    selfCaption: { color: "#FFFFFF" },
    metadata: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      gap: 7,
      minHeight: 22,
    },
    timestamp: {
      fontFamily: Fonts.sans,
      fontSize: 11,
      color: colors.inkSecondary,
    },
    action: {
      minWidth: 44,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    more: { fontSize: 18, color: colors.inkMuted },
    code: {
      backgroundColor: colors.codeBg,
      borderRadius: 9,
      padding: 10,
      gap: 6,
      marginVertical: 4,
    },
    selfCode: { backgroundColor: "#FFFFFF1C" },
    codeText: {
      fontFamily: Fonts.mono,
      fontSize: 12,
      lineHeight: 20,
      color: colors.ink,
    },
    reactions: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    reaction: {
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 9,
      backgroundColor: colors.bgCardAlt,
    },
    selectedReaction: {
      borderColor: colors.primary,
      backgroundColor: colors.selection,
    },
    selfReaction: { backgroundColor: "#FFFFFF20", borderColor: "#FFFFFF60" },
    reactionText: { fontFamily: Fonts.medium, fontSize: 12, color: colors.ink },
  });
