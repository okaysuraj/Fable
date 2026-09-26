import React, { useState, useEffect, useRef } from 'react';
import { Channel, CallParticipant, User } from '../../types/chat';
import {
  IconMic,
  IconMicOff,
  IconHeadphones,
  IconVideo,
  IconPhoneOff,
  IconRadio,
  IconMinimize,
  IconWaveform,
} from '../icons/Icons';

interface AudioHuddleStageProps {
  channel: Channel;
  participants: CallParticipant[];
  currentUser: User;
  isMuted: boolean;
  onToggleMute: () => void;
  isDeafened: boolean;
  onToggleDeafen: () => void;
  onLeaveCall: () => void;
  onUpgradeToVideo: () => void;
  onMinimizeToPiP: () => void;
}

export const AudioHuddleStage: React.FC<AudioHuddleStageProps> = ({
  channel,
  participants,
  currentUser,
  isMuted,
  onToggleMute,
  isDeafened,
  onToggleDeafen,
  onLeaveCall,
  onUpgradeToVideo,
  onMinimizeToPiP,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bars = 36;
      const barWidth = 4;
      const gap = 4;
      const totalWidth = bars * (barWidth + gap);
      const startX = (canvas.width - totalWidth) / 2;

      phase += 0.05;

      for (let i = 0; i < bars; i++) {
        const activeSpeaking = participants.some((p) => p.isSpeaking);
        const amplitude = activeSpeaking ? 22 : 6;
        const height = Math.abs(Math.sin(phase + i * 0.25) * amplitude) + 4;
        const x = startX + i * (barWidth + gap);
        const y = (canvas.height - height) / 2;

        ctx.fillStyle = activeSpeaking ? '#00C853' : '#B8B8B8';
        ctx.fillRect(x, y, barWidth, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [participants]);

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--bg-paper)] relative overflow-hidden paper-texture select-none">
      {/* Header */}
      <header className="h-16 px-6 border-b-[3px] border-[var(--border)] bg-white flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center border-[3px] border-[var(--border)]"
            style={{ background: 'var(--accent-green)', boxShadow: 'var(--shadow-sm)' }}
          >
            <IconRadio size={16} className="animate-pulse" />
          </div>
          <div>
            <h2 className="font-display text-sm uppercase tracking-tight">
              AUDIO HUDDLE · #{channel.name}
            </h2>
            <div className="flex items-center gap-2 font-mono-code text-[10px] text-[var(--ink-muted)] uppercase">
              <span className="text-[var(--accent-green)] font-bold">● CONNECTED</span>
              <span>·</span>
              <span>{formatTime(callDuration)}</span>
              <span>·</span>
              <span>48KHZ OPUS</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onMinimizeToPiP} className="brutal-btn brutal-btn-outline brutal-btn-sm">
            <IconMinimize size={13} />
            CHAT
          </button>
          <button onClick={onLeaveCall} className="brutal-btn brutal-btn-pink brutal-btn-sm">
            <IconPhoneOff size={13} />
            LEAVE
          </button>
        </div>
      </header>

      {/* Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        <div className="w-full max-w-md h-16 flex items-center justify-center mb-10">
          <canvas ref={canvasRef} width={340} height={60} className="w-full h-full" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 max-w-3xl w-full">
          {participants.map((participant) => {
            const isSelf = participant.user.id === currentUser.id;
            const currentMuted = isSelf ? isMuted : participant.isMuted;
            const currentSpeaking = isSelf ? !isMuted && isPushToTalkActive : participant.isSpeaking;

            return (
              <div
                key={participant.id}
                className={`flex flex-col items-center p-5 border-[3px] border-[var(--border)] transition-all ${
                  currentSpeaking
                    ? 'bg-[#E8FFF0] shadow-[var(--shadow)]'
                    : 'bg-white'
                }`}
              >
                <div className="relative mb-3">
                  <div
                    className={`w-16 h-16 flex items-center justify-center font-mono-code text-lg font-bold border-[3px] border-[var(--border)] transition-all ${
                      currentSpeaking ? 'speaking-pulse' : ''
                    }`}
                    style={{ background: currentSpeaking ? 'var(--accent-green)' : 'var(--bg-card-alt)' }}
                  >
                    {participant.user.monogram}
                  </div>

                  {currentMuted && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--accent-pink)] text-white flex items-center justify-center border-[2px] border-[var(--border)]">
                      <IconMicOff size={11} />
                    </div>
                  )}
                  {currentSpeaking && (
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[var(--accent-green)] flex items-center justify-center border-[2px] border-[var(--border)]">
                      <IconWaveform size={11} />
                    </div>
                  )}
                </div>

                <p className="text-xs font-bold uppercase truncate max-w-[120px]">
                  {participant.user.name} {isSelf && '(YOU)'}
                </p>
                <p className="text-[10px] font-mono-code text-[var(--ink-muted)] mt-0.5 uppercase">
                  {currentSpeaking ? 'SPEAKING' : currentMuted ? 'MUTED' : 'LISTENING'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <footer className="h-20 border-t-[3px] border-[var(--border)] bg-white flex items-center justify-center gap-4 px-6 z-10 shrink-0">
        <button
          onMouseDown={() => setIsPushToTalkActive(true)}
          onMouseUp={() => setIsPushToTalkActive(false)}
          onMouseLeave={() => setIsPushToTalkActive(false)}
          className={`brutal-btn ${isPushToTalkActive ? 'brutal-btn-green' : 'brutal-btn-outline'}`}
        >
          <span className={`w-2.5 h-2.5 ${isPushToTalkActive ? 'bg-white animate-ping' : 'bg-[var(--accent-green)]'}`} />
          {isPushToTalkActive ? 'TRANSMITTING...' : 'HOLD SPACE TO TALK'}
        </button>

        <div className="w-[3px] h-6 bg-[var(--border)]" />

        <button
          onClick={onToggleMute}
          className={`brutal-btn brutal-btn-sm p-3 ${isMuted ? 'brutal-btn-pink' : 'brutal-btn-outline'}`}
        >
          {isMuted ? <IconMicOff size={18} /> : <IconMic size={18} />}
        </button>

        <button
          onClick={onToggleDeafen}
          className={`brutal-btn brutal-btn-sm p-3 ${isDeafened ? 'brutal-btn-pink' : 'brutal-btn-outline'}`}
        >
          <IconHeadphones size={18} />
        </button>

        <button onClick={onUpgradeToVideo} className="brutal-btn brutal-btn-blue">
          <IconVideo size={16} />
          VIDEO
        </button>
      </footer>
    </div>
  );
};
