import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { Channel, Message, User } from "../../types/chat";
import {
  api,
  ApiError,
  type HistoryQuery,
  type MessagePage,
} from "../../services/api";
import { mergeHistory, mergePins } from "./messageState";
interface Options {
  activeChannelId: string;
  reload: number;
  historySelection: number;
  pendingAnchorRef: RefObject<{ channelId: string; messageId: string } | null>;
  report: (error: unknown) => void;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
  onRoomUpdated: (room: Channel) => void;
  onAccessLost: (isCurrent: () => boolean) => Promise<void>;
}
/** Owns one room's bounded message/pin windows, version reconciliation and read progress. */
export function useChannelMessages({
  activeChannelId,
  reload,
  historySelection,
  pendingAnchorRef,
  report,
  setError,
  setNotice,
  onRoomUpdated,
  onAccessLost,
}: Options) {
  const activeRef = useRef(activeChannelId);
  activeRef.current = activeChannelId;
  // Parent callbacks may change without restarting the polling cursor or losing drafts.
  const callbacks = useRef({ onRoomUpdated, onAccessLost });
  callbacks.current = { onRoomUpdated, onAccessLost };
  const [anchorMessageId, setAnchorMessageId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pins, setPins] = useState<Message[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsReady, setPinsReady] = useState(false);
  const [pinsHasMore, setPinsHasMore] = useState(false);
  const changeCursorRef = useRef<string | null>(null);
  const pinCheckpointRef = useRef<string | null>(null);
  const [actionMessage, setActionMessage] = useState<Message | undefined>();
  const actionMessageRef = useRef(actionMessage);
  actionMessageRef.current = actionMessage;
  const [hasMore, setHasMore] = useState(false);
  const [hasNewer, setHasNewer] = useState(false);
  const [archiveMode, setArchiveMode] = useState(false);
  const archiveRef = useRef(false);
  const [pinsArchive, setPinsArchive] = useState(false);
  const pinsArchiveRef = useRef(false);
  const [pinsHasNewer, setPinsHasNewer] = useState(false);
  const historyEdges = useRef<MessagePage | null>(null);
  const pinEdges = useRef<MessagePage | null>(null);
  const historyRequestRef = useRef(0);
  const pinRequestRef = useRef(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const lastReadRef = useRef<string | undefined>(undefined);
  const revisionsRef = useRef(
    new Map<string, { version: number; epoch: number }>(),
  );
  const revisionEpochRef = useRef(0);
  const evictionEpochRef = useRef(0);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const pinsRef = useRef(pins);
  pinsRef.current = pins;

  const reconcileVersions = useCallback((updates: Message[]) => {
    const accepted = updates.filter(
      (message) =>
        message.version >= (revisionsRef.current.get(message.id)?.version || 0),
    );
    for (const message of accepted) {
      const known = revisionsRef.current.get(message.id);
      if (!known || message.version > known.version) {
        revisionsRef.current.delete(message.id);
        revisionsRef.current.set(message.id, {
          version: message.version,
          epoch: ++revisionEpochRef.current,
        });
      }
    }
    const protectedIds = new Set(
      [...messagesRef.current, ...pinsRef.current].map((message) => message.id),
    );
    if (actionMessageRef.current) protectedIds.add(actionMessageRef.current.id);
    for (const [id, revision] of revisionsRef.current) {
      if (revisionsRef.current.size <= 2500) break;
      if (!protectedIds.has(id)) {
        revisionsRef.current.delete(id);
        evictionEpochRef.current = Math.max(
          evictionEpochRef.current,
          revision.epoch,
        );
      }
    }
    return accepted;
  }, []);

  const includePinCheckpoint = useCallback((cursor?: string) => {
    if (!cursor) return;
    if (
      !pinCheckpointRef.current ||
      BigInt(cursor) < BigInt(pinCheckpointRef.current)
    )
      pinCheckpointRef.current = cursor;
    if (
      changeCursorRef.current &&
      BigInt(cursor) < BigInt(changeCursorRef.current)
    )
      changeCursorRef.current = cursor;
  }, []);

  // A slower page must never resurrect a version already replaced by a mutation.
  const loadMessagePage = useCallback(
    async (id: string, options?: HistoryQuery, pinned = false) => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const epoch = revisionEpochRef.current;
        const page = await (pinned
          ? api.fetchChannelPins(id, options)
          : api.fetchMessagePage(id, options));
        if (activeRef.current !== id) return null;
        if (epoch < evictionEpochRef.current) continue;
        const accepted = reconcileVersions(page.data);
        if (accepted.length !== page.data.length) continue;
        return { ...page, data: accepted };
      }
      throw new Error(
        pinned
          ? "Pinned messages changed while loading. Please retry."
          : "Messages changed while loading. Please retry.",
      );
    },
    [reconcileVersions],
  );

  const applyUpdates = useCallback(
    (updates: Message[]) => {
      const accepted = reconcileVersions(updates);
      const retained = messagesRef.current;
      if (
        !archiveRef.current &&
        retained.length +
          accepted.filter(
            (message) =>
              !retained.some((old) => old.id === message.id) &&
              message.timestamp >= (retained[0]?.timestamp || ""),
          ).length >
          50
      )
        setHasMore(true);
      if (
        archiveRef.current &&
        accepted.some(
          (message) => message.timestamp > (retained.at(-1)?.timestamp || ""),
        )
      )
        setHasNewer(true);
      setMessages((previous) =>
        mergeHistory(previous, accepted, !archiveRef.current),
      );
      setPins((previous) =>
        mergePins(previous, accepted, !pinsArchiveRef.current),
      );
      setActionMessage((previous) =>
        previous
          ? accepted.find(
              (message) =>
                message.id === previous.id &&
                message.version >= previous.version,
            ) || previous
          : previous,
      );
    },
    [reconcileVersions],
  );

  useEffect(() => {
    let alive = true;
    let timer: number | undefined;
    setMessages([]);
    setHistoryLoading(false);
    setHasMore(false);
    setHasNewer(false);
    const anchor =
      pendingAnchorRef.current?.channelId === activeChannelId
        ? pendingAnchorRef.current.messageId
        : undefined;
    pendingAnchorRef.current = null;
    setAnchorMessageId(anchor);
    setArchiveMode(!!anchor);
    archiveRef.current = !!anchor;
    historyEdges.current = null;
    historyRequestRef.current += 1;
    setActionMessage(undefined);
    lastReadRef.current = undefined;
    changeCursorRef.current = null;
    pinCheckpointRef.current = null;
    revisionsRef.current.clear();
    revisionEpochRef.current = 0;
    evictionEpochRef.current = 0;
    if (!activeChannelId) return;
    const refresh = async () => {
      try {
        if (!document.hidden && alive) {
          let latest: Message | undefined;
          if (!changeCursorRef.current) {
            const page = await loadMessagePage(
              activeChannelId,
              anchor ? { around: anchor } : undefined,
            );
            if (!alive || !page) return;
            setMessages((previous) => mergeHistory(previous, page.data));
            setHasMore(page.hasOlder);
            setHasNewer(page.hasNewer);
            historyEdges.current = page;
            changeCursorRef.current = page.changeCursor || null;
            includePinCheckpoint(pinCheckpointRef.current || undefined);
            latest = page.data.at(-1);
          } else {
            for (let index = 0; index < 5; index += 1) {
              const requestedAfter: string = changeCursorRef.current!;
              const page = await api.fetchMessageChanges(
                activeChannelId,
                requestedAfter,
              );
              if (!alive) return;
              applyUpdates(page.data);
              if (changeCursorRef.current === requestedAfter)
                changeCursorRef.current = page.changeCursor;
              for (const message of archiveRef.current ? [] : page.data) {
                if (
                  !latest ||
                  message.timestamp > latest.timestamp ||
                  (message.timestamp === latest.timestamp &&
                    message.id > latest.id)
                )
                  latest = message;
              }
              if (!page.hasMore) break;
            }
          }
          const retained = messagesRef.current.at(-1);
          if (
            retained &&
            (!latest ||
              retained.timestamp > latest.timestamp ||
              (retained.timestamp === latest.timestamp &&
                retained.id > latest.id))
          )
            latest = retained;
          if (
            !archiveRef.current &&
            latest &&
            latest.id !== lastReadRef.current
          ) {
            await api.markChannelRead(activeChannelId, latest.id);
            const room = await api.fetchChannel(activeChannelId);
            if (alive) {
              lastReadRef.current = latest.id;
              callbacks.current.onRoomUpdated(room);
            }
          }
        }
      } catch (err) {
        if (alive) {
          if (err instanceof ApiError && [403, 404].includes(err.status)) {
            setMessages([]);
            setPins([]);
            setActionMessage(undefined);
            try {
              await callbacks.current.onAccessLost(() => alive);
            } catch (refreshError) {
              if (alive) report(refreshError);
            }
          } else report(err);
        }
      } finally {
        if (alive) timer = window.setTimeout(refresh, 5000);
      }
    };
    void refresh();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [
    activeChannelId,
    reload,
    historySelection,
    report,
    applyUpdates,
    loadMessagePage,
  ]);

  useEffect(() => {
    let alive = true;
    setPins([]);
    setPinsReady(false);
    setPinsHasMore(false);
    setPinsHasNewer(false);
    setPinsArchive(false);
    pinsArchiveRef.current = false;
    pinEdges.current = null;
    pinRequestRef.current += 1;
    if (!activeChannelId) return;
    setPinsLoading(true);
    loadMessagePage(activeChannelId, undefined, true)
      .then((page) => {
        if (!alive || !page) return;
        const accepted = page.data;
        includePinCheckpoint(page.changeCursor);
        setPins((previous) => mergePins(previous, accepted));
        setPinsReady(true);
        setPinsHasMore(page.hasMore);
        setPinsHasNewer(page.hasNewer);
        pinEdges.current = page;
      })
      .catch((err) => {
        if (alive) report(err);
      })
      .finally(() => {
        if (alive) setPinsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [activeChannelId, reload, report, loadMessagePage]);

  const handleSend = async (content: string, clientMutationId: string) => {
    const id = activeChannelId;
    try {
      const saved = await api.sendMessage(id, content, { clientMutationId });
      if (activeRef.current === id) applyUpdates([saved]);
      if (archiveRef.current && activeRef.current === id)
        await loadHistory("latest");
      setError("");
    } catch (err) {
      report(err);
      throw err;
    }
  };

  const react = async (id: string, icon: string) => {
    const channelId = activeChannelId;
    try {
      const saved = await api.toggleReaction(id, icon);
      if (activeRef.current === channelId) applyUpdates([saved]);
    } catch (err) {
      report(err);
    }
  };

  const messageMutation = async (
    message: Message,
    action: () => Promise<Message>,
    confirmation: string,
  ) => {
    if (message.channelId !== activeRef.current)
      throw new Error("Select this room before updating its message.");
    try {
      const saved = await action();
      if (activeRef.current === message.channelId) {
        applyUpdates([saved]);
        setNotice(confirmation);
        setError("");
      }
    } catch (err) {
      report(err);
      throw err;
    }
  };

  const editMessage = (message: Message, content: string) =>
    messageMutation(
      message,
      () => api.editMessage(message.id, content, message.version),
      "Message updated.",
    );

  const deleteMessage = (message: Message) =>
    messageMutation(
      message,
      () => api.deleteMessage(message.id, message.version),
      "Message deleted.",
    );

  const pinMessage = (message: Message, pinned: boolean) =>
    messageMutation(
      message,
      () => api.pinMessage(message.id, pinned, message.version),
      pinned ? "Message pinned." : "Message unpinned.",
    );

  const browsePins = async (direction: "older" | "newer" | "latest") => {
    if (pinsLoading) return;
    const id = activeChannelId;
    const options =
      direction === "older"
        ? {
            before:
              pinsRef.current.at(-1)?.id ||
              pinEdges.current?.olderCursor ||
              pinEdges.current?.data[0]?.id,
          }
        : direction === "newer"
          ? {
              after:
                pinsRef.current[0]?.id ||
                pinEdges.current?.newerCursor ||
                pinEdges.current?.data.at(-1)?.id,
            }
          : undefined;
    if (direction !== "latest" && !Object.values(options || {}).some(Boolean))
      return;
    const request = ++pinRequestRef.current;
    setPinsLoading(true);
    try {
      const page = await loadMessagePage(id, options, true);
      if (
        !page ||
        activeRef.current !== id ||
        request !== pinRequestRef.current
      )
        return;
      const accepted = page.data;
      includePinCheckpoint(page.changeCursor);
      if (activeRef.current === id) {
        setPins(mergePins([], accepted));
        setPinsHasMore(page.hasOlder);
        setPinsHasNewer(page.hasNewer);
        const archived = direction !== "latest" && page.hasNewer;
        setPinsArchive(archived);
        pinsArchiveRef.current = archived;
        pinEdges.current = page;
        setPinsReady(true);
      }
    } catch (err) {
      if (activeRef.current === id && request === pinRequestRef.current)
        report(err);
    } finally {
      if (activeRef.current === id && request === pinRequestRef.current)
        setPinsLoading(false);
    }
  };

  const reloadPins = () => browsePins("latest");

  const loadHistory = async (direction: "older" | "newer" | "latest") => {
    if (historyLoading) return;
    const id = activeChannelId;
    setAnchorMessageId(undefined);
    const options =
      direction === "older"
        ? {
            before:
              messagesRef.current[0]?.id ||
              historyEdges.current?.olderCursor ||
              undefined,
          }
        : direction === "newer"
          ? {
              after:
                messagesRef.current.at(-1)?.id ||
                historyEdges.current?.newerCursor ||
                undefined,
            }
          : undefined;
    if (direction !== "latest" && !Object.values(options || {}).some(Boolean))
      return;
    const request = ++historyRequestRef.current;
    const previousArchive = archiveRef.current;
    archiveRef.current = true;
    setHistoryLoading(true);
    try {
      const page = await loadMessagePage(id, options);
      if (
        activeRef.current === id &&
        page &&
        request === historyRequestRef.current
      ) {
        setMessages(page.data);
        setHasMore(page.hasOlder);
        setHasNewer(page.hasNewer);
        historyEdges.current = page;
        const archived = direction !== "latest" && page.hasNewer;
        archiveRef.current = archived;
        setArchiveMode(archived);
        if (!archived) {
          changeCursorRef.current = page.changeCursor;
          includePinCheckpoint(pinCheckpointRef.current || undefined);
        }
      }
    } catch (err) {
      if (activeRef.current === id && request === historyRequestRef.current) {
        archiveRef.current = previousArchive;
        report(err);
      }
    } finally {
      if (activeRef.current === id && request === historyRequestRef.current)
        setHistoryLoading(false);
    }
  };
  const resetMessages = () => {
    setMessages([]);
    setPins([]);
    setActionMessage(undefined);
  };
  const updateMessageProfile = (user: User) => {
    const update = (rows: Message[]) =>
      rows.map((message) =>
        message.sender.id === user.id ? { ...message, sender: user } : message,
      );
    setMessages(update);
    setPins(update);
  };
  const retainedAuthorIds = () => [
    ...new Set(
      [
        ...messagesRef.current,
        ...pinsRef.current,
        ...(actionMessageRef.current ? [actionMessageRef.current] : []),
      ].map((message) => message.sender.id),
    ),
  ];
  return {
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
  };
}
