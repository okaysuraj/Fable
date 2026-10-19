/** Compose workspace navigation and dialogs; chat windows and synchronization belong to useChannelMessages. */
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { Channel, Message, WorkspaceSettings, User } from "../types/chat";
import { api, ApiError, Workspace, SearchResult } from "../services/api";
import { useChannelMessages } from "./chat/useChannelMessages";
import { Sidebar } from "./Sidebar";
import { MainStage } from "./MainStage";
import { ContextDrawer } from "./ContextDrawer";
import { SettingsModal } from "./SettingsModal";
import { CreateRoomDialog, RoomForm } from "./CreateRoomDialog";
import { ProfileModal } from "./ProfileModal";
import { MessageActionsDialog } from "./chat/MessageActionsDialog";
import { CommandPalette } from "./CommandPalette";
import { useDirectory } from "./useDirectory";
import { DirectoryControls } from "./DirectoryControls";
import { WorkspaceDialog } from "./WorkspaceDialog";
import { MessageSearchDialog } from "./MessageSearchDialog";

interface DashboardProps {
  currentUser: User;
  onLogout: () => void;
  onProfileUpdated: (user: User) => void;
}
export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  onLogout,
  onProfileUpdated,
}) => {
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace>();
  const [workspaceId, setWorkspaceId] = useState(
    localStorage.getItem("fable_workspace") || "",
  );
  const [workspaceDialog, setWorkspaceDialog] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [historySelection, setHistorySelection] = useState(0);
  const pendingAnchorRef = useRef<{
    channelId: string;
    messageId: string;
  } | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<Channel>();
  const [activeChannelId, setActiveChannelId] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [visibleProfiles, setVisibleProfiles] = useState<User[]>([]);
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const [dataReady, setDataReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const activeRef = useRef(activeChannelId);
  activeRef.current = activeChannelId;
  const report = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) onLogout();
      else
        setError(
          err instanceof Error
            ? err.message
            : "Unable to connect. Please retry.",
        );
    },
    [onLogout],
  );
  const workspaceDirectory = useDirectory(
    api.fetchWorkspaces,
    currentUser.id,
    true,
  );
  const roomDirectory = useDirectory(
    api.fetchChannelDirectory,
    workspaceId,
    dataReady,
  );
  const teamDirectory = useDirectory(
    api.fetchTeamDirectory,
    workspaceId,
    dataReady,
  );
  const workspaces = workspaceDirectory.data;
  const channels = roomDirectory.data;
  const teamMembers = teamDirectory.data;
  const setChannels = roomDirectory.setData;
  const setTeamMembers = teamDirectory.setData;

  const {
    messages,
    pins,
    actionMessage,
    setActionMessage,
    anchorMessageId,
    setAnchorMessageId,
    pinsLoading,
    pinsReady,
    pinsHasMore,
    pinsHasNewer,
    pinsArchive,
    hasMore,
    hasNewer,
    archiveMode,
    historyLoading,
    loadHistory,
    browsePins,
    reloadPins,
    handleSend,
    react,
    editMessage,
    deleteMessage,
    pinMessage,
    resetMessages,
    updateMessageProfile,
    retainedAuthorIds,
  } = useChannelMessages({
    activeChannelId,
    reload,
    historySelection,
    pendingAnchorRef,
    report,
    setError,
    setNotice,
    onRoomUpdated: (room) => {
      setSelectedChannel(room);
      setChannels((old) =>
        old.map((item) => (item.id === room.id ? room : item)),
      );
    },
    onAccessLost: async (isCurrent) => {
      setIsDrawerOpen(false);
      const rooms = await api.fetchChannelDirectory();
      if (!isCurrent()) return;
      roomDirectory.setPage(rooms);
      setSelectedChannel(rooms.data[0]);
      setActiveChannelId(rooms.data[0]?.id || "");
      setNotice("Room access changed. Choose an available room.");
    },
  });
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    const load = async () => {
      try {
        const workspace = await api.fetchWorkspaces();
        if (!alive) return;
        workspaceDirectory.setPage(workspace);
        if (!workspace.currentWorkspaceId && !workspace.data.length) {
          localStorage.removeItem("fable_workspace");
          setWorkspaceId("");
          setSelectedWorkspace(undefined);
          setDataReady(false);
          setActiveChannelId("");
          setSelectedChannel(undefined);
          setChannels([]);
          setTeamMembers([]);
          resetMessages();
          setVisibleProfiles([]);
          setSettings(null);
          setNotice(
            "Create a workspace or join one with an invitation to start collaborating.",
          );
          return;
        }
        const saved = localStorage.getItem("fable_workspace");
        let selection: Workspace | undefined;
        if (saved) {
          try {
            selection = (await api.fetchWorkspace(saved)).data;
          } catch (err) {
            if (!(err instanceof ApiError && [403, 404].includes(err.status)))
              throw err;
          }
        }
        if (!selection)
          selection = (
            await api.fetchWorkspace(
              workspace.currentWorkspaceId || workspace.data[0].id,
            )
          ).data;
        const selected = selection.id;
        if (saved && saved !== selected) {
          setNotice(
            "Your saved workspace is unavailable. Switched to an available workspace.",
          );
        }
        localStorage.setItem("fable_workspace", selected);
        setWorkspaceId(selected);
        setSelectedWorkspace(selection);
        const [rooms, prefs, members] = await Promise.all([
          api.fetchChannelDirectory(),
          api.fetchSettings(),
          api.fetchTeamDirectory(),
        ]);
        if (!alive) return;
        setDataReady(true);
        roomDirectory.setPage(rooms);
        setSettings(prefs);
        teamDirectory.setPage(members);
        let selectedRoom = rooms.data[0];
        if (activeRef.current) {
          try {
            selectedRoom = await api.fetchChannel(activeRef.current);
          } catch (err) {
            if (!(err instanceof ApiError && [403, 404].includes(err.status)))
              throw err;
          }
        }
        if (!alive) return;
        setSelectedChannel(selectedRoom);
        setActiveChannelId(selectedRoom?.id || "");
      } catch (err) {
        if (alive) report(err);
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [reload, report]);
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    const refreshMetadata = async () => {
      try {
        if (!document.hidden && alive) {
          roomDirectory.refresh();
          teamDirectory.refresh();
          const authorIds = retainedAuthorIds();
          const [room, profilePages, workspace, preferences] =
            await Promise.all([
              activeRef.current
                ? api.fetchChannel(activeRef.current)
                : undefined,
              Promise.all(
                Array.from(
                  { length: Math.ceil(authorIds.length / 100) },
                  (_, index) =>
                    api.fetchProfiles(
                      authorIds.slice(index * 100, index * 100 + 100),
                    ),
                ),
              ),
              api.fetchWorkspace(
                localStorage.getItem("fable_workspace") || workspaceId,
              ),
              api.fetchSettings(),
            ]);
          if (alive) {
            if (room && room.id === activeRef.current)
              setSelectedChannel((old) =>
                JSON.stringify(old) === JSON.stringify(room) ? old : room,
              );
            setSelectedWorkspace(workspace.data);
            setSettings((old) =>
              JSON.stringify(old) === JSON.stringify(preferences)
                ? old
                : preferences,
            );
            const profiles = profilePages.flatMap((page) => page.data);
            setVisibleProfiles((old) =>
              JSON.stringify(old) === JSON.stringify(profiles) ? old : profiles,
            );
            const self = profiles.find(
              (user) => user.id === currentUserRef.current.id,
            );
            if (
              self &&
              JSON.stringify(self) !== JSON.stringify(currentUserRef.current)
            )
              onProfileUpdated(self);
          }
        }
      } catch (err) {
        if (alive) report(err);
      } finally {
        if (alive) timer = window.setTimeout(refreshMetadata, 30000);
      }
    };
    timer = window.setTimeout(refreshMetadata, 30000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [reload, report]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !document.querySelector('[aria-modal="true"]')
      ) {
        event.preventDefault();
        setIsCommandPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setIsCommandPaletteOpen(false);
        setIsDrawerOpen(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const selectChannel = async (id: string) => {
    pendingAnchorRef.current = null;
    setAnchorMessageId(undefined);
    setActiveChannelId(id);
    setSelectedChannel(channels.find((room) => room.id === id));
    setSidebarOpen(false);
    setError("");
    try {
      const room = await api.fetchChannel(id);
      if (activeRef.current === id) setSelectedChannel(room);
    } catch (err) {
      report(err);
    }
  };
  const membershipChanged = async (leftRoom: boolean) => {
    roomDirectory.refresh();
    if (leftRoom) {
      const rooms = await api.fetchChannelDirectory();
      roomDirectory.setPage(rooms);
      setIsDrawerOpen(false);
      setSelectedChannel(rooms.data[0]);
      setActiveChannelId(rooms.data[0]?.id || "");
      resetMessages();
      setNotice("Room access changed. Choose an available room.");
    } else {
      const id = activeRef.current;
      const room = await api.fetchChannel(id);
      if (activeRef.current === id) setSelectedChannel(room);
      setNotice("Room membership updated.");
    }
  };
  const saveProfile = async (profile: { name: string; statusText: string }) => {
    try {
      const result = await api.updateProfile(profile);
      onProfileUpdated(result.user);
      setTeamMembers((previous) =>
        previous.map((member) =>
          member.id === result.user.id ? result.user : member,
        ),
      );
      updateMessageProfile(result.user);
      setNotice("Profile updated.");
      setError("");
    } catch (err) {
      report(err);
      throw err;
    }
  };
  const updateSettings = async (change: Partial<WorkspaceSettings>) => {
    try {
      setSettings(await api.updateSettings(change));
      setError("");
    } catch (err) {
      report(err);
      throw err;
    }
  };
  const roomCreated = (room: Channel) => {
    roomDirectory.refresh();
    setSelectedChannel(room);
    setActiveChannelId(room.id);
    setIsCreateOpen(false);
    setError("");
  };
  const switchWorkspace = (id: string) => {
    localStorage.setItem("fable_workspace", id);
    setWorkspaceId(id);
    setDataReady(false);
    setChannels([]);
    setTeamMembers([]);
    setVisibleProfiles([]);
    setSettings(null);
    setActiveChannelId("");
    setSelectedChannel(undefined);
    setSelectedWorkspace(workspaces.find((item) => item.id === id));
    resetMessages();
    setReload((value) => value + 1);
  };
  const workspaceChanged = async () => {
    const selected = (await api.fetchWorkspace(workspaceId)).data;
    setSelectedWorkspace(selected);
    workspaceDirectory.refresh();
    teamDirectory.refresh();
    roomDirectory.refresh();
  };
  const openSearchResult = (result: SearchResult) => {
    const id = result.channel.id;
    pendingAnchorRef.current = { channelId: id, messageId: result.message.id };
    setActiveChannelId(id);
    setSelectedChannel(channels.find((room) => room.id === id));
    setHistorySelection((old) => old + 1);
    setSidebarOpen(false);
    setError("");
    void api
      .fetchChannel(id)
      .then((room) => {
        if (activeRef.current === id) setSelectedChannel(room);
      })
      .catch(report);
  };
  const profileMap = useMemo(
    () =>
      new Map(
        [...teamMembers, ...visibleProfiles, currentUser].map((user) => [
          user.id,
          user,
        ]),
      ),
    [teamMembers, visibleProfiles, currentUser],
  );
  const hydrateProfile = (message: Message) => ({
    ...message,
    sender: profileMap.get(message.sender.id) || message.sender,
  });
  const displayedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        sender: profileMap.get(message.sender.id) || message.sender,
      })),
    [messages, profileMap],
  );
  const displayedPins = useMemo(
    () =>
      pins.map((message) => ({
        ...message,
        sender: profileMap.get(message.sender.id) || message.sender,
      })),
    [pins, profileMap],
  );
  const selectedActionMessage = actionMessage
    ? [
        actionMessage,
        ...messages.filter((message) => message.id === actionMessage.id),
        ...pins.filter((message) => message.id === actionMessage.id),
      ].sort((left, right) => right.version - left.version)[0]
    : undefined;
  const activeChannel =
    selectedChannel?.id === activeChannelId
      ? selectedChannel
      : channels.find((channel) => channel.id === activeChannelId);
  return (
    <div
      data-theme={settings?.theme || "light"}
      className="dashboard-shell flex h-dvh w-full bg-[var(--bg-paper)] overflow-hidden flex-col"
    >
      {(error || notice) && (
        <div
          className="p-3 border-b-[3px] bg-[var(--bg-card)] flex items-center gap-3"
          role={error ? "alert" : "status"}
        >
          <span className="flex-1 text-sm">{error || notice}</span>
          {error && (
            <button
              className="brutal-btn brutal-btn-sm"
              onClick={() => setReload((value) => value + 1)}
            >
              Retry
            </button>
          )}
          <button
            aria-label="Dismiss message"
            className="brutal-btn brutal-btn-sm"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            Close
          </button>
        </div>
      )}
      {loading ? (
        <div className="m-auto" role="status">
          Loading workspace...
        </div>
      ) : (
        <>
          <div className="mobile-workspace-nav p-2 border-b-[3px] flex gap-2">
            <button
              className="brutal-btn brutal-btn-sm"
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((open) => !open)}
            >
              Rooms
            </button>
            <span className="font-display m-auto truncate">
              {activeChannel?.name || "Fable"}
            </span>
          </div>
          <div className="flex flex-1 min-h-0 relative">
            <div
              className={`workspace-sidebar h-full ${sidebarOpen ? "is-open" : ""}`}
            >
              <div className="workspace-actions p-2 bg-[var(--bg-card)] border-r-[3px] space-y-2">
                <section aria-label="Workspace directory">
                  <DirectoryControls
                    label="Search workspaces"
                    directory={workspaceDirectory}
                  />
                </section>
                <label className="block text-xs font-bold">
                  WORKSPACE
                  <select
                    className="brutal-input"
                    aria-label="Workspace"
                    value={workspaceId}
                    onChange={(event) => switchWorkspace(event.target.value)}
                  >
                    {selectedWorkspace &&
                      !workspaces.some(
                        (item) => item.id === selectedWorkspace.id,
                      ) && (
                        <option value={selectedWorkspace.id}>
                          {selectedWorkspace.name}
                        </option>
                      )}
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="brutal-btn brutal-btn-sm w-full"
                  onClick={() => setWorkspaceDialog(true)}
                >
                  Manage workspaces
                </button>
                <button
                  className="brutal-btn brutal-btn-sm w-full"
                  onClick={() => setIsCreateOpen(true)}
                  disabled={!dataReady}
                >
                  Create room
                </button>
              </div>
              <Sidebar
                channels={channels}
                teamMembers={teamMembers}
                activeChannelId={activeChannelId}
                onSelectChannel={selectChannel}
                currentUser={currentUser}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                onLogout={onLogout}
                onOpenProfile={() => setIsProfileOpen(true)}
                roomControls={
                  <DirectoryControls
                    label="Search rooms"
                    directory={roomDirectory}
                  />
                }
                teamControls={
                  <DirectoryControls
                    label="Search members"
                    directory={teamDirectory}
                  />
                }
                roomTotal={roomDirectory.total}
                teamTotal={teamDirectory.total}
              />
            </div>
            {activeChannel ? (
              <MainStage
                hasMore={hasMore}
                hasNewer={hasNewer}
                archiveMode={archiveMode}
                historyLoading={historyLoading}
                onLoadOlder={() => loadHistory("older")}
                onLoadNewer={() => loadHistory("newer")}
                onLoadLatest={() => loadHistory("latest")}
                channel={activeChannel}
                messages={displayedMessages}
                pins={displayedPins}
                onMessageActions={setActionMessage}
                currentUser={currentUser}
                onSendMessage={handleSend}
                onToggleReaction={react}
                onSearchMessages={() => setIsSearchOpen(true)}
                anchorMessageId={anchorMessageId}
                onToggleDrawer={() => setIsDrawerOpen((open) => !open)}
                isDrawerOpen={isDrawerOpen}
              />
            ) : (
              <main className="flex-1 p-6 overflow-auto">
                <div className="brutal-card p-6 max-w-md mx-auto space-y-4">
                  <h2 className="font-display text-xl">
                    {!workspaceId
                      ? "Create or join a workspace"
                      : dataReady
                        ? "Create your first room"
                        : "Unable to load workspace"}
                  </h2>
                  <p>
                    {!workspaceId
                      ? "Create a new workspace, or enter an invitation from your team."
                      : dataReady
                        ? "No rooms are available in your workspace."
                        : "Check your connection and retry."}
                  </p>
                  {!workspaceId && (
                    <button
                      className="brutal-btn"
                      onClick={() => setWorkspaceDialog(true)}
                    >
                      Manage workspaces
                    </button>
                  )}
                  {dataReady && (
                    <RoomForm onCreated={roomCreated} onError={report} />
                  )}
                </div>
              </main>
            )}
            {activeChannel && (
              <ContextDrawer
                channel={activeChannel}
                currentUser={currentUser}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                pins={displayedPins}
                pinsLoading={pinsLoading}
                pinsReady={pinsReady}
                pinsHasMore={pinsHasMore}
                pinsHasNewer={pinsHasNewer}
                pinsArchive={pinsArchive}
                onLoadMorePins={() => browsePins("older")}
                onLoadNewerPins={() => browsePins("newer")}
                onReloadPins={reloadPins}
                onMembershipChanged={membershipChanged}
                onMessageActions={setActionMessage}
              />
            )}
          </div>
        </>
      )}
      {workspaceDialog && (
        <WorkspaceDialog
          workspace={selectedWorkspace}
          currentUser={currentUser}
          onClose={() => setWorkspaceDialog(false)}
          onSwitch={switchWorkspace}
          onChanged={workspaceChanged}
        />
      )}
      {isSearchOpen && (
        <MessageSearchDialog
          channel={activeChannel}
          onClose={() => setIsSearchOpen(false)}
          onOpenResult={openSearchResult}
        />
      )}
      {isCreateOpen && (
        <CreateRoomDialog
          onCreated={roomCreated}
          onError={report}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
      <ProfileModal
        isOpen={isProfileOpen}
        user={currentUser}
        onClose={() => setIsProfileOpen(false)}
        onSave={saveProfile}
        onLogoutAll={async () => {
          await api.logoutAllDevices();
          onLogout();
        }}
      />
      <MessageActionsDialog
        message={
          selectedActionMessage
            ? hydrateProfile(selectedActionMessage)
            : undefined
        }
        onClose={() => setActionMessage(undefined)}
        onEdit={editMessage}
        onDelete={deleteMessage}
        onPin={pinMessage}
      />
      {settings && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={updateSettings}
        />
      )}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        channels={channels}
        teamMembers={teamMembers}
        onSelectChannel={selectChannel}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </div>
  );
};
