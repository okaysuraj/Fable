/** Compose native workspace screens and appearance; useChannelMessages owns conversation state. */
import { useChannelMessages } from "./chat/useChannelMessages";
import { mergeTeamProfiles } from "./chat/messageState";
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";
import { Fonts } from "@/constants/theme";
import { User, WorkspaceSettings, ThemeMode } from "@/types/chat";
import { BrutalThemeProvider } from "@/hooks/use-brutal-theme";
import { api, ApiError } from "@/services/api";
import { MobileChatView } from "./chat/MobileChatView";
import { SidebarDrawer } from "./SidebarDrawer";
import { ContextDrawerModal } from "./ContextDrawerModal";
import { SettingsModalView } from "./SettingsModalView";
import { CommandPaletteModal } from "./CommandPaletteModal";
import { BrutalButton } from "./brutal/BrutalButton";
import { WorkspaceManagerModal } from "./WorkspaceManagerModal";
import { ProfileModal } from "./ProfileModal";
import { MessageSearchModal } from "./MessageSearchModal";

interface DashboardViewProps {
  currentUser: User;
  onLogout: () => void;
  onProfileUpdated: (user: User) => void;
}
export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  onLogout,
  onProfileUpdated,
}) => {
  const [theme, setTheme] = useState<ThemeMode>("light");
  return (
    <BrutalThemeProvider mode={theme}>
      <DashboardContent
        currentUser={currentUser}
        onLogout={onLogout}
        onProfileUpdated={onProfileUpdated}
        onThemeLoaded={setTheme}
      />
    </BrutalThemeProvider>
  );
};
const DashboardContent: React.FC<
  DashboardViewProps & { onThemeLoaded: (theme: ThemeMode) => void }
> = ({ currentUser, onLogout, onProfileUpdated, onThemeLoaded }) => {
  const BrutalColors = useBrutalTheme();
  const styles = useBrutalStyles(createStyles);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const reduceMotion = useReducedMotion();

  const {
    activeChannel,
    activeChannelId,
    setActiveChannel,
    messages,
    pinnedMessages,
    actionMessage,
    setActionMessage,
    messageError,
    messagesLoading,
    pinsLoading,
    historyPage,
    pinPage,
    archive,
    pinsArchive,
    pageRevision,
    pinPageRevision,
    retry,
    highlightedMessageId,
    selectChannel,
    navigateHistory,
    handleSendMessage,
    handleToggleReaction,
    handleEditMessage,
    handleDeleteMessage,
    handlePinMessage,
    openSearchMessage,
    resetChat,
    setLoadedChannel,
    getSelectedChannelId,
    updateChatProfile,
    setPinnedView,
    refreshMessages,
  } = useChannelMessages({
    setNotice,
    onAccessLost: () => {
      setIsContextDrawerOpen(false);
      setNotice(
        "This channel is no longer accessible. Reloading your available workspace.",
      );
      setLoading(true);
    },
    onMetadataLoaded: (profiles, self, preferences) => {
      setTeamMembers((previous) => mergeTeamProfiles(previous, profiles));
      onProfileUpdated(self);
      setSettings(preferences);
      onThemeLoaded(preferences.theme);
    },
  });
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const loadWorkspace = async () => {
      const savedId = api.getSelectedWorkspaceId();
      let accessibleId = savedId;
      if (savedId) {
        try {
          await api.fetchWorkspace(savedId, { signal: controller.signal });
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            ![403, 404].includes(error.status)
          )
            throw error;
          accessibleId = null;
          if (!disposed)
            setNotice(
              "Your saved workspace is no longer accessible. Showing an available workspace.",
            );
        }
      }
      if (!accessibleId)
        accessibleId = (
          await api.fetchWorkspaces({ limit: 1, signal: controller.signal })
        ).currentWorkspaceId;
      if (disposed) return;
      await api.selectWorkspace(accessibleId);
      if (!accessibleId) {
        setLoadedChannel(null);
        setTeamMembers([]);
        setSettings(null);
        setNotice("Create or join a workspace to continue.");
        return;
      }
      const [rooms, nextSettings, nextTeam] = await Promise.all([
        api.fetchChannels({ signal: controller.signal }),
        api.fetchSettings({ signal: controller.signal }),
        api.fetchTeamMembers({ signal: controller.signal }),
      ]);
      if (disposed) return;
      let selected = rooms.find((room) => room.id === getSelectedChannelId());
      if (!selected && getSelectedChannelId()) {
        try {
          selected = await api.fetchChannel(getSelectedChannelId(), {
            signal: controller.signal,
          });
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            ![403, 404].includes(error.status)
          )
            throw error;
        }
      }
      if (disposed) return;
      const room = selected || rooms[0] || null;
      setSettings(nextSettings);
      onThemeLoaded(nextSettings.theme);
      setTeamMembers((previous) => mergeTeamProfiles(previous, nextTeam));
      setLoadedChannel(room);
    };
    loadWorkspace()
      .catch((error: unknown) => {
        if (!disposed)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load your workspace.",
          );
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [retry, onThemeLoaded, getSelectedChannelId, setLoadedChannel]);
  const reload = () => {
    resetChat();
    setLoading(true);
    setLoadError("");
  };
  const membershipChanged = async (left: boolean) => {
    if (left) {
      setIsContextDrawerOpen(false);
      selectChannel("");
      reload();
      return;
    }
    setActiveChannel(await api.fetchChannel(getSelectedChannelId()));
  };
  const saveProfile = async (values: { name: string; statusText: string }) => {
    const saved = await api.updateProfile(values);
    onProfileUpdated(saved);
    setTeamMembers((previous) =>
      previous.map((member) =>
        member.id === saved.id ? { ...member, ...saved } : member,
      ),
    );
    updateChatProfile(saved);
  };
  const closeDrawer = () => setIsDrawerOpen(false);
  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={activeChannel ? ["top"] : ["top", "bottom"]}
    >
      <StatusBar
        barStyle={
          BrutalColors.bgPaper === "#171A20" ? "light-content" : "dark-content"
        }
        backgroundColor={BrutalColors.bgPaper}
      />
      {notice ? (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" style={{ flex: 1 }}>
            {notice}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss notification"
            onPress={() => setNotice("")}
            hitSlop={8}
          >
            <Text>Close</Text>
          </Pressable>
        </View>
      ) : null}
      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator color={BrutalColors.ink} />
          <Text style={styles.title}>Loading your workspace...</Text>
        </View>
      ) : loadError ? (
        <View style={styles.state}>
          <Text accessibilityRole="alert" style={styles.title}>
            {loadError}
          </Text>
          <BrutalButton title="Try again" onPress={reload} />
          <BrutalButton
            title="Choose workspace"
            variant="outline"
            onPress={() => setIsWorkspaceOpen(true)}
          />
          <BrutalButton title="Log out" variant="outline" onPress={onLogout} />
        </View>
      ) : activeChannel ? (
        <View style={styles.container}>
          {messageError ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading messages"
              onPress={() => {
                void refreshMessages();
              }}
              style={styles.error}
            >
              <Text accessibilityRole="alert">
                {messageError} - Tap to retry
              </Text>
            </Pressable>
          ) : null}
          <MobileChatView
            key={activeChannel.id}
            channel={activeChannel}
            messages={messages}
            teamMembers={teamMembers}
            onSendMessage={handleSendMessage}
            onToggleReaction={handleToggleReaction}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
            onPinMessage={handlePinMessage}
            pinnedMessages={pinnedMessages}
            actionMessage={actionMessage}
            onActionMessageChanged={setActionMessage}
            pinnedLoading={pinsLoading}
            onToggleDrawer={() => setIsDrawerOpen(true)}
            onOpenContextDrawer={() => setIsContextDrawerOpen(true)}
            onOpenMessageSearch={() => setIsMessageSearchOpen(true)}
            highlightedMessageId={highlightedMessageId}
            loading={messagesLoading}
            archive={archive}
            pinsArchive={pinsArchive}
            pageRevision={pageRevision}
            pinPageRevision={pinPageRevision}
            hasOlder={Boolean(
              historyPage?.hasOlder || (!archive && messages.length >= 100),
            )}
            hasNewer={Boolean(historyPage?.hasNewer)}
            hasOlderPins={Boolean(
              pinPage?.hasOlder ||
              (!pinsArchive && pinnedMessages.length >= 100),
            )}
            hasNewerPins={Boolean(pinPage?.hasNewer)}
            onNavigateHistory={(direction, pinned) => {
              void navigateHistory(direction, pinned);
            }}
            onPinnedViewChanged={setPinnedView}
          />
        </View>
      ) : activeChannelId ? (
        <View style={styles.state}>
          <ActivityIndicator color={BrutalColors.ink} />
          <Text style={{ color: BrutalColors.ink }}>Loading channel...</Text>
          {messageError ? (
            <Text accessibilityRole="alert" style={{ color: BrutalColors.ink }}>
              {messageError}
            </Text>
          ) : null}
          <BrutalButton
            title="Try again"
            onPress={() => {
              void refreshMessages();
            }}
          />
        </View>
      ) : (
        <View style={styles.state}>
          <Text style={styles.title}>No channels yet</Text>
          <Text style={{ color: BrutalColors.ink }}>
            Create a channel to start a conversation.
          </Text>
          <BrutalButton
            title="Manage workspace"
            onPress={() => setIsWorkspaceOpen(true)}
          />
          <BrutalButton title="Refresh" onPress={reload} />
          <BrutalButton title="Log out" variant="outline" onPress={onLogout} />
        </View>
      )}
      {isDrawerOpen && (
        <Modal
          visible
          animationType={reduceMotion ? "none" : "slide"}
          presentationStyle="pageSheet"
          onRequestClose={closeDrawer}
        >
          <SidebarDrawer
            activeChannelId={activeChannelId}
            onSelectChannel={selectChannel}
            currentUser={currentUser}
            onOpenSettings={() => {
              closeDrawer();
              setIsSettingsOpen(true);
            }}
            onOpenSearch={() => {
              closeDrawer();
              setIsCommandPaletteOpen(true);
            }}
            onOpenProfile={() => {
              closeDrawer();
              setIsProfileOpen(true);
            }}
            onLogout={onLogout}
            onClose={closeDrawer}
            onOpenWorkspace={() => {
              closeDrawer();
              setIsWorkspaceOpen(true);
            }}
          />
        </Modal>
      )}
      {isContextDrawerOpen && activeChannel && (
        <ContextDrawerModal
          key={activeChannel.id}
          visible
          onClose={() => setIsContextDrawerOpen(false)}
          channel={activeChannel}
          teamMembers={teamMembers}
          currentUser={currentUser}
          onMembershipChanged={membershipChanged}
        />
      )}
      {isSettingsOpen && settings && (
        <SettingsModalView
          visible
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={async (values) => {
            const saved = await api.updateSettings(values);
            setSettings(saved);
            onThemeLoaded(saved.theme);
          }}
        />
      )}
      {isWorkspaceOpen && (
        <WorkspaceManagerModal
          currentUser={currentUser}
          onClose={() => setIsWorkspaceOpen(false)}
          onChanged={(channelId) => {
            selectChannel(channelId || "");
            reload();
          }}
        />
      )}
      {isProfileOpen && (
        <ProfileModal
          user={currentUser}
          onClose={() => setIsProfileOpen(false)}
          onSave={saveProfile}
          onLogout={onLogout}
        />
      )}
      {isMessageSearchOpen && activeChannel && (
        <MessageSearchModal
          channelId={activeChannel.id}
          channelName={activeChannel.name}
          onClose={() => setIsMessageSearchOpen(false)}
          onSelectMessage={openSearchMessage}
        />
      )}
      {isCommandPaletteOpen && (
        <CommandPaletteModal
          visible
          onClose={() => setIsCommandPaletteOpen(false)}
          onSelectChannel={selectChannel}
          onOpenMessageSearch={
            activeChannel ? () => setIsMessageSearchOpen(true) : undefined
          }
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      )}
    </SafeAreaView>
  );
};

const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: BrutalColors.bgPaper },
    container: { flex: 1 },
    state: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 20,
    },
    title: {
      fontFamily: Fonts.sans,
      fontSize: 20,
      fontWeight: "800",
      color: BrutalColors.ink,
    },
    error: { padding: 12, backgroundColor: "#FFE0E9" },
    notice: {
      padding: 16,
      backgroundColor: BrutalColors.accentYellow,
      flexDirection: "row",
      gap: 16,
    },
  });
