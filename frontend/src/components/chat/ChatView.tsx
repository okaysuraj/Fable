/** Render one bounded conversation window and retain the draft until the server confirms sending. */
import React, { useState, useRef, useEffect } from "react";
import { Channel, Message, User } from "../../types/chat";
import {
  IconHash,
  IconRadio,
  IconVideo,
  IconUsers,
  IconPin,
  IconSend,
  IconSparkle,
  IconHeart,
  IconCheck,
  IconSearch,
} from "../icons/Icons";

const additionalReactionSymbols: Record<string, string> = {
  "thumbs-up": "👍",
  laugh: "😄",
  eyes: "👀",
};
const timestampFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? timestamp
    : timestampFormatter.format(date);
};

interface ChatViewProps {
  hasMore: boolean;
  historyLoading: boolean;
  onLoadOlder: () => void;
  hasNewer: boolean;
  archiveMode: boolean;
  onLoadNewer: () => void;
  onLoadLatest: () => void;
  channel: Channel;
  messages: Message[];
  pins: Message[];
  onMessageActions: (message: Message) => void;
  currentUser: User;
  onSendMessage: (content: string, clientMutationId: string) => Promise<void>;
  onToggleReaction: (messageId: string, icon: string) => void;
  onSearchMessages: () => void;
  anchorMessageId?: string;
  onToggleDrawer: () => void;
  isDrawerOpen: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  channel,
  hasMore,
  historyLoading,
  onLoadOlder,
  hasNewer,
  archiveMode,
  onLoadNewer,
  onLoadLatest,
  messages,
  pins,
  onMessageActions,
  currentUser,
  onSendMessage,
  onToggleReaction,
  onSearchMessages,
  anchorMessageId,
  onToggleDrawer,
  isDrawerOpen,
}) => {
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageScrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const previousChannelRef = useRef(channel.id);
  const previousFirstRef = useRef<string | undefined>(undefined);
  const pendingSend = useRef<{
    channelId: string;
    content: string;
    id: string;
  } | null>(null);
  useEffect(() => {
    const area = messageScrollRef.current;
    const changedChannel = previousChannelRef.current !== channel.id;
    previousChannelRef.current = channel.id;
    if (changedChannel) {
      setInputText("");
      setSendError("");
      setCopyStatus("");
      pendingSend.current = null;
      nearBottomRef.current = true;
    }
    if (!area) return;
    const changedPage = previousFirstRef.current !== messages[0]?.id;
    previousFirstRef.current = messages[0]?.id;
    if (archiveMode && changedPage) {
      const anchor = anchorMessageId
        ? Array.from(
            area.querySelectorAll<HTMLElement>("[data-message-id]"),
          ).find((element) => element.dataset.messageId === anchorMessageId)
        : undefined;
      if (anchor) anchor.scrollIntoView({ block: "center", behavior: "auto" });
      else area.scrollTop = 0;
      nearBottomRef.current = false;
    } else if (
      !archiveMode &&
      (changedChannel || changedPage || nearBottomRef.current)
    ) {
      messagesEndRef.current?.scrollIntoView({
        behavior: "auto",
        block: "end",
      });
    }
  }, [messages, channel.id, archiveMode, anchorMessageId]);
  const handleSend = async (event: React.FormEvent | React.KeyboardEvent) => {
    event.preventDefault();
    if (!inputText.trim() || sending || channel.type !== "text") return;
    const content = inputText.trim();
    const channelId = channel.id;
    if (
      !pendingSend.current ||
      pendingSend.current.content !== content ||
      pendingSend.current.channelId !== channelId
    ) {
      pendingSend.current = { channelId, content, id: crypto.randomUUID() };
    }
    setSending(true);
    setSendError("");
    try {
      await onSendMessage(content, pendingSend.current.id);
      if (previousChannelRef.current === channelId) {
        setInputText("");
        pendingSend.current = null;
      }
    } catch (error) {
      setSendError(
        error instanceof Error
          ? error.message
          : "Message was not sent. Please retry.",
      );
    } finally {
      setSending(false);
    }
  };

  const pinnedMessages = pins;
  const copyCode = async (code: string) => {
    try {
      if (!navigator.clipboard)
        throw new Error(
          "Clipboard access is unavailable. Select and copy the code directly.",
        );
      await navigator.clipboard.writeText(code);
      setCopyStatus("Code copied.");
    } catch (err) {
      setCopyStatus(
        err instanceof Error ? err.message : "The code could not be copied.",
      );
    }
  };

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-[var(--bg-paper)] relative overflow-hidden">
      {/* Channel Header */}
      <header className="h-16 px-6 border-b-[3px] border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 flex items-center justify-center border-[3px] border-[var(--border)]"
            style={{
              background:
                channel.type === "video"
                  ? "var(--accent-blue)"
                  : channel.type === "audio"
                    ? "var(--accent-green)"
                    : "var(--accent-yellow)",
              color: "#1a1a1a",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {channel.type === "video" ? (
              <IconVideo size={16} />
            ) : channel.type === "audio" ? (
              <IconRadio size={16} />
            ) : (
              <IconHash size={16} />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base tracking-tight truncate uppercase">
              #{channel.name}
            </h2>
            <p className="text-[11px] font-mono-code text-[var(--ink-muted)] truncate">
              {channel.topic}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            aria-label="Search messages"
            onClick={onSearchMessages}
            className="brutal-btn brutal-btn-outline brutal-btn-sm p-2"
          >
            <IconSearch size={15} />
            <span className="font-mono-code text-[10px]">Search</span>
          </button>
          <button
            onClick={onToggleDrawer}
            aria-label="Room information"
            aria-expanded={isDrawerOpen}
            className={`brutal-btn brutal-btn-sm p-2 ${
              isDrawerOpen ? "" : "brutal-btn-outline"
            }`}
          >
            <IconUsers size={15} />
          </button>
        </div>
      </header>

      {/* Pinned */}
      {copyStatus && (
        <div
          role="status"
          className="px-4 py-2 text-xs border-b-[2px] flex gap-2"
        >
          <span className="flex-1">{copyStatus}</span>
          <button
            className="font-bold"
            aria-label="Dismiss clipboard message"
            onClick={() => setCopyStatus("")}
          >
            Close
          </button>
        </div>
      )}
      {pinnedMessages.length > 0 && (
        <div className="px-6 py-2.5 bg-[var(--bg-card-alt)] border-b-[3px] border-[var(--border)] flex items-center justify-between text-xs min-w-0">
          <div className="flex items-center gap-2 truncate min-w-0">
            <IconPin
              size={13}
              className="text-[var(--accent-orange)] shrink-0"
            />
            <span className="font-display uppercase text-[10px] tracking-wider text-[var(--ink-muted)] shrink-0">
              PINNED:
            </span>
            <span className="truncate font-bold">
              "{pinnedMessages[0].content}"
            </span>
          </div>
          <span className="font-mono-code text-[10px] text-[var(--ink-muted)] shrink-0 ml-2">
            by {pinnedMessages[0].sender.name}
          </span>
        </div>
      )}

      {/* Messages */}
      <nav
        aria-label="Message history"
        className="px-4 py-2 border-b-[2px] bg-[var(--bg-card)] flex flex-wrap gap-2 shrink-0"
      >
        {hasMore && (
          <button
            className="brutal-btn brutal-btn-sm"
            disabled={historyLoading}
            onClick={onLoadOlder}
          >
            Earlier messages
          </button>
        )}
        {hasNewer && (
          <button
            className="brutal-btn brutal-btn-sm"
            disabled={historyLoading}
            onClick={onLoadNewer}
          >
            Newer messages
          </button>
        )}
        {archiveMode && (
          <button
            className="brutal-btn brutal-btn-sm"
            disabled={historyLoading}
            onClick={onLoadLatest}
          >
            Latest messages
          </button>
        )}
        {historyLoading && (
          <span role="status" className="text-xs my-auto">
            Loading messages...
          </span>
        )}
        {archiveMode && (
          <span className="text-xs my-auto">Viewing earlier messages</span>
        )}
      </nav>
      <div
        ref={messageScrollRef}
        onScroll={(event) => {
          const area = event.currentTarget;
          nearBottomRef.current =
            area.scrollHeight - area.scrollTop - area.clientHeight < 180;
        }}
        className="message-scroll flex-1 overflow-y-auto px-6 py-6 space-y-1"
      >
        {/* Welcome */}
        <div className="py-6 border-b-[3px] border-[var(--border)] border-dashed space-y-2 mb-6">
          <div
            className="w-12 h-12 flex items-center justify-center font-display text-2xl border-[3px] border-[var(--border)] mb-3"
            style={{
              background: "var(--accent-yellow)",
              color: "#1a1a1a",
              boxShadow: "var(--shadow)",
            }}
          >
            #
          </div>
          <h3 className="font-display text-3xl tracking-tight uppercase">
            #{channel.name}
          </h3>
          <p className="text-sm text-[var(--ink-secondary)] max-w-lg leading-relaxed font-medium">
            {channel.topic || "Start a conversation in this room."}
          </p>
        </div>

        {/* Message Items */}
        {messages.map((msg, index) => {
          const isMe = msg.sender.id === currentUser.id;
          const prevMsg = messages[index - 1];
          const isSameSenderAsPrev =
            prevMsg && prevMsg.sender.id === msg.sender.id;

          return (
            <div
              data-message-id={msg.id}
              key={msg.id}
              aria-label={
                msg.id === anchorMessageId ? "Search result message" : undefined
              }
              className={`message-row group flex items-start gap-3.5 py-2 px-3 -mx-3 hover:bg-[var(--bg-card-alt)] transition-colors ${
                isSameSenderAsPrev
                  ? ""
                  : "mt-4 pt-4 border-t-[2px] border-dashed border-[var(--ink-faint)]/30"
              } ${msg.id === anchorMessageId ? "outline outline-2 outline-[var(--accent-blue)] bg-[var(--bg-card-alt)]" : ""}`}
            >
              {/* Avatar */}
              {!isSameSenderAsPrev ? (
                <div
                  className="w-9 h-9 flex items-center justify-center font-mono-code text-[11px] font-bold border-[3px] border-[var(--border)] shrink-0 mt-0.5"
                  style={{
                    background: isMe
                      ? "var(--accent-yellow)"
                      : "var(--bg-card)",
                    color: isMe ? "#1a1a1a" : "var(--ink)",
                  }}
                >
                  {msg.sender.monogram}
                </div>
              ) : (
                <div className="w-9 shrink-0 flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 text-[9px] font-mono-code text-[var(--ink-muted)] transition-opacity">
                    {formatTimestamp(msg.timestamp)}
                  </span>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {!isSameSenderAsPrev && (
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="min-w-0 break-words text-sm font-bold uppercase tracking-tight">
                      {msg.sender.name}
                      {isMe && (
                        <span className="text-[10px] font-mono-code text-[var(--ink-muted)] ml-1 normal-case">
                          (you)
                        </span>
                      )}
                    </span>
                    <span className="text-[10px] font-mono-code text-[var(--ink-muted)]">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                    {msg.isPinned && (
                      <span
                        className="brutal-tag text-[9px] py-0 px-1.5"
                        style={{
                          background: "var(--accent-orange)",
                          color: "white",
                        }}
                      >
                        <IconPin size={9} /> PINNED
                      </span>
                    )}
                  </div>
                )}

                <p className="text-[13px] leading-relaxed break-words">
                  {msg.deletedAt ? "Deleted message" : msg.content}
                </p>
                {msg.editedAt && !msg.deletedAt && (
                  <p className="text-[10px] text-[var(--ink-secondary)]">
                    Edited
                  </p>
                )}

                {/* Code Snippet */}
                {msg.codeSnippet && !msg.deletedAt && (
                  <div
                    className="border-[3px] border-[var(--border)] overflow-hidden my-2 max-w-xl"
                    style={{ boxShadow: "var(--shadow-sm)" }}
                  >
                    <div className="px-3 py-1.5 bg-[#242424] text-white flex items-center justify-between text-[11px] font-mono-code">
                      <span className="uppercase">
                        {msg.codeSnippet.language}
                      </span>
                      <button
                        onClick={() => {
                          if (msg.codeSnippet)
                            void copyCode(msg.codeSnippet.code);
                        }}
                        className="hover:text-[var(--accent-yellow)] transition-colors uppercase text-[10px] font-bold"
                      >
                        COPY
                      </button>
                    </div>
                    <pre className="p-3 text-xs font-mono-code bg-[var(--bg-card-alt)] overflow-x-auto leading-relaxed">
                      <code>{msg.codeSnippet.code}</code>
                    </pre>
                  </div>
                )}

                {/* Reactions */}
                {!msg.deletedAt &&
                  msg.reactions &&
                  msg.reactions.length > 0 && (
                    <div className="message-reactions flex flex-wrap items-center gap-1.5 pt-1">
                      {msg.reactions.map((react, i) => (
                        <button
                          key={i}
                          aria-label={`${react.reactedByMe ? "Remove" : "Add"} ${react.icon} reaction (${react.count})`}
                          onClick={() => onToggleReaction(msg.id, react.icon)}
                          className={`brutal-btn brutal-btn-sm py-0.5 px-2 text-[10px] ${
                            react.reactedByMe
                              ? "brutal-btn-green"
                              : "brutal-btn-outline"
                          }`}
                        >
                          {react.icon === "sparkle" ? (
                            <IconSparkle size={10} />
                          ) : react.icon === "heart" ? (
                            <IconHeart size={10} />
                          ) : react.icon === "check" ? (
                            <IconCheck size={10} />
                          ) : (
                            <span aria-hidden="true">
                              {additionalReactionSymbols[react.icon] ||
                                react.icon}
                            </span>
                          )}
                          <span className="font-bold">{react.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              {!msg.deletedAt && (
                <div className="message-actions flex items-center gap-1 self-start mt-1">
                  <button
                    aria-label="React with sparkle"
                    onClick={() => onToggleReaction(msg.id, "sparkle")}
                    className="brutal-btn brutal-btn-outline brutal-btn-sm p-1"
                  >
                    <IconSparkle size={12} />
                  </button>
                  <button
                    aria-label="React with heart"
                    onClick={() => onToggleReaction(msg.id, "heart")}
                    className="brutal-btn brutal-btn-outline brutal-btn-sm p-1"
                  >
                    <IconHeart size={12} />
                  </button>
                  {(msg.canEdit || msg.canDelete || msg.canPin) && (
                    <button
                      aria-label="Message actions"
                      className="brutal-btn brutal-btn-outline brutal-btn-sm p-1"
                      onClick={() => onMessageActions(msg)}
                    >
                      ...
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <footer className="p-4 border-t-[3px] border-[var(--border)] bg-[var(--bg-card)] shrink-0">
        {channel.type !== "text" && (
          <p role="status" className="mb-3 text-sm">
            Live audio and video are unavailable until the calling service is
            configured. Choose a text room to send messages.
          </p>
        )}
        <form onSubmit={handleSend} className="space-y-2">
          {sendError && (
            <p role="alert" className="text-sm text-[var(--ink)]">
              {sendError}
            </p>
          )}
          <div className="flex items-end gap-2 border-[3px] border-[var(--border)] p-2 bg-[var(--bg-card)] focus-within:shadow-[var(--shadow)] transition-shadow">
            <textarea
              disabled={channel.type !== "text"}
              aria-label={`Message #${channel.name}`}
              maxLength={10000}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              rows={1}
              placeholder={`Message #${channel.name}...`}
              className="flex-1 max-h-32 bg-transparent text-sm font-medium focus:outline-none resize-none py-1.5 leading-relaxed placeholder:text-[var(--ink-muted)] placeholder:uppercase placeholder:text-xs placeholder:font-bold placeholder:tracking-wider"
            />

            <button
              type="submit"
              aria-label={sending ? "Sending message" : "Send message"}
              disabled={!inputText.trim() || sending || channel.type !== "text"}
              className={`brutal-btn brutal-btn-sm p-2 shrink-0 ${
                inputText.trim() ? "" : "opacity-40 cursor-not-allowed"
              }`}
            >
              <IconSend size={14} />
            </button>
          </div>

          <div className="flex items-center justify-between font-mono-code text-[10px] text-[var(--ink-muted)] uppercase tracking-wider px-1">
            <span>SHIFT+ENTER FOR NEWLINE</span>
            <span>{sending ? "SENDING..." : "TEXT MESSAGES"}</span>
          </div>
        </form>
      </footer>
    </div>
  );
};
