import { useEffect, useRef, useState } from "react";
import {
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
import { api } from "@/services/api";
import type { User } from "@/types/chat";
import { useDirectory } from "../useDirectory";
import { DirectoryControls } from "../DirectoryControls";
import { NavigationMenuButton } from "../NavigationDrawer";
import { NavigationIcon } from "../BottomTabs";
import { MotionPressable as Pressable } from "../ui/MotionPressable";
import { SearchField } from "../ui/SearchField";
import { MonogramAvatar } from "../brutal/MonogramAvatar";
import { useCalling } from "./CallingProvider";

/** Call authorized people through the existing direct-conversation and WebRTC flow. */
export function CallsView({
  currentUserId,
  onOpenNavigation,
  onManageGroups,
}: {
  currentUserId: string;
  onOpenNavigation: () => void;
  onManageGroups: () => void;
}) {
  const colors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const directory = useDirectory(api.fetchTeamDirectory);
  const calling = useCalling();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const startCall = async (person: User, kind: "audio" | "video") => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(person.id);
    setError("");
    try {
      const channel = await api.createDirect(person.id);
      if (alive.current) calling.start(channel.id, kind, person.name);
    } catch (failure) {
      if (alive.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "Couldn't start this call. Try again.",
        );
    } finally {
      inFlight.current = false;
      if (alive.current) setPending("");
    }
  };
  const people = (directory.page?.data || []).filter(
    (person) => person.id !== currentUserId,
  );
  return (
    <SafeAreaView edges={["left", "right"]} style={styles.container}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.heading}>
          Calls
        </Text>
        <NavigationMenuButton onPress={onOpenNavigation} />
      </View>
      <View style={styles.search}>
        <SearchField
          accessibilityLabel="Find someone to call"
          placeholder="Search people"
          value={directory.query}
          onChangeText={directory.search}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={120}
          style={styles.searchInput}
        />
      </View>
      <Text style={styles.sectionTitle}>Call someone</Text>
      <Text style={styles.description}>
        Voice or video, with people in your group.
      </Text>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <FlatList<User>
        data={people}
        keyExtractor={(person) => person.id}
        initialNumToRender={16}
        maxToRenderPerBatch={10}
        windowSize={5}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <DirectoryControls
            label="Find someone to call"
            query={directory.query}
            onSearch={directory.search}
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
        renderItem={({ item }) => (
          <View style={styles.row}>
            <MonogramAvatar
              monogram={item.monogram}
              backgroundColor={item.avatarColor}
              size={44}
            />
            <View style={styles.person}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.detail} numberOfLines={1}>
                {pending === item.id
                  ? "Preparing call…"
                  : item.statusText || `@${item.handle}`}
              </Text>
            </View>
            {pending === item.id ? (
              <View style={styles.pending}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Audio call ${item.name}`}
                  disabled={Boolean(pending)}
                  onPress={() => {
                    void startCall(item, "audio");
                  }}
                  style={({ pressed }) => [
                    styles.callButton,
                    pressed && styles.pressed,
                    Boolean(pending) && styles.disabled,
                  ]}
                >
                  <NavigationIcon name="calls" color={colors.primary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Video call ${item.name}`}
                  disabled={Boolean(pending)}
                  onPress={() => {
                    void startCall(item, "video");
                  }}
                  style={({ pressed }) => [
                    styles.callButton,
                    pressed && styles.pressed,
                    Boolean(pending) && styles.disabled,
                  ]}
                >
                  <NavigationIcon name="video" color={colors.primary} />
                </Pressable>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          !directory.loading && !directory.error ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <NavigationIcon name="calls" color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>
                {directory.query
                  ? "No matching people"
                  : "Bring someone into the conversation"}
              </Text>
              <Text style={styles.emptyText}>
                {directory.query
                  ? "Try another name."
                  : directory.page?.hasMore || directory.canPrevious
                    ? "Browse the other pages to find someone to call."
                    : "Invite someone to your group to start a voice or video call."}
              </Text>
              {!directory.query &&
                !directory.page?.hasMore &&
                !directory.canPrevious && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={onManageGroups}
                    style={styles.inviteButton}
                  >
                    <Text style={styles.inviteText}>Manage groups</Text>
                  </Pressable>
                )}
            </View>
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
      paddingLeft: 22,
      paddingRight: 12,
      paddingTop: 16,
      paddingBottom: 12,
    },
    heading: {
      flex: 1,
      fontFamily: Fonts.sans,
      fontSize: 29,
      letterSpacing: -0.8,
      color: colors.ink,
    },
    search: { paddingHorizontal: 18, paddingBottom: 12 },
    searchInput: {
      borderRadius: 11,
      minHeight: 44,
      backgroundColor: colors.bgCardAlt,
      borderColor: colors.border,
    },
    sectionTitle: {
      fontFamily: Fonts.medium,
      fontSize: 17,
      color: colors.ink,
      paddingHorizontal: 22,
      marginTop: 8,
    },
    description: {
      color: colors.inkMuted,
      fontFamily: Fonts.sans,
      fontSize: 13,
      lineHeight: 19,
      paddingHorizontal: 22,
      marginTop: 5,
    },
    list: { paddingHorizontal: 12, paddingBottom: 20, flexGrow: 1 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 78,
      gap: 10,
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    person: { flex: 1, minWidth: 0 },
    name: { fontFamily: Fonts.medium, color: colors.ink, fontSize: 16 },
    detail: {
      fontFamily: Fonts.sans,
      fontSize: 12,
      color: colors.inkMuted,
      marginTop: 5,
    },
    actions: { flexDirection: "row", gap: 2 },
    callButton: {
      width: 44,
      height: 48,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 12,
    },
    pending: { width: 90, alignItems: "center" },
    pressed: { backgroundColor: colors.selection },
    disabled: { opacity: 0.4 },
    error: {
      color: colors.accentPink,
      fontSize: 14,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      gap: 12,
      minHeight: 260,
    },
    emptyIcon: {
      width: 64,
      height: 64,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.selection,
      borderRadius: 22,
      marginBottom: 4,
    },
    emptyTitle: {
      fontFamily: Fonts.medium,
      fontSize: 19,
      color: colors.ink,
      textAlign: "center",
    },
    emptyText: {
      fontFamily: Fonts.sans,
      fontSize: 14,
      lineHeight: 21,
      color: colors.inkMuted,
      textAlign: "center",
      maxWidth: 280,
    },
    inviteButton: {
      backgroundColor: colors.primary,
      minHeight: 46,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      marginTop: 6,
    },
    inviteText: {
      color: colors.onPrimary,
      fontFamily: Fonts.medium,
      fontSize: 15,
    },
  });
