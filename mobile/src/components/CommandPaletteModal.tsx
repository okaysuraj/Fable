/** Native quick navigation uses authorized directory results and supports reduced motion. */
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import React, { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Fonts } from "@/constants/theme";
import { Channel, User } from "@/types/chat";
import { BrutalInput } from "./brutal/BrutalInput";
import { MonogramAvatar } from "./brutal/MonogramAvatar";
import { api } from "@/services/api";
import { useDirectory } from "./useDirectory";
import { DirectoryControls } from "./DirectoryControls";
import { AppIcon } from "./ui/AppIcon";
import { MotionPressable as Pressable } from "./ui/MotionPressable";
interface CommandPaletteModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectChannel: (channelId: string, workspaceId?: string) => void;
  onOpenSettings: () => void;
  onOpenMessageSearch?: () => void;
}

type Result =
  | { kind: "command"; id: string; title: string; action: () => void }
  | { kind: "channel"; channel: Channel }
  | { kind: "member"; member: User };
const keyExtractor = (item: Result) =>
  item.kind === "command"
    ? item.id
    : item.kind === "channel"
      ? item.channel.id
      : item.member.id;
export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  visible,
  onClose,
  onSelectChannel,
  onOpenSettings,
  onOpenMessageSearch,
}) => {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const [query, setQuery] = useState("");
  const rooms = useDirectory(api.fetchChannelDirectory);
  const people = useDirectory(api.fetchTeamDirectory);
  const reduceMotion = useReducedMotion();
  const sections = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [
      {
        title: "Commands & actions",
        kind: "commands",
        data: term
          ? []
          : ([
              ...(onOpenMessageSearch
                ? [
                    {
                      kind: "command",
                      id: "messages",
                      title: "Search message history",
                      action: onOpenMessageSearch,
                    } as Result,
                  ]
                : []),
              {
                kind: "command",
                id: "settings",
                title: "Open Settings",
                action: onOpenSettings,
              },
            ] as Result[]),
      },
      {
        title: "Chats",
        kind: "rooms",
        data: (rooms.page?.data || []).map((channel): Result => ({
          kind: "channel",
          channel,
        })),
      },
      {
        title: "People",
        kind: "people",
        data: (people.page?.data || []).map((member): Result => ({
          kind: "member",
          member,
        })),
      },
    ];
  }, [query, rooms.page, people.page, onOpenSettings, onOpenMessageSearch]);
  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? "none" : "fade"}
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <SafeAreaView style={[styles.modal, { height: "85%" }]}>
          <View style={styles.header}>
            <BrutalInput
              accessibilityLabel="Search chats and members"
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                rooms.search(value);
                people.search(value);
              }}
              placeholder="Search chats, group, commands…"
              autoFocus
              autoCorrect={false}
              maxLength={120}
              style={styles.searchInput}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close search"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <AppIcon name="close" size={24} />
            </Pressable>
          </View>
          <SectionList<Result>
            sections={sections}
            keyExtractor={keyExtractor}
            stickySectionHeadersEnabled={false}
            initialNumToRender={16}
            maxToRenderPerBatch={10}
            windowSize={5}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.resultsList}
            renderSectionHeader={({ section }) => {
              if (section.kind === "commands")
                return section.data.length ? (
                  <Text
                    style={[
                      styles.sectionTitle,
                      { marginTop: 12, marginBottom: 8 },
                    ]}
                  >
                    {section.title}
                  </Text>
                ) : null;
              const directory = section.kind === "rooms" ? rooms : people;
              return (
                <View>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <DirectoryControls
                    showSearch={false}
                    label={
                      section.kind === "rooms"
                        ? "Search chats"
                        : "Search members"
                    }
                    query={query}
                    onSearch={directory.search}
                    total={directory.page?.total}
                    loading={directory.loading}
                    error={directory.error}
                    onRetry={directory.reload}
                    canPrevious={directory.canPrevious}
                    hasMore={Boolean(directory.page?.hasMore)}
                    onPrevious={directory.previous}
                    onNext={directory.next}
                    onFirst={directory.first}
                    isFirst={directory.isFirst}
                  />
                </View>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.itemSubtitle}>
                No matching chats or members.
              </Text>
            }
            renderItem={({ item }) =>
              item.kind === "member" ? (
                <View style={styles.resultItem}>
                  <MonogramAvatar
                    monogram={item.member.monogram}
                    backgroundColor={
                      item.member.avatarColor || BrutalColors.accentYellow
                    }
                    size={28}
                    status={item.member.status}
                  />
                  <View style={styles.itemTextCol}>
                    <Text style={styles.itemTitle}>{item.member.name}</Text>
                    <Text style={styles.itemSubtitle}>
                      {item.member.handle}
                    </Text>
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onClose();
                    if (item.kind === "command") item.action();
                    else onSelectChannel(item.channel.id, item.channel.workspaceId);
                  }}
                  style={styles.resultItem}
                >
                  {item.kind === "command" ? (
                    <>
                      <AppIcon name={item.id === "settings" ? "settings" : "search"} size={23} />
                      <Text style={styles.itemTitle}>{item.title}</Text>
                    </>
                  ) : (
                    <>
                      <View style={styles.channelIconBadge}>
                        <AppIcon name={item.channel.type === "text" ? "chats" : item.channel.type === "audio" ? "call" : "video"} size={22} />
                      </View>
                      <View style={styles.itemTextCol}>
                        <Text style={styles.itemTitle}>
                          {item.channel.name}
                        </Text>
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {item.channel.topic}
                        </Text>
                      </View>
                    </>
                  )}
                </Pressable>
              )
            }
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(26, 26, 26, 0.7)",
      justifyContent: "center",
      padding: 16,
    },
    modal: {
      maxHeight: "80%",
      backgroundColor: BrutalColors.bgPaper,
      borderWidth: 1,
      borderColor: BrutalColors.border,
      borderRadius: 8,
      overflow: "hidden",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      gap: 10,
      backgroundColor: BrutalColors.bgCard,
      borderBottomWidth: 1,
      borderBottomColor: BrutalColors.border,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 8,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderWidth: 1,
      borderColor: BrutalColors.border,
      borderRadius: 10,
      backgroundColor: BrutalColors.bgCardAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    closeBtnText: {
      fontSize: 16,
      fontWeight: "900",
      color: BrutalColors.ink,
    },
    resultsList: {
      padding: 16,
      gap: 16,
    },
    sectionTitle: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 12,
      letterSpacing: 0.1,
      color: BrutalColors.inkSecondary,
    },
    resultItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: BrutalColors.bgCard,
      borderWidth: 1,
      borderColor: BrutalColors.border,
      borderRadius: 10,
      padding: 10,
    },
    channelIconBadge: {
      width: 26,
      height: 26,
      borderWidth: 1,
      borderColor: BrutalColors.border,
      borderRadius: 10,
      backgroundColor: BrutalColors.accentYellow,
      alignItems: "center",
      justifyContent: "center",
    },
    channelIconText: {
      fontFamily: Fonts.semibold,
      fontSize: 12,
      fontWeight: "400",
      color: "#1A1A1A",
    },
    itemTextCol: {
      flex: 1,
    },
    itemTitle: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 13,
      color: BrutalColors.ink,
    },
    itemSubtitle: {
      fontFamily: Fonts.sans,
      fontSize: 12,
      color: BrutalColors.inkMuted,
    },
  });
