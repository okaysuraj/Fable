import React, { useState, useRef, useEffect } from 'react';
import { Channel, Message, User, CallMode } from '../../types/chat';
import {
  IconHash,
  IconRadio,
  IconVideo,
  IconUsers,
  IconPin,
  IconPaperclip,
  IconSend,
  IconMic,
  IconPlay,
  IconPause,
  IconSparkle,
  IconHeart,
  IconCheck,
} from '../icons/Icons';

interface ChatViewProps {
  channel: Channel;
  messages: Message[];
  currentUser: User;
  onSendMessage: (content: string, voiceNote?: { duration: string; waveform: number[] }) => void;
  onToggleReaction: (messageId: string, icon: string) => void;
  onStartCall: (mode: 'audio' | 'video') => void;
  activeCallMode: CallMode;
  onToggleDrawer: () => void;
  isDrawerOpen: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({
  channel,
  messages,
  currentUser,
  onSendMessage,
  onToggleReaction,
  onStartCall,
  activeCallMode,
  onToggleDrawer,
  isDrawerOpen,
}) => {
  const [inputText, setInputText] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isRecordingVoice) {
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [isRecordingVoice]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const handleFinishVoiceRecord = () => {
    const mins = Math.floor(recordingSeconds / 60);
    const secs = recordingSeconds % 60;
    const duration = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    const waveform = Array.from({ length: 24 }, () => Math.floor(Math.random() * 70) + 25);
    onSendMessage('Voice Note', { duration, waveform });
    setIsRecordingVoice(false);
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const pinnedMessages = messages.filter((m) => m.isPinned);

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-[var(--bg-paper)] relative overflow-hidden">
      {/* Channel Header */}
      <header className="h-16 px-6 border-b-[3px] border-[var(--border)] bg-white flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 flex items-center justify-center border-[3px] border-[var(--border)]"
            style={{ background: channel.type === 'video' ? 'var(--accent-blue)' : channel.type === 'audio' ? 'var(--accent-green)' : 'var(--accent-yellow)', boxShadow: 'var(--shadow-sm)' }}
          >
            {channel.type === 'video' ? (
              <IconVideo size={16} />
            ) : channel.type === 'audio' ? (
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
            onClick={() => onStartCall('audio')}
            className={`brutal-btn brutal-btn-sm ${
              activeCallMode === 'audio' ? 'brutal-btn-green' : 'brutal-btn-outline'
            }`}
          >
            <IconRadio size={13} className={activeCallMode === 'audio' ? 'animate-pulse' : ''} />
            <span className="font-mono-code text-[10px]">HUDDLE</span>
          </button>

          <button
            onClick={() => onStartCall('video')}
            className={`brutal-btn brutal-btn-sm ${
              activeCallMode === 'video' ? 'brutal-btn-blue' : 'brutal-btn-outline'
            }`}
          >
            <IconVideo size={13} />
            <span className="font-mono-code text-[10px]">VIDEO</span>
          </button>

          <div className="w-[3px] h-5 bg-[var(--border)]" />

          <button
            onClick={onToggleDrawer}
            className={`brutal-btn brutal-btn-sm p-2 ${
              isDrawerOpen ? '' : 'brutal-btn-outline'
            }`}
          >
            <IconUsers size={15} />
          </button>
        </div>
      </header>

      {/* Pinned */}
      {pinnedMessages.length > 0 && (
        <div className="px-6 py-2.5 bg-[var(--bg-card-alt)] border-b-[3px] border-[var(--border)] flex items-center justify-between text-xs min-w-0">
          <div className="flex items-center gap-2 truncate min-w-0">
            <IconPin size={13} className="text-[var(--accent-orange)] shrink-0" />
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
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-1">
        {/* Welcome */}
        <div className="py-6 border-b-[3px] border-[var(--border)] border-dashed space-y-2 mb-6">
          <div
            className="w-12 h-12 flex items-center justify-center font-display text-2xl border-[3px] border-[var(--border)] mb-3"
            style={{ background: 'var(--accent-yellow)', boxShadow: 'var(--shadow)' }}
          >
            #
          </div>
          <h3 className="font-display text-3xl tracking-tight uppercase">
            #{channel.name}
          </h3>
          <p className="text-sm text-[var(--ink-secondary)] max-w-lg leading-relaxed font-medium">
            {channel.topic}. Messages and media in this room are synced and stored in Postgres.
          </p>
        </div>

        {/* Message Items */}
        {messages.map((msg, index) => {
          const isMe = msg.sender.id === currentUser.id;
          const prevMsg = messages[index - 1];
          const isSameSenderAsPrev = prevMsg && prevMsg.sender.id === msg.sender.id;

          return (
            <div
              key={msg.id}
              className={`group flex items-start gap-3.5 py-2 px-3 -mx-3 hover:bg-[var(--bg-card-alt)] transition-colors ${
                isSameSenderAsPrev ? '' : 'mt-4 pt-4 border-t-[2px] border-dashed border-[var(--ink-faint)]/30'
              }`}
            >
              {/* Avatar */}
              {!isSameSenderAsPrev ? (
                <div
                  className="w-9 h-9 flex items-center justify-center font-mono-code text-[11px] font-bold border-[3px] border-[var(--border)] shrink-0 mt-0.5"
                  style={{ background: isMe ? 'var(--accent-yellow)' : 'white' }}
                >
                  {msg.sender.monogram}
                </div>
              ) : (
                <div className="w-9 shrink-0 flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 text-[9px] font-mono-code text-[var(--ink-muted)] transition-opacity">
                    {msg.timestamp.split(' ')[0]}
                  </span>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {!isSameSenderAsPrev && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold uppercase tracking-tight">
                      {msg.sender.name}
                      {isMe && (
                        <span className="text-[10px] font-mono-code text-[var(--ink-muted)] ml-1 normal-case">(you)</span>
                      )}
                    </span>
                    <span className="text-[10px] font-mono-code text-[var(--ink-muted)]">
                      {msg.timestamp}
                    </span>
                    {msg.isPinned && (
                      <span className="brutal-tag text-[9px] py-0 px-1.5" style={{ background: 'var(--accent-orange)', color: 'white' }}>
                        <IconPin size={9} /> PINNED
                      </span>
                    )}
                  </div>
                )}

                <p className="text-[13px] leading-relaxed break-words">
                  {msg.content}
                </p>

                {/* Code Snippet */}
                {msg.codeSnippet && (
                  <div className="border-[3px] border-[var(--border)] overflow-hidden my-2 max-w-xl" style={{ boxShadow: 'var(--shadow-sm)' }}>
                    <div className="px-3 py-1.5 bg-[var(--ink)] text-white flex items-center justify-between text-[11px] font-mono-code">
                      <span className="uppercase">{msg.codeSnippet.language}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(msg.codeSnippet!.code)}
                        className="hover:text-[var(--accent-yellow)] transition-colors uppercase text-[10px] font-bold"
                      >
                        COPY
                      </button>
                    </div>
                    <pre className="p-3 text-xs font-mono-code bg-[#FAFAFA] overflow-x-auto leading-relaxed">
                      <code>{msg.codeSnippet.code}</code>
                    </pre>
                  </div>
                )}

                {/* Voice Note */}
                {msg.voiceNote && (
                  <div className="inline-flex items-center gap-3 px-4 py-3 border-[3px] border-[var(--border)] bg-white my-1 max-w-sm" style={{ boxShadow: 'var(--shadow-sm)' }}>
                    <button
                      onClick={() => setPlayingVoiceId(playingVoiceId === msg.id ? null : msg.id)}
                      className="w-9 h-9 flex items-center justify-center bg-[var(--ink)] text-white border-[2px] border-[var(--border)] shrink-0"
                    >
                      {playingVoiceId === msg.id ? <IconPause size={12} /> : <IconPlay size={12} className="ml-0.5" />}
                    </button>

                    <div className="flex items-center gap-0.5 h-6">
                      {msg.voiceNote.waveform.map((bar, i) => (
                        <div
                          key={i}
                          style={{ height: `${bar}%` }}
                          className={`w-1.5 transition-all duration-200 ${
                            playingVoiceId === msg.id && i < 12
                              ? 'bg-[var(--accent-green)]'
                              : 'bg-[var(--ink-faint)]'
                          }`}
                        />
                      ))}
                    </div>

                    <span className="text-[11px] font-mono-code text-[var(--ink-muted)] shrink-0 ml-1 font-bold">
                      {msg.voiceNote.duration}
                    </span>
                  </div>
                )}

                {/* Reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {msg.reactions.map((react, i) => (
                      <button
                        key={i}
                        onClick={() => onToggleReaction(msg.id, react.icon)}
                        className={`brutal-btn brutal-btn-sm py-0.5 px-2 text-[10px] ${
                          react.reactedByMe ? 'brutal-btn-green' : 'brutal-btn-outline'
                        }`}
                      >
                        {react.icon === 'sparkle' ? (
                          <IconSparkle size={10} />
                        ) : react.icon === 'heart' ? (
                          <IconHeart size={10} />
                        ) : (
                          <IconCheck size={10} />
                        )}
                        <span className="font-bold">{react.count}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Hover actions */}
              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity self-start mt-1">
                <button
                  onClick={() => onToggleReaction(msg.id, 'sparkle')}
                  className="brutal-btn brutal-btn-outline brutal-btn-sm p-1"
                >
                  <IconSparkle size={12} />
                </button>
                <button
                  onClick={() => onToggleReaction(msg.id, 'heart')}
                  className="brutal-btn brutal-btn-outline brutal-btn-sm p-1"
                >
                  <IconHeart size={12} />
                </button>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <footer className="p-4 border-t-[3px] border-[var(--border)] bg-white shrink-0">
        {isRecordingVoice ? (
          <div className="flex items-center justify-between p-3 border-[3px] border-[var(--accent-pink)] bg-[#FFE0E9]">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-[var(--accent-pink)] animate-ping" />
              <div>
                <p className="text-xs font-bold uppercase text-[var(--accent-pink)]">
                  RECORDING VOICE...
                </p>
                <p className="text-[11px] font-mono-code text-[var(--ink-secondary)]">
                  {formatSecs(recordingSeconds)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRecordingVoice(false)}
                className="brutal-btn brutal-btn-outline brutal-btn-sm"
              >
                CANCEL
              </button>
              <button
                onClick={handleFinishVoiceRecord}
                className="brutal-btn brutal-btn-pink brutal-btn-sm"
              >
                <IconSend size={12} />
                SEND
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-2">
            <div className="flex items-end gap-2 border-[3px] border-[var(--border)] p-2 bg-white focus-within:shadow-[var(--shadow)] transition-shadow">
              <button
                type="button"
                onClick={() => alert('Attachments: drag & drop files here.')}
                title="Attach file"
                className="brutal-btn brutal-btn-outline brutal-btn-sm p-2 shrink-0"
              >
                <IconPaperclip size={15} />
              </button>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e);
                  }
                }}
                rows={1}
                placeholder={`Message #${channel.name}...`}
                className="flex-1 max-h-32 bg-transparent text-sm font-medium focus:outline-none resize-none py-1.5 leading-relaxed placeholder:text-[var(--ink-muted)] placeholder:uppercase placeholder:text-xs placeholder:font-bold placeholder:tracking-wider"
              />

              <button
                type="button"
                onClick={() => setIsRecordingVoice(true)}
                title="Record voice note"
                className="brutal-btn brutal-btn-outline brutal-btn-sm p-2 shrink-0"
              >
                <IconMic size={15} />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`brutal-btn brutal-btn-sm p-2 shrink-0 ${
                  inputText.trim() ? '' : 'opacity-40 cursor-not-allowed'
                }`}
              >
                <IconSend size={14} />
              </button>
            </div>

            <div className="flex items-center justify-between font-mono-code text-[10px] text-[var(--ink-muted)] uppercase tracking-wider px-1">
              <span>SHIFT+ENTER FOR NEWLINE</span>
              <span>ENCRYPTED DISPATCH</span>
            </div>
          </form>
        )}
      </footer>
    </div>
  );
};
