/** Virtualized room/member pages keep native navigation bounded as the workspace grows. */
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import React, { useCallback, useMemo } from "react";
import { Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fonts } from "@/constants/theme";
import { Channel, User } from "@/types/chat";
import { MonogramAvatar } from "./brutal/MonogramAvatar";
import { api } from "@/services/api";
import { useDirectory } from "./useDirectory";
import { DirectoryControls } from "./DirectoryControls";

interface SidebarDrawerProps {
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  currentUser: User;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onLogout: () => void;
  onClose: () => void;
  onOpenWorkspace?: () => void;
  onOpenProfile: () => void;
}

type Row =
  { kind: "channel"; channel: Channel } | { kind: "member"; member: User };
const keyExtractor = (row: Row) =>
  row.kind === "channel"
    ? `channel:${row.channel.id}`
    : `member:${row.member.id}`;
export const SidebarDrawer: React.FC<SidebarDrawerProps> = ({
  activeChannelId,
  onSelectChannel,
  currentUser,
  onOpenSettings,
  onOpenSearch,
  onLogout,
  onClose,
  onOpenWorkspace,
  onOpenProfile,
}) => {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const rooms = useDirectory(api.fetchChannelDirectory);
  const people = useDirectory(api.fetchTeamDirectory);
  const sections = useMemo(
    () => [
      {
        title: "ROOMS & CHANNELS",
        kind: "rooms",
        data: (rooms.page?.data || []).map((channel): Row => ({
          kind: "channel",
          channel,
        })),
      },
      {
        title: "STUDIO TEAM",
        kind: "people",
        data: (people.page?.data || []).map((member): Row => ({
          kind: "member",
          member,
        })),
      },
    ],
    [rooms.page, people.page],
  );
  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === "member")
        return (
          <View style={styles.memberItem}>
            <MonogramAvatar
              monogram={item.member.monogram}
              status={item.member.status}
              size={32}
              backgroundColor={
                item.member.avatarColor || BrutalColors.accentYellow
              }
            />
            <View style={styles.memberInfo}>
              <Text style={styles.memberName} numberOfLines={1}>
                {item.member.name}
              </Text>
              <Text style={styles.memberRole} numberOfLines={1}>
                {item.member.statusText || item.member.role}
              </Text>
            </View>
          </View>
        );
      const channel = item.channel;
      const selected = channel.id === activeChannelId;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={`${channel.name}${channel.isPrivate ? ", private" : ""}${channel.type !== "text" ? ", calls unavailable" : ""}`}
          onPress={() => {
            onSelectChannel(channel.id);
            onClose();
          }}
          style={[
            styles.channelItem,
            selected && styles.channelItemActive,
            { minHeight: 48 },
          ]}
        >
          <View
            style={[
              styles.channelIconBox,
              {
                backgroundColor:
                  channel.type === "audio"
                    ? BrutalColors.accentPink
                    : channel.type === "video"
                      ? BrutalColors.accentBlue
                      : BrutalColors.accentYellow,
              },
            ]}
          >
            <Text style={styles.channelIconText}>
              {channel.isPrivate
                ? "●"
                : channel.type === "text"
                  ? "#"
                  : channel.type === "audio"
                    ? "◉"
                    : "▶"}
            </Text>
          </View>
          <Text
            style={[styles.channelName, selected && styles.channelNameActive]}
            numberOfLines={1}
          >
            {channel.name}
          </Text>
          {channel.type !== "text" ? (
            <View style={styles.statusTag}>
              <Text style={styles.statusTagText}>UNAVAILABLE</Text>
            </View>
          ) : (channel.unreadCount ?? 0) > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{channel.unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      );
    },
    [activeChannelId, onSelectChannel, onClose, BrutalColors, styles],
  );
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brandingHeader}>
        <View style={styles.brandingLeft}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>F</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>FABLE</Text>
            <Text style={styles.brandSubtitle}>YOUR WORKSPACE</Text>
          </View>
        </View>
        <View style={styles.brandingRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search workspace"
            hitSlop={8}
            onPress={onOpenSearch}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>⌕</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close workspace menu"
            hitSlop={8}
            onPress={onClose}
            style={styles.iconBtn}
          >
            <Text style={styles.iconBtnText}>✕</Text>
          </Pressable>
        </View>
      </View>
      <SectionList<Row>
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        stickySectionHeadersEnabled={false}
        initialNumToRender={16}
        maxToRenderPerBatch={10}
        windowSize={5}
        contentContainerStyle={styles.scrollList}
        ListHeaderComponent={
          <View>
            {onOpenWorkspace && (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenWorkspace}
                style={styles.searchBar}
              >
                <Text style={styles.searchBarText}>
                  WORKSPACES, CHANNELS & INVITATIONS
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Search channels and members"
              onPress={onOpenSearch}
              style={styles.searchBar}
            >
              <Text style={styles.searchBarText}>SEARCH CHANNELS & TEAM</Text>
            </Pressable>
          </View>
        }
        renderSectionHeader={({ section }) => {
          const directory = section.kind === "rooms" ? rooms : people;
          return (
            <View>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                {section.title}
              </Text>
              <DirectoryControls
                label={
                  section.kind === "rooms" ? "Search rooms" : "Search members"
                }
                query={directory.query}
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
      />
      <View style={styles.userFooter}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPress={onOpenProfile}
          style={styles.userMeta}
        >
          <MonogramAvatar
            monogram={currentUser.monogram}
            size={36}
            backgroundColor={
              currentUser.avatarColor || BrutalColors.accentYellow
            }
            status={currentUser.status}
          />
          <View style={styles.userTextCol}>
            <Text style={styles.userName} numberOfLines={1}>
              {currentUser.name}
            </Text>
            <Text style={styles.userHandle} numberOfLines={1}>
              {currentUser.handle}
            </Text>
          </View>
        </Pressable>
        <View style={styles.footerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open preferences"
            hitSlop={6}
            onPress={onOpenSettings}
            style={styles.controlBtn}
          >
            <Text style={styles.controlIcon}>⚙</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Log out"
            hitSlop={6}
            onPress={onLogout}
            style={[styles.controlBtn, { backgroundColor: "#FFE0E9" }]}
          >
            <Text style={styles.controlIcon}>⇥</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: BrutalColors.bgSidebar,
      borderRightWidth: 3,
      borderRightColor: BrutalColors.border,
    },
    brandingHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 3,
      borderBottomColor: BrutalColors.border,
      backgroundColor: BrutalColors.bgCard,
    },
    brandingLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    brandBadge: {
      width: 36,
      height: 36,
      backgroundColor: BrutalColors.accentYellow,
      borderWidth: 2.5,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    brandBadgeText: {
      fontFamily: Fonts?.sans,
      fontWeight: "900",
      fontSize: 20,
      color: "#1A1A1A",
    },
    brandTitle: {
      fontFamily: Fonts?.sans,
      fontWeight: "900",
      fontSize: 18,
      color: BrutalColors.ink,
      letterSpacing: -0.3,
    },
    brandSubtitle: {
      fontFamily: Fonts?.mono,
      fontSize: 9,
      fontWeight: "800",
      color: BrutalColors.inkMuted,
      letterSpacing: 1,
    },
    brandingRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderWidth: 2,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      backgroundColor: BrutalColors.bgCard,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtnText: {
      color: BrutalColors.ink,
      fontSize: 14,
      fontWeight: "800",
    },
    scrollList: {
      padding: 16,
      gap: 20,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: 2,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      backgroundColor: BrutalColors.bgCard,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    searchBarText: {
      fontFamily: Fonts?.mono,
      fontSize: 11,
      fontWeight: "700",
      color: BrutalColors.inkMuted,
    },
    sectionTitle: {
      fontFamily: Fonts?.sans,
      fontWeight: "900",
      fontSize: 11,
      letterSpacing: 0.8,
      color: BrutalColors.inkSecondary,
    },
    channelItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 4,
    },
    channelItemActive: {
      backgroundColor: BrutalColors.bgCard,
      borderWidth: 2,
      borderColor: BrutalColors.border,
    },
    channelIconBox: {
      width: 24,
      height: 24,
      borderWidth: 2,
      borderColor: BrutalColors.border,
      borderRadius: 3,
      alignItems: "center",
      justifyContent: "center",
    },
    channelIconText: {
      fontFamily: Fonts?.mono,
      fontWeight: "900",
      fontSize: 12,
      color: "#1A1A1A",
    },
    channelName: {
      flex: 1,
      fontFamily: Fonts?.sans,
      fontWeight: "700",
      fontSize: 14,
      color: BrutalColors.inkSecondary,
    },
    channelNameActive: {
      color: BrutalColors.ink,
      fontWeight: "900",
    },
    unreadBadge: {
      backgroundColor: BrutalColors.accentYellow,
      borderWidth: 1.5,
      borderColor: BrutalColors.border,
      borderRadius: 3,
      paddingHorizontal: 6,
      paddingVertical: 1,
    },
    unreadText: {
      fontFamily: Fonts?.mono,
      fontSize: 10,
      fontWeight: "800",
      color: "#1A1A1A",
    },
    statusTag: {
      borderWidth: 1.5,
      borderColor: BrutalColors.border,
      borderRadius: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    statusTagText: {
      fontFamily: Fonts?.mono,
      fontSize: 9,
      fontWeight: "800",
      color: BrutalColors.inkSecondary,
    },
    memberItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
      paddingHorizontal: 10,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontFamily: Fonts?.sans,
      fontWeight: "800",
      fontSize: 13,
      color: BrutalColors.ink,
    },
    memberRole: {
      fontFamily: Fonts?.sans,
      fontSize: 11,
      fontWeight: "500",
      color: BrutalColors.inkMuted,
    },
    userFooter: {
      borderTopWidth: 3,
      borderTopColor: BrutalColors.border,
      backgroundColor: BrutalColors.bgCard,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    userMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      flex: 1,
    },
    userTextCol: {
      flex: 1,
    },
    userName: {
      fontFamily: Fonts?.sans,
      fontWeight: "900",
      fontSize: 13,
      color: BrutalColors.ink,
    },
    userHandle: {
      fontFamily: Fonts?.mono,
      fontSize: 10,
      fontWeight: "700",
      color: BrutalColors.inkMuted,
    },
    footerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    controlBtn: {
      width: 32,
      height: 32,
      borderWidth: 2,
      borderColor: BrutalColors.border,
      borderRadius: 4,
      backgroundColor: BrutalColors.bgCardAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    controlIcon: {
      color: BrutalColors.ink,
      fontSize: 13,
    },
  });
