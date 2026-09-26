import React, { useState, useEffect, useRef } from 'react';
import { Channel, CallParticipant, User } from '../../types/chat';
import {
  IconMic,
  IconMicOff,
  IconVideo,
  IconVideoOff,
  IconScreenShare,
  IconPhoneOff,
  IconMinimize,
} from '../icons/Icons';

interface VideoCallStageProps {
  channel: Channel;
  participants: CallParticipant[];
  currentUser: User;
  isMuted: boolean;
  onToggleMute: () => void;
  isVideoOn: boolean;
  onToggleVideo: () => void;
  onLeaveCall: () => void;
  onMinimizeToPiP: () => void;
}

export const VideoCallStage: React.FC<VideoCallStageProps> = ({
  channel,
  participants,
  currentUser,
  isMuted,
  onToggleMute,
  isVideoOn,
  onToggleVideo,
  onLeaveCall,
  onMinimizeToPiP,
}) => {
  const [callDuration, setCallDuration] = useState(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCallDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let activeStream: MediaStream | null = null;

    if (isVideoOn) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ video: true, audio: false })
          .then((stream) => {
            activeStream = stream;
            setLocalStream(stream);
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream;
            }
          })
          .catch(() => setLocalStream(null));
      }
    } else {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
        setLocalStream(null);
      }
    }

    return () => {
      if (activeStream) activeStream.getTracks().forEach((track) => track.stop());
    };
  }, [isVideoOn]);

  const handleToggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          setIsScreenSharing(true);
          if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;
          stream.getVideoTracks()[0].onended = () => setIsScreenSharing(false);
        } else {
          setIsScreenSharing(true);
        }
      } catch {
        /* cancelled */
      }
    } else {
      setIsScreenSharing(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-[var(--bg-paper)] relative overflow-hidden select-none">
      {/* Header */}
      <header className="h-16 px-6 border-b-[3px] border-[var(--border)] bg-white flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 flex items-center justify-center border-[3px] border-[var(--border)]"
            style={{ background: 'var(--accent-blue)', color: 'white', boxShadow: 'var(--shadow-sm)' }}
          >
            <IconVideo size={16} />
          </div>
          <div>
            <h2 className="font-display text-sm uppercase tracking-tight">
              VIDEO SALON · #{channel.name}
            </h2>
            <div className="flex items-center gap-2 font-mono-code text-[10px] text-[var(--ink-muted)] uppercase">
              <span className="text-[var(--accent-blue)] font-bold">● 1080P WEBRTC</span>
              <span>·</span>
              <span>{formatTime(callDuration)}</span>
              <span>·</span>
              <span>{participants.length} CONNECTED</span>
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
            END
          </button>
        </div>
      </header>

      {/* Video Grid */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col justify-center">
        {isScreenSharing ? (
          <div className="w-full h-full flex flex-col lg:flex-row gap-4">
            <div className="flex-1 border-[3px] border-[var(--border)] bg-black overflow-hidden relative flex items-center justify-center" style={{ boxShadow: 'var(--shadow)' }}>
              <video ref={screenVideoRef} autoPlay playsInline className="w-full h-full object-contain" />
              <div className="absolute top-4 left-4 brutal-tag text-[10px] bg-[var(--accent-green)]">
                <span className="w-2 h-2 bg-white animate-pulse" />
                SCREEN SHARE
              </div>
            </div>

            <div className="w-full lg:w-56 flex lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto shrink-0">
              {participants.map((p) => (
                <div
                  key={p.id}
                  className="h-28 lg:h-36 border-[3px] border-[var(--border)] bg-[var(--bg-card-alt)] relative overflow-hidden flex items-center justify-center shrink-0 w-40 lg:w-full"
                >
                  <div className="w-10 h-10 flex items-center justify-center font-mono-code text-xs font-bold border-[3px] border-[var(--border)] bg-white">
                    {p.user.monogram}
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-2 py-1 bg-[var(--ink)] text-white text-[10px] font-mono-code">
                    <span className="truncate font-bold uppercase">{p.user.name}</span>
                    {p.isMuted && <IconMicOff size={10} className="text-[var(--accent-pink)]" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-5xl w-full mx-auto h-full max-h-[700px]">
            {/* Local User */}
            <div className="relative border-[3px] border-[var(--border)] overflow-hidden flex items-center justify-center bg-[var(--bg-card-alt)]" style={{ boxShadow: 'var(--shadow)' }}>
              {isVideoOn && localStream ? (
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
              ) : (
                <div className="flex flex-col items-center">
                  <div
                    className={`w-20 h-20 flex items-center justify-center font-mono-code text-2xl font-bold border-[3px] border-[var(--border)] ${
                      !isMuted ? 'speaking-pulse' : ''
                    }`}
                    style={{ background: !isMuted ? 'var(--accent-green)' : 'var(--bg-card-alt)' }}
                  >
                    {currentUser.monogram}
                  </div>
                  <p className="font-mono-code text-xs text-[var(--ink-muted)] mt-2 uppercase">CAMERA OFF</p>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-[var(--ink)] text-white text-xs font-mono-code">
                <span className="font-bold uppercase">{currentUser.name} (YOU)</span>
                {isMuted ? (
                  <IconMicOff size={12} className="text-[var(--accent-pink)]" />
                ) : (
                  <IconMic size={12} className="text-[var(--accent-green)]" />
                )}
              </div>
            </div>

            {/* Remote */}
            {participants
              .filter((p) => p.user.id !== currentUser.id)
              .map((participant) => (
                <div
                  key={participant.id}
                  className={`relative border-[3px] overflow-hidden flex items-center justify-center bg-[var(--bg-card-alt)] ${
                    participant.isSpeaking
                      ? 'border-[var(--accent-green)] shadow-[var(--shadow)]'
                      : 'border-[var(--border)]'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-20 h-20 flex items-center justify-center font-mono-code text-2xl font-bold border-[3px] border-[var(--border)] ${
                        participant.isSpeaking ? 'speaking-pulse' : ''
                      }`}
                      style={{ background: participant.isSpeaking ? 'var(--accent-green)' : 'var(--bg-card-alt)' }}
                    >
                      {participant.user.monogram}
                    </div>
                    <p className="font-mono-code text-xs text-[var(--ink-muted)] mt-2 uppercase">
                      {participant.user.role}
                    </p>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-[var(--ink)] text-white text-xs font-mono-code">
                    <span className="font-bold uppercase">{participant.user.name}</span>
                    <div className="flex items-center gap-1.5">
                      {participant.isSpeaking && (
                        <span className="text-[var(--accent-green)] text-[10px] font-bold animate-pulse uppercase">
                          SPEAKING
                        </span>
                      )}
                      {participant.isMuted && (
                        <IconMicOff size={12} className="text-[var(--accent-pink)]" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <footer className="h-20 border-t-[3px] border-[var(--border)] bg-white flex items-center justify-center gap-3 px-6 z-10 shrink-0">
        <button
          onClick={onToggleMute}
          className={`brutal-btn brutal-btn-sm p-3 ${isMuted ? 'brutal-btn-pink' : 'brutal-btn-outline'}`}
        >
          {isMuted ? <IconMicOff size={18} /> : <IconMic size={18} />}
        </button>

        <button
          onClick={onToggleVideo}
          className={`brutal-btn brutal-btn-sm p-3 ${!isVideoOn ? 'brutal-btn-pink' : 'brutal-btn-outline'}`}
        >
          {isVideoOn ? <IconVideo size={18} /> : <IconVideoOff size={18} />}
        </button>

        <button
          onClick={handleToggleScreenShare}
          className={`brutal-btn brutal-btn-sm p-3 ${isScreenSharing ? 'brutal-btn-green' : 'brutal-btn-outline'}`}
        >
          <IconScreenShare size={18} />
        </button>

        <div className="w-[3px] h-6 bg-[var(--border)]" />

        <button onClick={onLeaveCall} className="brutal-btn brutal-btn-pink">
          <IconPhoneOff size={16} />
          DISCONNECT
        </button>
      </footer>
    </div>
  );
};
