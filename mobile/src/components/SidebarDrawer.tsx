/** The virtualized chat/people list; account navigation lives in the right drawer. */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fonts } from "@/constants/theme";
import {
  useBrutalStyles,
  useBrutalTheme,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import { Channel, User } from "@/types/chat";
import { api } from "@/services/api";
import { MonogramAvatar } from "./brutal/MonogramAvatar";
import { useDirectory } from "./useDirectory";
import { DirectoryControls } from "./DirectoryControls";
import { SearchField } from "./ui/SearchField";
import { NavigationMenuButton } from "./NavigationDrawer";
import { AppIcon } from "./ui/AppIcon";
import { MotionPressable as Pressable } from "./ui/MotionPressable";
import { UserAvatar } from "./ui/UserAvatar";

interface Props {
  currentUserId: string;
  activeChannelId: string;
  onSelectChannel: (id: string, workspaceId?: string) => void;
  showPeople: boolean;
  onOpenNavigation: () => void;
  onCreateChat: () => void;
  canCreateChat: boolean;
  onOpenCamera: () => void;
  cameraBusy: boolean;
}
type Row = { kind: "chat"; chat: Channel } | { kind: "person"; person: User };
const keyExtractor = (row: Row) =>
  row.kind === "chat" ? row.chat.id : row.person.id;
export function SidebarDrawer({
  currentUserId,
  activeChannelId,
  onSelectChannel,
  showPeople,
  onOpenNavigation,
  onCreateChat,
  canCreateChat,
  onOpenCamera,
  cameraBusy,
}: Props) {
  const styles = useBrutalStyles(createStyles);
  const colors = useBrutalTheme();
  const [pendingPerson, setPendingPerson] = useState("");
  const [personError, setPersonError] = useState("");
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const openPerson = useCallback(
    async (personId: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setPendingPerson(personId);
      setPersonError("");
      try {
        const channel = await api.createDirect(personId);
        if (alive.current) onSelectChannel(channel.id);
      } catch (failure) {
        if (alive.current)
          setPersonError(
            failure instanceof Error
              ? failure.message
              : "Couldn't open this chat. Try again.",
          );
      } finally {
        inFlight.current = false;
        if (alive.current) setPendingPerson("");
      }
    },
    [onSelectChannel],
  );
  const rooms = useDirectory(api.fetchChannelDirectory, !showPeople);
  const people = useDirectory(api.fetchTeamDirectory, showPeople);
  const directory = showPeople ? people : rooms;
  const reloadRooms = rooms.reload;
  const reloadPeople = people.reload;
  useEffect(() => {
    const timer = setInterval(() => {
      if (AppState.currentState !== "active") return;
      if (showPeople) reloadPeople();
      else reloadRooms();
    }, 30000);
    return () => clearInterval(timer);
  }, [reloadRooms, reloadPeople, showPeople]);
  const data: Row[] = showPeople
    ? (people.page?.data || []).map((person) => ({ kind: "person", person }))
    : (rooms.page?.data || []).map((chat) => ({ kind: "chat", chat }));
  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === "person") {
        const isSelf = item.person.id === currentUserId;
        const content = (
          <>
            <UserAvatar user={item.person} size={46} />
            <View style={styles.rowBody}>
              <Text style={styles.name} numberOfLines={1}>
                {item.person.name}
              </Text>
              <Text style={styles.preview} numberOfLines={2}>
                {pendingPerson === item.person.id
                  ? "Opening chat…"
                  : isSelf
                    ? "You"
                    : item.person.statusText || `@${item.person.handle}`}
              </Text>
            </View>
            {pendingPerson === item.person.id ? (
              <ActivityIndicator />
            ) : (
              !isSelf && (
                <AppIcon name="forward" color={colors.inkFaint} size={18} />
              )
            )}
          </>
        );
        return isSelf ? (
          <View style={styles.row}>{content}</View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Message ${item.person.name}`}
            disabled={Boolean(pendingPerson)}
            onPress={() => {
              void openPerson(item.person.id);
            }}
            style={({ pressed }) => [styles.row, pressed && styles.selectedRow]}
          >
            {content}
          </Pressable>
        );
      }
      const chat = item.chat;
      const selected = chat.id === activeChannelId;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected }}
          accessibilityLabel={`${chat.name}${chat.isPrivate ? ", private chat" : ""}${chat.unreadCount ? `, ${chat.unreadCount} unread` : ""}`}
          style={[styles.row, selected && styles.selectedRow]}
          onPress={() => {
            onSelectChannel(chat.id, chat.workspaceId);
          }}
        >
          {chat.peer ? (
            <UserAvatar user={chat.peer} size={46} />
          ) : (
            <MonogramAvatar
              monogram={chat.name.slice(0, 2).toUpperCase()}
              size={46}
              backgroundColor="#DCE5EF"
            />
          )}
          <View style={styles.rowBody}>
            <Text style={styles.name} numberOfLines={1}>
              {chat.name}
            </Text>
            <Text style={styles.preview} numberOfLines={2}>
              {chat.lastMessage?.text ||
                chat.topic ||
                `${chat.memberCount} ${chat.memberCount === 1 ? "person" : "people"}${chat.isPrivate ? " · Private chat" : " · Group chat"}`}
            </Text>
          </View>
          {!!chat.unreadCount && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{chat.unreadCount}</Text>
            </View>
          )}
        </Pressable>
      );
    },
    [
      activeChannelId,
      currentUserId,
      onSelectChannel,
      openPerson,
      pendingPerson,
      colors.inkFaint,
      styles,
    ],
  );
  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.heading}>
          {showPeople ? "People" : "Chats"}
        </Text>
        {!showPeople && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take a photo to send"
            accessibilityState={{ busy: cameraBusy }}
            disabled={cameraBusy}
            onPress={onOpenCamera}
            style={styles.iconButton}
          >
            {cameraBusy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <AppIcon name="camera" size={26} />
            )}
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New chat"
          disabled={!canCreateChat}
          onPress={onCreateChat}
          style={[styles.iconButton, !canCreateChat && { opacity: 0.4 }]}
        >
          <AppIcon name="compose" size={26} />
        </Pressable>
        <NavigationMenuButton onPress={onOpenNavigation} />
      </View>
      <View style={styles.search}>
        <SearchField
          accessibilityLabel={showPeople ? "Search people" : "Search chats"}
          placeholder={showPeople ? "Search people" : "Search chats"}
          value={directory.query}
          onChangeText={directory.search}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={120}
          style={styles.searchInput}
        />
      </View>
      {showPeople && personError ? (
        <Text accessibilityRole="alert" style={styles.personError}>
          {personError}
        </Text>
      ) : null}
      <FlatList<Row>
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={16}
        maxToRenderPerBatch={10}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <DirectoryControls
            label={showPeople ? "Search people" : "Search chats"}
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
            showSearch={false}
          />
        }
        ListEmptyComponent={
          !directory.loading && !directory.error ? (
            <Text style={styles.empty}>
              {showPeople
                ? "No people match your search."
                : "No conversations yet. Start one with the new chat button."}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}
const createStyles = (colors: BrutalPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgSidebar },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: 16,
      paddingBottom: 12,
      paddingLeft: 22,
      paddingRight: 12,
    },
    heading: {
      flex: 1,
      fontFamily: Fonts.sans,
      fontSize: 29,
      fontWeight: "400",
      letterSpacing: -0.8,
      color: colors.ink,
    },
    iconButton: {
      minWidth: 48,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    search: { paddingHorizontal: 18, paddingBottom: 4 },
    searchInput: {
      backgroundColor: colors.bgCardAlt,
      borderColor: colors.border,
      borderRadius: 11,
      minHeight: 44,
    },
    list: { paddingHorizontal: 10, paddingBottom: 16, flexGrow: 1 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      gap: 12,
      minHeight: 78,
      borderRadius: 11,
      marginBottom: 2,
    },
    selectedRow: { backgroundColor: colors.selection },
    rowBody: { flex: 1 },
    name: {
      color: colors.ink,
      fontFamily: Fonts.sans,
      fontSize: 18,
      lineHeight: 22,
    },
    preview: {
      marginTop: 4,
      color: colors.inkMuted,
      fontFamily: Fonts.sans,
      fontSize: 13,
      lineHeight: 19,
    },
    badge: {
      minWidth: 20,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 12,
      backgroundColor: colors.bubbleSent,
    },
    badgeText: { fontSize: 11, color: "#FFFFFF", fontFamily: Fonts.medium },
    personError: {
      color: colors.accentPink,
      paddingHorizontal: 22,
      paddingVertical: 10,
      fontFamily: Fonts.sans,
      fontSize: 14,
    },
    empty: {
      padding: 24,
      color: colors.inkMuted,
      fontFamily: Fonts.sans,
      fontSize: 14,
      lineHeight: 22,
    },
  });
