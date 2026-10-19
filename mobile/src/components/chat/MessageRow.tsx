import { memo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import { Fonts } from "@/constants/theme";
import type { Message, User } from "@/types/chat";
import { MonogramAvatar } from "../brutal/MonogramAvatar";

/** A memoized message row keeps unrelated rows stable during reaction and profile updates. */
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
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : timestampFormatter.format(date);
};
export const MessageRow = memo(function MessageRow({
  item,
  sender,
  onToggleReaction,
  onOpenActions,
  highlighted,
}: {
  item: Message;
  sender: User;
  onToggleReaction: (messageId: string, icon: string) => void;
  onOpenActions: (messageId: string) => void;
  highlighted: boolean;
}) {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  return (
    <View style={styles.messageItem}>
      <MonogramAvatar
        monogram={sender.monogram}
        backgroundColor={sender.avatarColor || BrutalColors.accentYellow}
        size={36}
        status={sender.status}
      />
      <View
        style={[
          styles.messageContent,
          highlighted && {
            borderColor: BrutalColors.accentBlue,
            borderWidth: 3,
          },
        ]}
      >
        {highlighted && <Text style={styles.roleText}>SEARCH RESULT</Text>}
        <View style={styles.senderHeader}>
          <Text style={styles.senderName}>{sender.name}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{sender.role}</Text>
          </View>
          <Text style={styles.timestamp}>
            {formatTimestamp(item.timestamp)}
          </Text>
          {!item.deletedAt &&
            (item.canEdit || item.canDelete || item.canPin) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Message actions for ${sender.name}`}
                hitSlop={8}
                onPress={() => onOpenActions(item.id)}
                style={{
                  minWidth: 32,
                  minHeight: 32,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text style={styles.senderName}>•••</Text>
              </Pressable>
            )}
        </View>
        {item.deletedAt ? (
          <Text style={styles.messageText}>Deleted message</Text>
        ) : (
          <>
            {item.isPinned && <Text style={styles.roleText}>PINNED</Text>}
            {item.editedAt && <Text style={styles.roleText}>Edited</Text>}
            {item.content ? (
              <Text selectable style={styles.messageText}>
                {item.content}
              </Text>
            ) : null}
            {item.codeSnippet && (
              <View style={styles.codeSnippetCard}>
                <View style={styles.codeSnippetHeader}>
                  <Text style={styles.codeSnippetLang}>
                    {item.codeSnippet.language.toUpperCase()}
                  </Text>
                </View>
                <Text selectable style={styles.codeSnippetContent}>
                  {item.codeSnippet.code}
                </Text>
              </View>
            )}

            <View style={styles.reactionsRow}>
              {item.reactions?.map((reaction) => (
                <Pressable
                  key={reaction.icon}
                  accessibilityRole="button"
                  accessibilityLabel={`React ${reaction.icon}, ${reaction.count} reactions`}
                  accessibilityState={{ selected: reaction.reactedByMe }}
                  hitSlop={8}
                  onPress={() => onToggleReaction(item.id, reaction.icon)}
                  style={[
                    styles.reactionPill,
                    reaction.reactedByMe && styles.reactionPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.reactionIcon,
                      reaction.reactedByMe && { color: "#1A1A1A" },
                    ]}
                  >
                    {reactionSymbols[reaction.icon] || reaction.icon}
                  </Text>
                  <Text
                    style={[
                      styles.reactionCount,
                      reaction.reactedByMe && { color: "#1A1A1A" },
                    ]}
                  >
                    {reaction.count}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add sparkle reaction"
                hitSlop={8}
                onPress={() => onToggleReaction(item.id, "sparkle")}
                style={styles.addReactionBtn}
              >
                <Text style={styles.addReactionText}>+ ✦</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add heart reaction"
                hitSlop={8}
                onPress={() => onToggleReaction(item.id, "heart")}
                style={styles.addReactionBtn}
              >
                <Text style={styles.addReactionText}>+ ♥</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
});

const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    messageItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    messageContent: {
      flex: 1,
      backgroundColor: BrutalColors.bgCard,
      borderWidth: 2.5,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      padding: 12,
      gap: 8,
      ...Platform.select({
        web: {
          boxShadow: `2px 2px 0px ${BrutalColors.border}`,
        },
        default: {
          shadowColor: BrutalColors.border,
          shadowOffset: { width: 2, height: 2 },
          shadowOpacity: 1,
          shadowRadius: 0,
          elevation: 2,
        },
      }),
    },
    senderHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    senderName: {
      fontFamily: Fonts?.sans,
      fontWeight: "900",
      fontSize: 13,
      color: BrutalColors.ink,
    },
    roleBadge: {
      borderWidth: 1.5,
      borderColor: BrutalColors.border,
      borderRadius: 3,
      backgroundColor: BrutalColors.bgCardAlt,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    roleText: {
      fontFamily: Fonts?.mono,
      fontSize: 9,
      fontWeight: "800",
      color: BrutalColors.inkSecondary,
    },
    timestamp: {
      fontFamily: Fonts?.mono,
      fontSize: 10,
      color: BrutalColors.inkMuted,
      marginLeft: "auto",
    },
    messageText: {
      fontFamily: Fonts?.sans,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "500",
      color: BrutalColors.ink,
    },
    codeSnippetCard: {
      backgroundColor: "#1A1A1A",
      borderWidth: 2,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      padding: 10,
      gap: 6,
    },
    codeSnippetHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    codeSnippetLang: {
      fontFamily: Fonts?.mono,
      fontSize: 9,
      fontWeight: "800",
      color: BrutalColors.accentYellow,
    },
    codeSnippetContent: {
      fontFamily: Fonts?.mono,
      fontSize: 12,
      color: "#FFFFFF",
      lineHeight: 18,
    },
    reactionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
      marginTop: 2,
    },
    reactionPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1.5,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      backgroundColor: BrutalColors.bgCardAlt,
      paddingHorizontal: 7,
      paddingVertical: 3,
    },
    reactionPillActive: {
      backgroundColor: BrutalColors.accentYellow,
      borderWidth: 2,
    },
    reactionIcon: {
      fontSize: 11,
    },
    reactionCount: {
      fontFamily: Fonts?.mono,
      fontSize: 10,
      fontWeight: "800",
      color: BrutalColors.ink,
    },
    addReactionBtn: {
      minWidth: 32,
      minHeight: 32,
      borderWidth: 1.5,
      borderColor: BrutalColors.inkFaint,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 3,
      backgroundColor: "transparent",
    },
    addReactionText: {
      fontFamily: Fonts?.mono,
      fontSize: 10,
      fontWeight: "700",
      color: BrutalColors.inkMuted,
    },
  });
