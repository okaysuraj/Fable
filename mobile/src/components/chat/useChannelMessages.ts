import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import type { Channel, Message, User, WorkspaceSettings } from "@/types/chat";
import { api, ApiError, type MessagePage } from "@/services/api";
import {
  mergeMessageWindow,
  mergePinnedWindow,
  mergeArchivedWindow,
  replaceMessagePage,
  updateMessageProfiles,
  filterMessageVersions,
  earliestChangeCursor,
  hasStaleMessageSnapshot,
  updateActionMessage,
  senderProfileBatches,
} from "./messageState";

interface Options {
  conversationVisible: boolean;
  setNotice: (message: string) => void;
  onAccessLost: () => void;
  onMetadataLoaded: (
    profiles: User[],
    self: User,
    settings: WorkspaceSettings,
  ) => void;
}

/** Native room state: bounded snapshots, durable changes, read progress and confirmed mutations. */
export function useChannelMessages({
  conversationVisible,
  setNotice,
  onAccessLost,
  onMetadataLoaded,
}: Options) {
  // Keep the draft mounted behind the phone list without acknowledging unseen messages.
  const conversationVisibleRef = useRef(conversationVisible);
  useLayoutEffect(() => {
    conversationVisibleRef.current = conversationVisible;
  }, [conversationVisible]);
  const callbacks = useRef({ onAccessLost, onMetadataLoaded });
  useEffect(() => {
    callbacks.current = { onAccessLost, onMetadataLoaded };
  }, [onAccessLost, onMetadataLoaded]);

  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [activeChannelId, setActiveChannelId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [actionMessage, setActionMessage] = useState<Message | null>(null);
  const [messageError, setMessageError] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [pinsLoading, setPinsLoading] = useState(true);
  const [historyPage, setHistoryPage] = useState<MessagePage | null>(null);
  const [pinPage, setPinPage] = useState<MessagePage | null>(null);
  const [archive, setArchive] = useState(false);
  const [pinsArchive, setPinsArchive] = useState(false);
  const [pageRevision, setPageRevision] = useState(0);
  const [pinPageRevision, setPinPageRevision] = useState(0);
  const [retry, setRetry] = useState(0);
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const messageAnchor = useRef<{ channelId: string; messageId: string } | null>(
    null,
  );
  const pendingSend = useRef<{
    channelId: string;
    content: string;
    replyToId?: string;
    attachmentKey?: string;
    key: string;
  } | null>(null);
  const selectedChannel = useRef("");
  const archived = useRef(false);
  const archivedPins = useRef(false);
  const showingPins = useRef(false);
  const syncCursor = useRef<string | null>(null);
  const synchronizationGeneration = useRef(0);
  const readCandidate = useRef<Message | undefined>(undefined);
  const pendingReactions = useRef(new Set<string>());
  const historyRequest = useRef<AbortController | null>(null);
  const pinRequest = useRef<AbortController | null>(null);
  const requestRefresh = useRef<(() => Promise<void>) | null>(null);
  const latestVersions = useRef(new Map<string, number>());
  const retainedIds = useRef(new Set<string>());
  const profileBatches = useRef<string[][]>([]);

  useEffect(() => {
    retainedIds.current = new Set(
      [
        ...messages,
        ...pinnedMessages,
        ...(actionMessage ? [actionMessage] : []),
      ].map((message) => message.id),
    );
    profileBatches.current = senderProfileBatches(
      messages,
      pinnedMessages,
      actionMessage,
    );
  }, [messages, pinnedMessages, actionMessage]);

  const abortHistoryRequests = useCallback(() => {
    historyRequest.current?.abort();
    pinRequest.current?.abort();
  }, []);

  const selectChannel = useCallback(
    (id: string) => {
      if (id === selectedChannel.current) return;
      abortHistoryRequests();
      selectedChannel.current = id;
      latestVersions.current.clear();
      syncCursor.current = null;
      archived.current = false;
      archivedPins.current = false;
      showingPins.current = false;
      readCandidate.current = undefined;
      setArchive(false);
      setPinsArchive(false);
      setMessages([]);
      setPinnedMessages([]);
      setHistoryPage(null);
      setPinPage(null);
      setActionMessage(null);
      setHighlightedMessageId(null);
      setMessagesLoading(true);
      setPinsLoading(true);
      setMessageError("");
      setActiveChannel(null);
      setActiveChannelId(id);
    },
    [abortHistoryRequests],
  );

  useEffect(() => {
    const generation = ++synchronizationGeneration.current;
    let disposed = false;
    let inFlight = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let controller: AbortController | undefined;
    let lastReadId: string | undefined;
    let lastMetadataAt = Date.now();
    if (!activeChannelId) return;
    const refresh = async () => {
      if (
        disposed ||
        inFlight ||
        (AppState.currentState && AppState.currentState !== "active")
      )
        return;
      inFlight = true;
      controller = new AbortController();
      const signal = controller.signal;
      try {
        if (syncCursor.current === null) {
          const anchor =
            messageAnchor.current?.channelId === activeChannelId
              ? messageAnchor.current.messageId
              : undefined;
          if (anchor) {
            archived.current = true;
            setArchive(true);
          }
          const [room, page, pins] = await Promise.all([
            api.fetchChannel(activeChannelId, { signal }),
            api.fetchMessagePage(activeChannelId, {
              limit: 50,
              around: anchor,
              signal,
            }),
            api.fetchPinnedMessages(activeChannelId, { limit: 50, signal }),
          ]);
          if (disposed || signal.aborted) return;
          if (!page.changeCursor || !pins.changeCursor)
            throw new Error(
              "The server did not return a message synchronization checkpoint.",
            );
          setActiveChannel(room);
          const snapshot = filterMessageVersions(
            [...page.data, ...pins.data],
            latestVersions.current,
            2000,
            retainedIds.current,
          );
          const conversationIds = new Set(
            page.data.map((message) => message.id),
          );
          const pinIds = new Set(pins.data.map((message) => message.id));
          setMessages((previous) =>
            replaceMessagePage(
              previous,
              snapshot.filter((message) => conversationIds.has(message.id)),
            ),
          );
          setPinnedMessages((previous) =>
            replaceMessagePage(
              previous,
              snapshot.filter((message) => pinIds.has(message.id)),
              true,
            ),
          );
          setHistoryPage(page);
          setPinPage(pins);
          readCandidate.current = anchor ? undefined : page.data.at(-1);
          messageAnchor.current = null;
          if (anchor) setPageRevision((value) => value + 1);
          syncCursor.current = earliestChangeCursor(
            page.changeCursor,
            pins.changeCursor,
          );
        }
        for (
          let batch = 0;
          batch < 5 && !disposed && !signal.aborted;
          batch += 1
        ) {
          const cursor: string = syncCursor.current!;
          const page = await api.fetchMessageChanges(activeChannelId, cursor, {
            limit: 100,
            signal,
          });
          if (disposed || signal.aborted) return;
          const updates = filterMessageVersions(
            page.data,
            latestVersions.current,
            2000,
            retainedIds.current,
          );
          setActionMessage((previous) =>
            updateActionMessage(previous, updates),
          );
          setMessages((previous) =>
            archived.current
              ? mergeArchivedWindow(previous, updates)
              : mergeMessageWindow(previous, updates, 100),
          );
          setPinnedMessages((previous) =>
            archivedPins.current
              ? mergeArchivedWindow(previous, updates, true)
              : mergePinnedWindow(previous, updates, 100),
          );
          if (!archived.current && !showingPins.current)
            for (const message of updates) {
              const newest = readCandidate.current;
              if (
                !newest ||
                message.timestamp > newest.timestamp ||
                (message.timestamp === newest.timestamp &&
                  message.id > newest.id)
              )
                readCandidate.current = message;
            }
          if (page.hasMore && page.changeCursor === cursor)
            throw new Error(
              "Message synchronization did not advance. Please retry.",
            );
          // Navigation can rewind the checkpoint while this request is in flight. Preserve its replay boundary.
          if (syncCursor.current === cursor)
            syncCursor.current = page.changeCursor;
          if (!page.hasMore) break;
        }
        const newestLoaded = readCandidate.current;
        if (
          conversationVisibleRef.current &&
          !archived.current &&
          !showingPins.current &&
          newestLoaded &&
          newestLoaded.id !== lastReadId
        ) {
          const workspaceId = api.getSelectedWorkspaceId();
          const stale = () =>
            disposed ||
            signal.aborted ||
            generation !== synchronizationGeneration.current ||
            selectedChannel.current !== activeChannelId ||
            api.getSelectedWorkspaceId() !== workspaceId;
          await api.markChannelRead(activeChannelId, newestLoaded.id, {
            signal,
          });
          if (stale()) return;
          // A read acknowledgement does not reveal how many newer messages remain unread.
          const room = await api.fetchChannel(activeChannelId, { signal });
          if (stale()) return;
          lastReadId = newestLoaded.id;
          setActiveChannel((previous) =>
            !stale() && previous?.id === room.id ? room : previous,
          );
        }
        if (Date.now() - lastMetadataAt >= 60000) {
          const [room, nextTeam, nextProfile, senderProfiles, nextSettings] =
            await Promise.all([
              api.fetchChannel(activeChannelId, { signal }),
              api.fetchTeamMembers({ signal }),
              api.fetchCurrentUser({ signal }),
              Promise.all(
                profileBatches.current.map((ids) =>
                  api.fetchProfiles(ids, { signal }),
                ),
              ),
              api.fetchSettings({ signal }),
            ]);
          if (disposed || signal.aborted) return;
          const profiles = new Map(
            [...nextTeam, ...senderProfiles.flat(), nextProfile].map(
              (member) => [member.id, member],
            ),
          );
          setActiveChannel(room);
          callbacks.current.onMetadataLoaded(
            [...profiles.values()],
            nextProfile,
            nextSettings,
          );
          setMessages((previous) => updateMessageProfiles(previous, profiles));
          setPinnedMessages((previous) =>
            updateMessageProfiles(previous, profiles),
          );
          setActionMessage((previous) =>
            previous
              ? updateMessageProfiles([previous], profiles)[0]
              : previous,
          );
          lastMetadataAt = Date.now();
        }
        setMessageError("");
      } catch (error: unknown) {
        if (!disposed && !signal.aborted) {
          if (error instanceof ApiError && [403, 404].includes(error.status)) {
            selectChannel("");
            callbacks.current.onAccessLost();
            setRetry((value) => value + 1);
          } else
            setMessageError(
              error instanceof Error
                ? error.message
                : "Unable to load messages.",
            );
        }
      } finally {
        inFlight = false;
        if (!disposed) {
          if (!historyRequest.current) setMessagesLoading(false);
          if (!pinRequest.current) setPinsLoading(false);
        }
      }
    };
    requestRefresh.current = refresh;
    const start = () => {
      if (timer) clearInterval(timer);
      void refresh();
      timer = setInterval(() => {
        void refresh();
      }, 15000);
    };
    start();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") start();
      else {
        if (timer) clearInterval(timer);
        timer = undefined;
        controller?.abort();
        abortHistoryRequests();
      }
    });
    return () => {
      disposed = true;
      controller?.abort();
      abortHistoryRequests();
      if (requestRefresh.current === refresh) requestRefresh.current = null;
      if (timer) clearInterval(timer);
      subscription.remove();
    };
  }, [activeChannelId, retry, selectChannel, abortHistoryRequests]);

  const navigateHistory = async (
    direction: "earlier" | "newer" | "latest",
    pinned = false,
  ) => {
    const metadata = pinned ? pinPage : historyPage;
    const ref = pinned ? pinRequest : historyRequest;
    if (ref.current) return;
    const rows = pinned ? pinnedMessages : messages;
    const cursor =
      direction === "earlier"
        ? rows[0]?.id || metadata?.olderCursor
        : rows.at(-1)?.id || metadata?.newerCursor;
    if (direction !== "latest" && !cursor) return;
    const channelId = selectedChannel.current;
    const controller = new AbortController();
    ref.current = controller;
    const wasArchived = pinned ? archivedPins.current : archived.current;
    // Stop read acknowledgements immediately, before the page response arrives.
    if (!pinned) archived.current = true;
    else archivedPins.current = true;
    if (pinned) setPinsLoading(true);
    else setMessagesLoading(true);
    try {
      const options = {
        ...(direction === "earlier"
          ? { before: cursor! }
          : direction === "newer"
            ? { after: cursor! }
            : {}),
        limit: 50,
        signal: controller.signal,
      };
      let page: MessagePage;
      for (let attempt = 0; ; attempt += 1) {
        page = pinned
          ? await api.fetchPinnedMessages(channelId, options)
          : await api.fetchMessagePage(channelId, options);
        if (selectedChannel.current !== channelId || controller.signal.aborted)
          return;
        if (!hasStaleMessageSnapshot(page.data, latestVersions.current)) break;
        if (attempt >= 1)
          throw new Error(
            "Messages changed while loading this page. Try loading the page again.",
          );
      }
      if (selectedChannel.current !== channelId || controller.signal.aborted)
        return;
      const snapshot = filterMessageVersions(
        page.data,
        latestVersions.current,
        2000,
        retainedIds.current,
      );
      // Replaying from this page's checkpoint also reconciles races with ongoing live polling.
      syncCursor.current =
        syncCursor.current === null
          ? page.changeCursor
          : earliestChangeCursor(syncCursor.current, page.changeCursor);
      const isArchived = direction !== "latest" && page.hasNewer;
      if (!pinned && direction === "latest") setHighlightedMessageId(null);
      if (pinned) {
        setPinnedMessages((previous) =>
          replaceMessagePage(previous, snapshot, true),
        );
        setPinPage(page);
        archivedPins.current = isArchived;
        setPinsArchive(isArchived);
        setPinPageRevision((value) => value + 1);
      } else {
        setMessages((previous) => replaceMessagePage(previous, snapshot));
        setHistoryPage(page);
        archived.current = isArchived;
        setArchive(isArchived);
        setPageRevision((value) => value + 1);
        if (!isArchived) readCandidate.current = page.data.at(-1);
      }
      setMessageError("");
      void requestRefresh.current?.();
    } catch (error: unknown) {
      if (selectedChannel.current === channelId) {
        if (pinned) archivedPins.current = wasArchived;
        else archived.current = wasArchived;
      }
      if (!controller.signal.aborted && selectedChannel.current === channelId)
        setMessageError(
          error instanceof Error ? error.message : "Unable to load messages.",
        );
    } finally {
      if (ref.current === controller) ref.current = null;
      if (selectedChannel.current === channelId) {
        if (pinned) setPinsLoading(false);
        else setMessagesLoading(false);
      }
    }
  };

  const applyConfirmedMessage = useCallback((saved: Message) => {
    if (selectedChannel.current !== saved.channelId) return;
    const updates = filterMessageVersions(
      [saved],
      latestVersions.current,
      2000,
      retainedIds.current,
    );
    setActionMessage((previous) => updateActionMessage(previous, updates));
    setMessages((previous) =>
      archived.current
        ? mergeArchivedWindow(previous, updates)
        : mergeMessageWindow(previous, updates, 100),
    );
    setPinnedMessages((previous) =>
      archivedPins.current
        ? mergeArchivedWindow(previous, updates, true)
        : mergePinnedWindow(previous, updates, 100),
    );
  }, []);

  const handleSendMessage = async (
    content: string,
    replyToId?: string,
    attachmentIds?: string[],
  ) => {
    const channelId = selectedChannel.current;
    if (
      !pendingSend.current ||
      pendingSend.current.channelId !== channelId ||
      pendingSend.current.content !== content ||
      pendingSend.current.replyToId !== replyToId ||
      pendingSend.current.attachmentKey !== JSON.stringify(attachmentIds || [])
    )
      pendingSend.current = {
        channelId,
        content,
        replyToId,
        attachmentKey: JSON.stringify(attachmentIds || []),
        key: `mobile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`,
      };
    const saved = await api.sendMessage(channelId, content, {
      clientMutationId: pendingSend.current.key,
      replyToId,
      attachmentIds,
    });
    pendingSend.current = null;
    applyConfirmedMessage(saved);
    if (archived.current) await navigateHistory("latest");
  };

  const openSearchMessage = (channelId: string, messageId: string) => {
    selectChannel(channelId);
    abortHistoryRequests();
    syncCursor.current = null;
    archived.current = true;
    readCandidate.current = undefined;
    messageAnchor.current = { channelId, messageId };
    setArchive(true);
    setMessagesLoading(true);
    setPageRevision((value) => value + 1);
    setMessages([]);
    setHighlightedMessageId(messageId);
    setRetry((value) => value + 1);
  };

  const handleToggleReaction = useCallback(
    async (messageId: string, icon: string) => {
      const key = `${messageId}:${icon}`;
      if (pendingReactions.current.has(key)) return;
      pendingReactions.current.add(key);
      try {
        applyConfirmedMessage(await api.toggleReaction(messageId, icon));
      } catch (error: unknown) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Reaction failed. Please try again.",
        );
      } finally {
        pendingReactions.current.delete(key);
      }
    },
    [applyConfirmedMessage, setNotice],
  );

  const mutateMessage = useCallback(
    async (action: () => Promise<Message>) => {
      try {
        applyConfirmedMessage(await action());
      } catch (error: unknown) {
        if (error instanceof ApiError && error.status === 409)
          await requestRefresh.current?.();
        throw error;
      }
    },
    [applyConfirmedMessage],
  );

  const handleEditMessage = useCallback(
    (message: Message, content: string) =>
      mutateMessage(() =>
        api.editMessage(message.id, {
          content,
          expectedVersion: message.version,
        }),
      ),
    [mutateMessage],
  );

  const handleDeleteMessage = useCallback(
    (message: Message) =>
      mutateMessage(() => api.deleteMessage(message.id, message.version)),
    [mutateMessage],
  );

  const handlePinMessage = useCallback(
    (message: Message, isPinned: boolean) =>
      mutateMessage(() =>
        api.pinMessage(message.id, isPinned, message.version),
      ),
    [mutateMessage],
  );
  const setLoadedChannel = useCallback((room: Channel | null) => {
    setActiveChannel(room);
    selectedChannel.current = room?.id || "";
    setActiveChannelId(room?.id || "");
  }, []);
  const getSelectedChannelId = useCallback(() => selectedChannel.current, []);
  const updateChatProfile = (profile: User) => {
    const profiles = new Map([[profile.id, profile]]);
    setMessages((previous) => updateMessageProfiles(previous, profiles));
    setPinnedMessages((previous) => updateMessageProfiles(previous, profiles));
    setActionMessage((previous) =>
      previous ? updateMessageProfiles([previous], profiles)[0] : previous,
    );
  };
  const refreshMessages = () => requestRefresh.current?.();
  const setPinnedView = (pinned: boolean) => {
    showingPins.current = pinned;
    if (!pinned) {
      if (!archived.current) readCandidate.current = messages.at(-1);
      void refreshMessages();
    }
  };
  const resetChat = () => {
    abortHistoryRequests();
    latestVersions.current.clear();
    syncCursor.current = null;
    archived.current = false;
    archivedPins.current = false;
    setArchive(false);
    setPinsArchive(false);
    setHistoryPage(null);
    setPinPage(null);
    setActionMessage(null);
    setMessagesLoading(true);
    setPinsLoading(true);
    setMessages([]);
    setPinnedMessages([]);
    setRetry((value) => value + 1);
  };
  return {
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
  };
}
