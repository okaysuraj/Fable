import React from 'react';
import { Channel, Message, User, CallParticipant, CallMode } from '../types/chat';
import { ChatView } from './chat/ChatView';
import { AudioHuddleStage } from './audio/AudioHuddleStage';
import { VideoCallStage } from './video/VideoCallStage';
import {
  IconMic,
  IconMicOff,
  IconPhoneOff,
  IconMaximize,
  IconWaveform,
} from './icons/Icons';

interface MainStageProps {
  channel: Channel;
  messages: Message[];
  currentUser: User;
  onSendMessage: (content: string, voiceNote?: { duration: string; waveform: number[] }) => void;
  onToggleReaction: (messageId: string, icon: string) => void;
  callMode: CallMode;
  onStartCall: (mode: 'audio' | 'video') => void;
  onLeaveCall: () => void;
  participants: CallParticipant[];
  isMuted: boolean;
  onToggleMute: () => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
  isVideoOn: boolean;
  onToggleVideo: () => void;
  isPiP: boolean;
  setIsPiP: (val: boolean) => void;
  onToggleDrawer: () => void;
  isDrawerOpen: boolean;
}

export const MainStage: React.FC<MainStageProps> = ({
  channel,
  messages,
  currentUser,
  onSendMessage,
  onToggleReaction,
  callMode,
  onStartCall,
  onLeaveCall,
  participants,
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  isVideoOn,
  onToggleVideo,
  isPiP,
  setIsPiP,
  onToggleDrawer,
  isDrawerOpen,
}) => {
  if (callMode === 'audio' && !isPiP) {
    return (
      <AudioHuddleStage
        channel={channel}
        participants={participants}
        currentUser={currentUser}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        isDeafened={isDeafened}
        onToggleDeafen={onToggleDeafen}
        onLeaveCall={onLeaveCall}
        onUpgradeToVideo={() => onStartCall('video')}
        onMinimizeToPiP={() => setIsPiP(true)}
      />
    );
  }

  if (callMode === 'video' && !isPiP) {
    return (
      <VideoCallStage
        channel={channel}
        participants={participants}
        currentUser={currentUser}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        isVideoOn={isVideoOn}
        onToggleVideo={onToggleVideo}
        onLeaveCall={onLeaveCall}
        onMinimizeToPiP={() => setIsPiP(true)}
      />
    );
  }

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col relative overflow-hidden">
      <ChatView
        channel={channel}
        messages={messages}
        currentUser={currentUser}
        onSendMessage={onSendMessage}
        onToggleReaction={onToggleReaction}
        onStartCall={onStartCall}
        activeCallMode={callMode}
        onToggleDrawer={onToggleDrawer}
        isDrawerOpen={isDrawerOpen}
      />

      {/* PiP Widget */}
      {callMode !== 'none' && isPiP && (
        <div className="absolute top-20 right-6 z-30 w-72 brutal-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[var(--accent-green)] animate-pulse" />
              <p className="text-xs font-bold uppercase">
                {callMode === 'video' ? 'VIDEO SALON' : 'AUDIO HUDDLE'}
              </p>
            </div>
            <span className="brutal-tag text-[9px] py-0">
              #{channel.name}
            </span>
          </div>

          <div className="flex items-center justify-between py-2 px-3 border-[2px] border-[var(--border)] bg-[var(--bg-card-alt)] text-xs">
            <span className="font-mono-code">
              {participants.filter((p) => p.isSpeaking).length > 0 ? (
                <span className="text-[var(--accent-green)] flex items-center gap-1 font-bold">
                  <IconWaveform size={12} /> SPEAKING
                </span>
              ) : (
                'LISTENING'
              )}
            </span>
            <span className="font-mono-code text-[10px] text-[var(--ink-muted)]">
              {participants.length} CONNECTED
            </span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onToggleMute}
                className={`brutal-btn brutal-btn-sm p-2 ${isMuted ? 'brutal-btn-pink' : 'brutal-btn-outline'}`}
              >
                {isMuted ? <IconMicOff size={13} /> : <IconMic size={13} />}
              </button>

              <button
                onClick={() => setIsPiP(false)}
                title="Expand"
                className="brutal-btn brutal-btn-outline brutal-btn-sm p-2"
              >
                <IconMaximize size={13} />
              </button>
            </div>

            <button
              onClick={onLeaveCall}
              className="brutal-btn brutal-btn-pink brutal-btn-sm"
            >
              <IconPhoneOff size={12} />
              LEAVE
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
