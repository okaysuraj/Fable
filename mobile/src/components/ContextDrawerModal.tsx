/** Room information, private membership changes and room administration stay in one native modal. */
import { AppIcon } from "./ui/AppIcon";
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Fonts } from "@/constants/theme";
import { Channel, User, ChannelMember } from "@/types/chat";
import { api, DirectoryOptions } from "@/services/api";
import { useDirectory } from "./useDirectory";
import { DirectoryControls } from "./DirectoryControls";
import { MonogramAvatar } from "./brutal/MonogramAvatar";
import { BrutalCard } from "./brutal/BrutalCard";
import { BrutalButton } from "./brutal/BrutalButton";
import { BrutalInput } from "./brutal/BrutalInput";

interface ContextDrawerModalProps {
  visible: boolean;
  onClose: () => void;
  channel: Channel;
  teamMembers: User[];
  currentUser: User;
  onMembershipChanged: (left: boolean) => Promise<void>;
}
type MemberRow =
  | { kind: "member"; member: ChannelMember }
  | { kind: "available"; member: User };
const keyExtractor = (item: MemberRow) => item.member.id;
export const ContextDrawerModal: React.FC<ContextDrawerModalProps> = ({
  visible,
  onClose,
  channel,
  currentUser,
  onMembershipChanged,
}) => {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const loadMembers = useCallback(
    (options: DirectoryOptions) => api.fetchChannelMembers(channel.id, options),
    [channel.id],
  );
  const loadCandidates = useCallback(
    (options: DirectoryOptions) =>
      api.fetchChannelCandidates(channel.id, options),
    [channel.id],
  );
  const roster = useDirectory<
    ChannelMember,
    Awaited<ReturnType<typeof api.fetchChannelMembers>>
  >(loadMembers);
  const canManage = roster.page?.canManageMembers ?? channel.canManageMembers;
  const candidates = useDirectory(
    loadCandidates,
    Boolean(channel.isPrivate && canManage),
  );
  const loading = roster.loading;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState<ChannelMember | null>(null);
  const [name, setName] = useState(channel.name);
  const [topic, setTopic] = useState(channel.topic || "");
  const [confirmName, setConfirmName] = useState("");
  const [confirmation, setConfirmation] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const inFlight = useRef(false);
  const reduceMotion = useReducedMotion();
  const performChannel = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      setConfirmation(null);
      roster.reload();
    } catch (failure: unknown) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The chat change could not be saved.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const perform = async (userId: string, remove: boolean) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    let confirmed = false;
    try {
      if (remove) await api.removeChannelMember(channel.id, userId);
      else await api.addChannelMember(channel.id, userId);
      confirmed = true;
      const left = remove && userId === currentUser.id;
      if (!left) {
        roster.reload();
        candidates.reload();
      }
      setRemoveTarget(null);
      await onMembershipChanged(left);
    } catch (failure: unknown) {
      setError(
        confirmed
          ? "Membership was updated, but the latest list could not be loaded. Retry members to refresh it."
          : failure instanceof Error
            ? failure.message
            : "Membership could not be updated.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const sections = useMemo(
    () => [
      {
        title: "Chat members",
        kind: "members",
        data: (roster.page?.data || []).map((member): MemberRow => ({
          kind: "member",
          member,
        })),
      },
      ...(channel.isPrivate && canManage
        ? [
            {
              title: "Add group member",
              kind: "candidates",
              data: (candidates.page?.data || []).map((member): MemberRow => ({
                kind: "available",
                member,
              })),
            },
          ]
        : []),
    ],
    [roster.page, candidates.page, channel.isPrivate, canManage],
  );
  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? "none" : "slide"}
      transparent
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={styles.modalOverlay}>
        <SafeAreaView style={[styles.modalContainer, { height: "85%" }]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Chat members</Text>
              <Text style={styles.channelName}>{channel.name}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close chat details"
              hitSlop={8}
              disabled={busy}
              onPress={onClose}
              style={styles.closeBtn}
            >
              <AppIcon name="close" size={24} />
            </Pressable>
          </View>
          <SectionList<MemberRow>
            sections={sections}
            keyExtractor={keyExtractor}
            initialNumToRender={16}
            maxToRenderPerBatch={10}
            windowSize={5}
            stickySectionHeadersEnabled={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollBody}
            ListHeaderComponent={
              <View style={{ gap: 16 }}>
                <BrutalCard style={styles.sectionCard}>
                  <Text style={styles.sectionHeading}>Topic & objective</Text>
                  <Text style={styles.topicText}>
                    {channel.topic || "No topic set."}
                  </Text>
                  <Text style={styles.topicText}>
                    {channel.isPrivate ? "Private chat" : "Public chat"} ·{" "}
                    {channel.memberCount} chat members
                  </Text>
                </BrutalCard>
                {channel.canManageChannel && (
                  <BrutalCard style={styles.sectionCard}>
                    <Text style={styles.sectionHeading}>Chat settings</Text>
                    <BrutalInput
                      accessibilityLabel="Chat name"
                      value={name}
                      onChangeText={setName}
                      editable={!busy}
                      maxLength={80}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <BrutalInput
                      accessibilityLabel="Chat topic"
                      value={topic}
                      onChangeText={setTopic}
                      editable={!busy}
                      maxLength={500}
                    />
                    <BrutalButton
                      title="Save chat details"
                      disabled={
                        busy ||
                        !name.trim() ||
                        (name.trim() === channel.name &&
                          topic.trim() === channel.topic)
                      }
                      onPress={() => {
                        void performChannel(async () => {
                          await api.updateChannel(channel.id, {
                            name: name.trim(),
                            topic: topic.trim(),
                          });
                          await onMembershipChanged(false);
                        });
                      }}
                    />
                    <Text style={styles.topicText}>
                      Delete this chat and its messages permanently. Enter its
                      name to confirm.
                    </Text>
                    <BrutalInput
                      accessibilityLabel="Chat name to confirm deletion"
                      placeholder={channel.name}
                      value={confirmName}
                      onChangeText={setConfirmName}
                      editable={!busy}
                      maxLength={80}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <BrutalButton
                      title="Delete chat"
                      variant="outline"
                      disabled={busy || confirmName !== channel.name}
                      onPress={() =>
                        setConfirmation({
                          title: "Permanently delete chat?",
                          description: `All messages, pins and reactions in ${channel.name} will be deleted. This cannot be undone.`,
                          action: async () => {
                            await api.deleteChannel(channel.id, confirmName);
                            await onMembershipChanged(true);
                          },
                        })
                      }
                    />
                  </BrutalCard>
                )}
                {confirmation && (
                  <BrutalCard style={styles.sectionCard}>
                    <Text style={styles.memberName}>{confirmation.title}</Text>
                    <Text accessibilityRole="alert" style={styles.topicText}>
                      {confirmation.description}
                    </Text>
                    <BrutalButton
                      title="Confirm"
                      variant="pink"
                      disabled={busy}
                      onPress={() => {
                        void performChannel(confirmation.action);
                      }}
                    />
                    <BrutalButton
                      title="Cancel"
                      variant="outline"
                      disabled={busy}
                      onPress={() => setConfirmation(null)}
                    />
                  </BrutalCard>
                )}
                {error ? (
                  <View style={{ gap: 12 }}>
                    <Text accessibilityRole="alert" style={styles.topicText}>
                      {error}
                    </Text>
                    <BrutalButton
                      title="Retry members"
                      size="sm"
                      disabled={busy}
                      variant="outline"
                      onPress={() => {
                        setError("");
                        roster.reload();
                      }}
                    />
                  </View>
                ) : null}
                {removeTarget && (
                  <BrutalCard style={styles.sectionCard}>
                    <Text style={styles.memberName}>{removeTarget.name}</Text>
                    <Text accessibilityRole="alert" style={styles.topicText}>
                      {removeTarget.id === currentUser.id
                        ? "Leave this private chat? You will lose access to its messages."
                        : "Remove this member from the private chat?"}
                    </Text>
                    <BrutalButton
                      title={
                        removeTarget.id === currentUser.id
                          ? "Leave chat"
                          : "Remove member"
                      }
                      variant="pink"
                      disabled={busy}
                      onPress={() => {
                        void perform(removeTarget.id, true);
                      }}
                    />
                    <BrutalButton
                      title="Cancel"
                      variant="outline"
                      disabled={busy}
                      onPress={() => setRemoveTarget(null)}
                    />
                  </BrutalCard>
                )}
                {loading ? (
                  <ActivityIndicator color={BrutalColors.ink} />
                ) : null}
              </View>
            }
            renderSectionHeader={({ section }) => {
              const directory =
                section.kind === "members" ? roster : candidates;
              return (
                <View>
                  <Text style={styles.sectionHeading}>{section.title}</Text>
                  <DirectoryControls
                    label={
                      section.kind === "members"
                        ? "Search members"
                        : "Search group members"
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
            renderItem={({ item }) => (
              <View style={[styles.memberRow, { flexWrap: "wrap" }]}>
                <MonogramAvatar
                  monogram={item.member.monogram}
                  backgroundColor={
                    item.member.avatarColor || BrutalColors.accentYellow
                  }
                  size={36}
                  status={item.member.status}
                />
                <View style={styles.memberTextCol}>
                  <Text style={styles.memberName}>{item.member.name}</Text>
                  <Text style={styles.memberRole}>{item.member.handle}</Text>
                  <Text style={styles.memberRole}>
                    {item.kind === "member"
                      ? `${item.member.channelRole} · ${item.member.workspaceRole}`
                      : item.member.role}
                  </Text>
                </View>
                {item.kind === "available" ? (
                  <BrutalButton
                    title="Add member"
                    size="sm"
                    disabled={busy || loading}
                    onPress={() => {
                      void perform(item.member.id, false);
                    }}
                  />
                ) : channel.isPrivate && item.member.canRemove ? (
                  <BrutalButton
                    title={
                      item.member.id === currentUser.id
                        ? "Leave chat"
                        : "Remove member"
                    }
                    size="sm"
                    variant="outline"
                    disabled={busy || loading}
                    onPress={() => setRemoveTarget(item.member)}
                  />
                ) : null}
                {item.kind === "member" &&
                  channel.canManageChannel &&
                  item.member.id !== channel.createdById && (
                    <BrutalButton
                      title="Transfer chat ownership"
                      size="sm"
                      variant="outline"
                      disabled={busy || loading}
                      onPress={() =>
                        setConfirmation({
                          title: "Transfer chat ownership?",
                          description: `${item.member.name} will become the chat owner. Group administrator permissions still apply.`,
                          action: async () => {
                            await api.transferChannelOwnership(
                              channel.id,
                              item.member.id,
                            );
                            await onMembershipChanged(false);
                          },
                        })
                      }
                    />
                  )}
              </View>
            )}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(26, 26, 26, 0.6)",
      justifyContent: "flex-end",
    },
    modalContainer: {
      maxHeight: "85%",
      backgroundColor: BrutalColors.bgPaper,
      borderTopWidth: 1,
      borderTopColor: BrutalColors.border,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: BrutalColors.border,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: BrutalColors.border,
      backgroundColor: BrutalColors.bgCard,
    },
    headerTitle: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 16,
      color: BrutalColors.ink,
      letterSpacing: 0.1,
    },
    channelName: {
      fontFamily: Fonts.semibold,
      fontSize: 12,
      fontWeight: "400",
      color: BrutalColors.inkMuted,
    },
    closeBtn: {
      width: 34,
      height: 34,
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
    scrollBody: {
      padding: 16,
      gap: 16,
    },
    sectionCard: {
      padding: 14,
      gap: 6,
    },
    sectionHeading: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 12,
      letterSpacing: 0.1,
      color: BrutalColors.inkSecondary,
    },
    topicText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "400",
      color: BrutalColors.ink,
    },
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: BrutalColors.bgCard,
      borderWidth: 1,
      borderColor: BrutalColors.border,
      borderRadius: 10,
      padding: 10,
    },
    memberTextCol: {
      flex: 1,
    },
    memberName: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 13,
      color: BrutalColors.ink,
    },
    memberRole: {
      fontFamily: Fonts.medium,
      fontSize: 12,
      fontWeight: "400",
      color: BrutalColors.inkMuted,
    },
  });
