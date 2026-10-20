/** Native workspace administration keeps invitations and role changes tied to server results. */
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SectionList,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import {
  api,
  Workspace,
  WorkspaceInvitation,
  WorkspaceAuditEvent,
} from "@/services/api";
import type { User } from "@/types/chat";
import { Fonts } from "@/constants/theme";
import { BrutalButton } from "./brutal/BrutalButton";
import { BrutalInput } from "./brutal/BrutalInput";
import { useDirectory } from "./useDirectory";
import { DirectoryControls } from "./DirectoryControls";

interface Props {
  onClose: () => void;
  onChanged: (channelId?: string) => void;
  currentUser: User;
}
type Row =
  | { kind: "workspace"; workspace: Workspace }
  | { kind: "member"; member: User }
  | { kind: "invitation"; invitation: WorkspaceInvitation }
  | { kind: "audit"; event: WorkspaceAuditEvent };
type Confirmation = {
  title: string;
  description: string;
  action: () => Promise<void>;
};
export function WorkspaceManagerModal({
  onClose,
  onChanged,
  currentUser,
}: Props) {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const workspaces = useDirectory(api.fetchWorkspaces);
  const [selected, setSelected] = useState<Workspace | null>(null);
  const canManage = selected?.role === "owner" || selected?.role === "admin";
  const members = useDirectory(api.fetchTeamDirectory, Boolean(selected));
  const invitations = useDirectory(api.fetchInvitations, canManage);
  const activity = useDirectory(api.fetchWorkspaceAudit, canManage);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [invitation, setInvitation] = useState<{
    token: string;
    email: string;
    expiresAt: string;
  } | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    const load = async () => {
      const id =
        api.getSelectedWorkspaceId() ||
        (await api.fetchWorkspaces({ limit: 1, signal: controller.signal }))
          .currentWorkspaceId;
      if (!id) return;
      const workspace = await api.fetchWorkspace(id, {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setSelected(workspace);
        setWorkspaceName(workspace.name);
      }
    };
    load()
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Unable to load groups.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, []);
  const perform = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
      if (mounted.current) {
        setConfirmation(null);
        activity.reload();
      }
    } catch (failure: unknown) {
      if (mounted.current)
        setError(
          failure instanceof Error
            ? failure.message
            : "The change could not be saved.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const sections = useMemo(
    () => [
      {
        title: "Your groups",
        kind: "workspaces",
        data: (workspaces.page?.data || []).map((workspace): Row => ({
          kind: "workspace",
          workspace,
        })),
      },
      {
        title: "Group members",
        kind: "members",
        data: (members.page?.data || []).map((member): Row => ({
          kind: "member",
          member,
        })),
      },
      ...(canManage
        ? [
            {
              title: "Invitations",
              kind: "invitations",
              data: (invitations.page?.data || []).map((entry): Row => ({
                kind: "invitation",
                invitation: entry,
              })),
            },
          ]
        : []),
      ...(canManage
        ? [
            {
              title: "Group activity",
              kind: "audit",
              data: (activity.page?.data || []).map((event): Row => ({
                kind: "audit",
                event,
              })),
            },
          ]
        : []),
    ],
    [workspaces.page, members.page, invitations.page, activity.page, canManage],
  );
  const switchWorkspace = async (workspace: Workspace) => {
    await api.selectWorkspace(workspace.id);
    onChanged();
    onClose();
  };
  return (
    <Modal
      visible
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Group</Text>
            <BrutalButton
              title="Close"
              size="sm"
              variant="outline"
              disabled={busy}
              onPress={onClose}
            />
          </View>
          <SectionList<Row>
            sections={loading ? [] : sections}
            keyExtractor={(row) =>
              row.kind === "workspace"
                ? `workspace:${row.workspace.id}`
                : row.kind === "member"
                  ? `member:${row.member.id}`
                  : row.kind === "audit"
                    ? `audit:${row.event.id}`
                    : `invitation:${row.invitation.id}`
            }
            contentContainerStyle={styles.body}
            stickySectionHeadersEnabled={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={12}
            maxToRenderPerBatch={8}
            windowSize={5}
            ListHeaderComponent={
              <View style={styles.stack}>
                {error ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {error}
                  </Text>
                ) : null}
                {loading ? (
                  <ActivityIndicator color={BrutalColors.ink} />
                ) : null}
                {confirmation && (
                  <View style={styles.workspace}>
                    <Text style={styles.heading}>{confirmation.title}</Text>
                    <Text style={styles.copy}>{confirmation.description}</Text>
                    <BrutalButton
                      title="Confirm"
                      variant="pink"
                      disabled={busy}
                      onPress={() => {
                        void perform(confirmation.action);
                      }}
                    />
                    <BrutalButton
                      title="Cancel"
                      variant="outline"
                      disabled={busy}
                      onPress={() => setConfirmation(null)}
                    />
                  </View>
                )}
                {selected && (
                  <View style={styles.workspace}>
                    <Text style={styles.heading}>{selected.name}</Text>
                    <Text style={styles.copy}>Your role: {selected.role}</Text>
                    {canManage && (
                      <>
                        <BrutalInput
                          accessibilityLabel="Group name"
                          maxLength={80}
                          editable={!busy}
                          value={workspaceName}
                          onChangeText={setWorkspaceName}
                        />
                        <BrutalButton
                          title="Rename group"
                          variant="outline"
                          disabled={
                            busy ||
                            !workspaceName.trim() ||
                            workspaceName.trim() === selected.name
                          }
                          onPress={() => {
                            void perform(async () => {
                              const saved = await api.renameWorkspace(
                                selected.id,
                                workspaceName.trim(),
                              );
                              setSelected(saved);
                              workspaces.reload();
                              onChanged();
                            });
                          }}
                        />
                      </>
                    )}
                    {selected.role !== "owner" ? (
                      <BrutalButton
                        title="Leave group"
                        variant="outline"
                        disabled={busy}
                        onPress={() =>
                          setConfirmation({
                            title: "Leave group?",
                            description:
                              "You will lose access to its chats and messages. You will need a new invitation to return.",
                            action: async () => {
                              await api.leaveWorkspace(selected.id);
                              await api.selectWorkspace(null);
                              onChanged();
                              onClose();
                            },
                          })
                        }
                      />
                    ) : (
                      <Text style={styles.copy}>
                        Transfer ownership to a member before leaving.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            }
            renderSectionHeader={({ section }) => {
              const directory =
                section.kind === "workspaces"
                  ? workspaces
                  : section.kind === "members"
                    ? members
                    : section.kind === "audit"
                      ? activity
                      : invitations;
              const label =
                section.kind === "workspaces"
                  ? "Search groups"
                  : section.kind === "members"
                    ? "Search group members"
                    : section.kind === "audit"
                      ? "Group activity"
                      : "Search invitations";
              return (
                <View>
                  <Text style={styles.heading}>{section.title}</Text>
                  <DirectoryControls
                    showSearch={section.kind !== "audit"}
                    label={label}
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
            renderItem={({ item }) => {
              if (item.kind === "audit")
                return (
                  <View style={styles.workspace}>
                    <Text style={styles.label}>{item.event.action}</Text>
                    <Text style={styles.copy}>
                      {new Date(item.event.createdAt).toLocaleString()}
                    </Text>
                    <Text selectable style={styles.copy}>
                      Actor: {item.event.actorId}
                    </Text>
                    {item.event.targetId ? (
                      <Text selectable style={styles.copy}>
                        Target: {item.event.targetId}
                      </Text>
                    ) : null}
                  </View>
                );
              if (item.kind === "workspace")
                return (
                  <View style={styles.workspace}>
                    <Text style={styles.label}>
                      {item.workspace.name} · {item.workspace.role}
                    </Text>
                    <BrutalButton
                      title={
                        item.workspace.id === selected?.id
                          ? "Current group"
                          : "Switch group"
                      }
                      variant="outline"
                      disabled={busy || item.workspace.id === selected?.id}
                      onPress={() => {
                        void perform(() => switchWorkspace(item.workspace));
                      }}
                    />
                  </View>
                );
              if (item.kind === "invitation")
                return (
                  <View style={styles.workspace}>
                    <Text style={styles.label}>{item.invitation.email}</Text>
                    <Text style={styles.copy}>
                      {item.invitation.status} · Expires{" "}
                      {new Date(item.invitation.expiresAt).toLocaleString()}
                    </Text>
                    {item.invitation.status !== "accepted" && (
                      <BrutalButton
                        title="Revoke invitation"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onPress={() =>
                          setConfirmation({
                            title: "Revoke invitation?",
                            description: `${item.invitation.email} will no longer be able to use this invitation.`,
                            action: async () => {
                              await api.revokeInvitation(item.invitation.id);
                              setInvitation(null);
                              invitations.reload();
                            },
                          })
                        }
                      />
                    )}
                  </View>
                );
              const member = item.member;
              const role = member.workspaceRole;
              const isOther = member.id !== currentUser.id;
              return (
                <View style={styles.workspace}>
                  <Text style={styles.label}>
                    {member.name}
                    {!isOther ? " (you)" : ""}
                  </Text>
                  <Text style={styles.copy}>
                    {member.handle} · {role || member.role}
                  </Text>
                  {selected?.role === "owner" &&
                    isOther &&
                    role !== "owner" && (
                      <>
                        <BrutalButton
                          title={
                            role === "admin"
                              ? "Make member"
                              : "Make administrator"
                          }
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onPress={() =>
                            setConfirmation({
                              title: "Change member role?",
                              description:
                                role === "admin"
                                  ? "This member will lose group administration privileges."
                                  : "This member will gain group administration privileges.",
                              action: async () => {
                                await api.updateWorkspaceMember(
                                  selected.id,
                                  member.id,
                                  role === "admin" ? "member" : "admin",
                                );
                                members.reload();
                              },
                            })
                          }
                        />
                        <BrutalButton
                          title="Transfer ownership"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onPress={() =>
                            setConfirmation({
                              title: "Transfer group ownership?",
                              description: `${member.name} will become the owner. You will become an administrator.`,
                              action: async () => {
                                const saved =
                                  await api.transferWorkspaceOwnership(
                                    selected.id,
                                    member.id,
                                  );
                                setSelected(saved);
                                members.reload();
                                workspaces.reload();
                                onChanged();
                              },
                            })
                          }
                        />
                      </>
                    )}
                  {selected &&
                    isOther &&
                    role !== "owner" &&
                    (selected.role === "owner" ||
                      (selected.role === "admin" && role === "member")) && (
                      <BrutalButton
                        title="Remove from group"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onPress={() =>
                          setConfirmation({
                            title: "Remove group member?",
                            description: `${member.name} will lose access to all group chats and messages.`,
                            action: async () => {
                              await api.removeWorkspaceMember(
                                selected.id,
                                member.id,
                              );
                              members.reload();
                              onChanged();
                            },
                          })
                        }
                      />
                    )}
                </View>
              );
            }}
            ListFooterComponent={
              <View style={styles.stack}>
                <Text style={styles.heading}>Create a group</Text>
                <BrutalInput
                  accessibilityLabel="New group name"
                  placeholder="Group name"
                  maxLength={80}
                  editable={!busy}
                  value={newWorkspaceName}
                  onChangeText={setNewWorkspaceName}
                />
                <BrutalButton
                  title="Create group"
                  disabled={busy || !newWorkspaceName.trim()}
                  onPress={() => {
                    void perform(async () => {
                      const created = await api.createWorkspace(
                        newWorkspaceName.trim(),
                      );
                      await switchWorkspace(created);
                    });
                  }}
                />
                {selected && (
                  <>
                    <Text style={styles.heading}>Create a text chat</Text>
                    <BrutalInput
                      accessibilityLabel="Chat name"
                      placeholder="Chat name"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={80}
                      editable={!busy}
                      value={name}
                      onChangeText={setName}
                    />
                    <BrutalInput
                      accessibilityLabel="Chat topic"
                      placeholder="Topic (optional)"
                      maxLength={500}
                      editable={!busy}
                      value={topic}
                      onChangeText={setTopic}
                    />
                    <View style={styles.row}>
                      <Text style={styles.label}>Private chat</Text>
                      <Switch
                        accessibilityLabel="Private chat"
                        disabled={busy}
                        value={isPrivate}
                        onValueChange={setIsPrivate}
                      />
                    </View>
                    <BrutalButton
                      title="New chat"
                      disabled={busy || !name.trim()}
                      onPress={() => {
                        void perform(async () => {
                          const channel = await api.createChannel({
                            name: name.trim(),
                            topic: topic.trim(),
                            type: "text",
                            isPrivate,
                          });
                          onChanged(channel.id);
                          onClose();
                        });
                      }}
                    />
                  </>
                )}
                {canManage && (
                  <>
                    <Text style={styles.heading}>Invite a teammate</Text>
                    <BrutalInput
                      accessibilityLabel="Invitation email"
                      placeholder="Teammate email"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={254}
                      editable={!busy}
                      value={email}
                      onChangeText={setEmail}
                    />
                    <BrutalButton
                      title="Create invitation"
                      disabled={busy || !email.trim()}
                      onPress={() => {
                        void perform(async () => {
                          const result = await api.invite(email.trim());
                          setInvitation(result.data);
                          invitations.reload();
                        });
                      }}
                    />
                    {invitation && (
                      <View style={styles.workspace}>
                        <Text style={styles.copy}>
                          Share this invitation with {invitation.email}. It
                          expires{" "}
                          {new Date(invitation.expiresAt).toLocaleString()}.
                        </Text>
                        <Text selectable style={styles.token}>
                          {invitation.token}
                        </Text>
                        <BrutalButton
                          title="Share invitation"
                          variant="outline"
                          disabled={busy}
                          onPress={() => {
                            void perform(async () => {
                              await Share.share({
                                message: `Join my Fable group. Sign in with ${invitation.email}, open Group, then paste this invitation token: ${invitation.token}`,
                              });
                            });
                          }}
                        />
                      </View>
                    )}
                  </>
                )}
                <Text style={styles.heading}>Join a group</Text>
                <BrutalInput
                  accessibilityLabel="Invitation token"
                  placeholder="Paste invitation token"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={512}
                  editable={!busy}
                  value={token}
                  onChangeText={setToken}
                />
                <BrutalButton
                  title="Join group"
                  disabled={busy || !token.trim()}
                  onPress={() => {
                    void perform(async () => {
                      const result = await api.joinWorkspace(token.trim());
                      await api.selectWorkspace(result.data.workspaceId);
                      onChanged();
                      onClose();
                    });
                  }}
                />
              </View>
            }
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: BrutalColors.bgPaper },
    header: {
      padding: 16,
      borderBottomWidth: 1,
      borderColor: BrutalColors.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    title: {
      fontFamily: Fonts.display,
      fontWeight: "400",
      fontSize: 22,
      color: BrutalColors.ink,
    },
    body: { padding: 20, gap: 16 },
    stack: { gap: 16 },
    heading: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 16,
      marginTop: 16,
      color: BrutalColors.ink,
    },
    label: {
      fontFamily: Fonts.semibold,
      fontWeight: "400",
      fontSize: 14,
      color: BrutalColors.ink,
    },
    copy: {
      fontFamily: Fonts.sans,
      fontSize: 14,
      color: BrutalColors.inkSecondary,
      lineHeight: 21,
    },
    workspace: {
      padding: 14,
      borderWidth: 1,
      borderColor: BrutalColors.border,
      gap: 12,
      backgroundColor: BrutalColors.bgCard,
    },
    row: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 12,
    },
    token: { fontFamily: Fonts.mono, fontSize: 13, color: BrutalColors.ink },
    error: {
      padding: 14,
      backgroundColor: BrutalColors.dangerSurface,
      color: BrutalColors.accentPink,
    },
  });
