/** Compose native workspace screens and appearance; useChannelMessages owns conversation state. */
import { useChannelMessages } from "./chat/useChannelMessages";
import { mergeTeamProfiles } from "./chat/messageState";
import {
  useBrutalTheme,
  useBrutalStyles,
  type BrutalPalette,
} from "@/hooks/use-brutal-theme";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Fonts } from "@/constants/theme";
import { User, WorkspaceSettings, ThemeMode } from "@/types/chat";
import { BrutalThemeProvider } from "@/hooks/use-brutal-theme";
import { api, ApiError } from "@/services/api";
import { MobileChatView } from "./chat/MobileChatView";
import { CallingProvider } from "./calling/CallingProvider";
import { CallsView } from "./calling/CallsView";
import { BottomTabs, type HomeTab } from "./BottomTabs";
import { SidebarDrawer } from "./SidebarDrawer";
import {
  NavigationDrawer,
  type NavigationDrawerHandle,
} from "./NavigationDrawer";
import { ContactPickerModal } from "./ContactPickerModal";
import { NewGroupModal } from "./NewGroupModal";
import { choosePhoto, type PhotoDraft } from "@/services/photos";
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
  const inheritedColors = useBrutalTheme();
  const [theme, setTheme] = useState<ThemeMode>(inheritedColors.bgPaper === "#FFFFFF" ? "light" : "dark");
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const navigationRef = useRef<NavigationDrawerHandle>(null);
  const [activeTab, setActiveTab] = useState<HomeTab>("chats");
  const showPeople = activeTab === "people";
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isNewGroupOpen, setIsNewGroupOpen] = useState(false);
  const [cameraDraft, setCameraDraft] = useState<PhotoDraft | null>(null);
  const [cameraBusy, setCameraBusy] = useState(false);
  const capturing = useRef(false);
  const [callPresented, setCallPresented] = useState(false);
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const { width } = useWindowDimensions();
  const wideLayout = width >= 840;
  const wideChatLayout = wideLayout && activeTab === "chats";
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isNavigationOpen) {
          navigationRef.current?.close();
          return true;
        }
        if (activeTab !== "chats") {
          setActiveTab("chats");
          setIsDrawerOpen(true);
          return true;
        }
        if (wideLayout || isDrawerOpen) return false;
        Keyboard.dismiss();
        setIsDrawerOpen(true);
        return true;
      },
    );
    return () => subscription.remove();
  }, [wideLayout, isDrawerOpen, isNavigationOpen, activeTab]);
  const [isContextDrawerOpen, setIsContextDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [notice, setNotice] = useState("");

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
    conversationVisible:
      !callPresented &&
      !isNavigationOpen &&
      activeTab === "chats" &&
      (wideLayout || !isDrawerOpen),
    setNotice,
    onAccessLost: () => {
      setIsContextDrawerOpen(false);
      setNotice(
        "This chat is no longer accessible. Reloading your available group.",
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
              "Your saved group is no longer accessible. Showing an available group.",
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
        const preferences = await api.fetchSettings();
        setSettings(preferences);
        onThemeLoaded(preferences.theme);
        setNotice("Create or join a group to continue.");
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
              : "Unable to load your group.",
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
  const saveProfile = async (values: { name: string; phoneNumber: string | null }) => {
    const saved = await api.updateProfile(values);
    onProfileUpdated(saved);
    setTeamMembers((previous) =>
      previous.map((member) =>
        member.id === saved.id ? { ...member, ...saved } : member,
      ),
    );
    updateChatProfile(saved);
  };
  const closeDrawer = () => {
    Keyboard.dismiss();
    setIsDrawerOpen(false);
  };
  const openConversation = (channelId: string, workspaceId?: string) => {
    if (workspaceId && workspaceId !== api.getSelectedWorkspaceId()) {
      setLoading(true);
      void api.selectWorkspace(workspaceId).then(() => {
        selectChannel(channelId);
        setActiveTab("chats");
        closeDrawer();
        resetChat();
      }).catch((failure: unknown) => { setLoadError(failure instanceof Error ? failure.message : "Couldn't open this conversation."); setLoading(false); });
      return;
    }
    selectChannel(channelId);
    setActiveTab("chats");
    closeDrawer();
  };
  const conversationCreated = async (chat: import("@/types/chat").Channel) => {
    await api.selectWorkspace(chat.workspaceId);
    setIsCreateChatOpen(false);
    setIsNewGroupOpen(false);
    setCameraDraft(null);
    setDirectoryRevision((value) => value + 1);
    selectChannel(chat.id);
    setActiveTab("chats");
    closeDrawer();
    reload();
  };
  const openCamera = async () => {
    if (capturing.current) return;
    capturing.current = true; setCameraBusy(true);
    try { const photo = await choosePhoto("camera"); if (photo) setCameraDraft(photo); }
    catch (failure) { setNotice(failure instanceof Error ? failure.message : "Couldn't open the camera."); }
    finally { capturing.current = false; setCameraBusy(false); }
  };
  const showChatList =
    !loading && !loadError && (wideLayout || isDrawerOpen || !activeChannel);
  const openNavigation = useCallback(() => {
    navigationRef.current?.open();
  }, []);
  const showDirectory = (people: boolean) => {
    setActiveTab(people ? "people" : "chats");
    setIsDrawerOpen(true);
  };
  const selectTab = (tab: HomeTab) => {
    Keyboard.dismiss();
    setActiveTab(tab);
    setIsDrawerOpen(true);
  };
  return (
    <CallingProvider
      key={api.getSelectedWorkspaceId()}
      userId={currentUser.id}
      onActiveChange={setCallPresented}
    >
      <NavigationDrawer
        ref={navigationRef}
        open={isNavigationOpen}
        onOpenChange={setIsNavigationOpen}
        enabled={
          !callPresented &&
          !isCreateChatOpen &&
          !isNewGroupOpen &&
          !cameraDraft &&
          !cameraBusy &&
          !isContextDrawerOpen &&
          !isSettingsOpen &&
          !isCommandPaletteOpen &&
          !isWorkspaceOpen &&
          !isProfileOpen &&
          !isMessageSearchOpen &&
          !actionMessage
        }
        currentUser={currentUser}
        canCreateChat={
          !loading && !loadError
        }
        canOpenSettings={Boolean(settings)}
        onCreateGroup={() => setIsNewGroupOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
      >
        <SafeAreaView style={styles.safeArea} edges={["top"]}>
          <StatusBar
            barStyle={
              settings?.theme === "dark" ? "light-content" : "dark-content"
            }
            backgroundColor={BrutalColors.bgPaper}
          />
          {notice ? (
            <View style={styles.notice}>
              <Text
                accessibilityRole="alert"
                style={{ flex: 1, color: BrutalColors.selectionInk }}
              >
                {notice}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss notification"
                onPress={() => setNotice("")}
                hitSlop={8}
              >
                <Text style={{ color: BrutalColors.selectionInk }}>Close</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.splitView}>
            {showChatList && (
              <View
                style={
                  wideChatLayout ? styles.chatListColumn : styles.phoneChatList
                }
              >
                {activeTab === "calls" ? (
                  <CallsView
                    key={api.getSelectedWorkspaceId()}
                    currentUserId={currentUser.id}
                    onOpenNavigation={openNavigation}
                    onManageGroups={() => setIsWorkspaceOpen(true)}
                  />
                ) : (
                  <SidebarDrawer
                    currentUserId={currentUser.id}
                    key={api.getSelectedWorkspaceId() + ":" + directoryRevision}
                    activeChannelId={activeChannelId}
                    onSelectChannel={openConversation}
                    showPeople={showPeople}
                    onOpenNavigation={openNavigation}
                    onCreateChat={() => setIsCreateChatOpen(true)}
                    onOpenCamera={() => void openCamera()}
                    cameraBusy={cameraBusy}
                    canCreateChat={Boolean(api.getSelectedWorkspaceId())}
                  />
                )}
                <BottomTabs activeTab={activeTab} onSelect={selectTab} />
              </View>
            )}
            <View
              style={[
                styles.conversationColumn,
                showChatList &&
                  (activeTab !== "chats" || !wideLayout) && {
                    display: "none",
                  },
              ]}
            >
              {loading ? (
                <View style={styles.state}>
                  <ActivityIndicator color={BrutalColors.ink} />
                  <Text style={styles.title}>Loading your group…</Text>
                </View>
              ) : loadError ? (
                <View style={styles.state}>
                  <Text accessibilityRole="alert" style={styles.title}>
                    {loadError}
                  </Text>
                  <BrutalButton title="Try again" onPress={reload} />
                  <BrutalButton
                    title="Choose group"
                    variant="outline"
                    onPress={() => setIsWorkspaceOpen(true)}
                  />
                  <BrutalButton
                    title="Log out"
                    variant="outline"
                    onPress={onLogout}
                  />
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
                      <Text
                        accessibilityRole="alert"
                        style={{ color: BrutalColors.accentPink }}
                      >
                        {messageError} - Tap to retry
                      </Text>
                    </Pressable>
                  ) : null}
                  <MobileChatView
                    key={activeChannel.id}
                    channel={activeChannel}
                    currentUser={currentUser}
                    hideBackButton={wideLayout}
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
                    onToggleDrawer={() => showDirectory(false)}
                    onOpenNavigation={openNavigation}
                    onOpenChatDetails={() => setIsContextDrawerOpen(true)}
                    onOpenMessageSearch={() => setIsMessageSearchOpen(true)}
                    highlightedMessageId={highlightedMessageId}
                    loading={messagesLoading}
                    archive={archive}
                    pinsArchive={pinsArchive}
                    pageRevision={pageRevision}
                    pinPageRevision={pinPageRevision}
                    hasOlder={Boolean(
                      historyPage?.hasOlder ||
                      (!archive && messages.length >= 100),
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
                  <Text style={{ color: BrutalColors.ink }}>Loading chat…</Text>
                  {messageError ? (
                    <Text
                      accessibilityRole="alert"
                      style={{ color: BrutalColors.ink }}
                    >
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
                  <Text style={styles.title}>No chats yet</Text>
                  <Text style={{ color: BrutalColors.ink }}>
                    Choose New chat to start a conversation.
                  </Text>
                  <BrutalButton
                    title="Manage group"
                    onPress={() => setIsWorkspaceOpen(true)}
                  />
                  <BrutalButton title="Refresh" onPress={reload} />
                  <BrutalButton
                    title="Log out"
                    variant="outline"
                    onPress={onLogout}
                  />
                </View>
              )}
            </View>
          </View>
          {(isCreateChatOpen || cameraDraft) && (
            <ContactPickerModal
              currentUser={currentUser}
              photo={cameraDraft ?? undefined}
              onClose={() => { setIsCreateChatOpen(false); setCameraDraft(null); }}
              onCreated={conversationCreated}
            />
          )}
          {isNewGroupOpen && <NewGroupModal currentUser={currentUser} onClose={() => setIsNewGroupOpen(false)} onCreated={conversationCreated} />}
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
              onLogout={onLogout}
              onManageGroups={() => { setIsSettingsOpen(false); setIsWorkspaceOpen(true); }}
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
                setDirectoryRevision((value) => value + 1);
                selectChannel(channelId || "");
                if (channelId) {
                  setActiveTab("chats");
                  closeDrawer();
                }
                reload();
              }}
            />
          )}
          {isProfileOpen && (
            <ProfileModal
              user={currentUser}
              onClose={() => setIsProfileOpen(false)}
              onSave={saveProfile}
              onPhotoUpdated={(saved) => { onProfileUpdated(saved); updateChatProfile(saved); }}
            />
          )}
          {isMessageSearchOpen && activeChannel && (
            <MessageSearchModal
              channelId={activeChannel.id}
              channelName={activeChannel.name}
              onClose={() => setIsMessageSearchOpen(false)}
              onSelectMessage={(channelId, messageId) => {
                openSearchMessage(channelId, messageId);
                setActiveTab("chats");
                closeDrawer();
              }}
            />
          )}
          {isCommandPaletteOpen && (
            <CommandPaletteModal
              visible
              onClose={() => setIsCommandPaletteOpen(false)}
              onSelectChannel={openConversation}
              onOpenMessageSearch={
                activeChannel ? () => setIsMessageSearchOpen(true) : undefined
              }
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}
        </SafeAreaView>
      </NavigationDrawer>
    </CallingProvider>
  );
};

const createStyles = (BrutalColors: BrutalPalette) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: BrutalColors.bgPaper },
    container: { flex: 1 },
    splitView: { flex: 1, flexDirection: "row" },
    chatListColumn: {
      width: 320,
      borderRightWidth: 1,
      borderColor: BrutalColors.border,
    },
    phoneChatList: { flex: 1 },
    conversationColumn: { flex: 1, minWidth: 0 },
    state: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      gap: 20,
    },
    title: {
      fontFamily: Fonts.display,
      fontSize: 20,
      fontWeight: "400",
      color: BrutalColors.ink,
    },
    error: { padding: 12, backgroundColor: BrutalColors.dangerSurface },
    notice: {
      padding: 16,
      backgroundColor: BrutalColors.selection,
      flexDirection: "row",
      gap: 16,
    },
  });
