import React, { useState, useEffect } from 'react';
import { WorkspaceSettings } from '../types/chat';
import {
  IconClose,
  IconMic,
  IconVideo,
  IconSettings,
} from './icons/Icons';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: WorkspaceSettings;
  onUpdateSettings: (newSettings: Partial<WorkspaceSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'audio-video' | 'shortcuts'>('audio-video');
  const [testMicLevel, setTestMicLevel] = useState(30);

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTestMicLevel(Math.floor(Math.random() * 55) + 20);
    }, 150);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg border-[3px] border-[var(--border)] bg-white overflow-hidden flex flex-col max-h-[85vh]" style={{ boxShadow: 'var(--shadow-lg)' }}>
        {/* Header */}
        <div className="h-14 px-6 border-b-[3px] border-[var(--border)] flex items-center justify-between bg-[var(--accent-yellow)]">
          <div className="flex items-center gap-2.5">
            <IconSettings size={17} />
            <h3 className="font-display text-base uppercase tracking-tight">
              PREFERENCES
            </h3>
          </div>
          <button onClick={onClose} className="brutal-btn brutal-btn-outline brutal-btn-sm p-1.5">
            <IconClose size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b-[3px] border-[var(--border)]">
          {(['audio-video', 'shortcuts'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 font-display text-xs uppercase tracking-wider border-r-[3px] border-[var(--border)] last:border-r-0 transition-colors ${
                activeTab === tab
                  ? 'bg-[var(--ink)] text-white'
                  : 'bg-white text-[var(--ink)] hover:bg-[var(--bg-card-alt)]'
              }`}
            >
              {tab === 'audio-video' ? 'AUDIO & VIDEO' : 'SHORTCUTS'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'audio-video' && (
            <div className="space-y-5">
              {/* Microphone */}
              <div className="space-y-2">
                <label className="font-display text-xs uppercase tracking-wider flex items-center gap-2">
                  <IconMic size={14} className="text-[var(--accent-green)]" />
                  INPUT MICROPHONE
                </label>
                <select
                  value={settings.micDeviceId}
                  onChange={(e) => onUpdateSettings({ micDeviceId: e.target.value })}
                  className="brutal-input font-mono-code text-xs"
                >
                  <option value="default">System Default (Studio Mic)</option>
                  <option value="external">MacBook Pro Array</option>
                  <option value="shure">Shure MV7 USB</option>
                </select>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between font-mono-code text-[10px] text-[var(--ink-muted)] uppercase">
                    <span>INPUT LEVEL</span>
                    <span>{testMicLevel}%</span>
                  </div>
                  <div className="h-3 w-full border-[2px] border-[var(--border)] bg-white overflow-hidden">
                    <div
                      style={{ width: `${testMicLevel}%` }}
                      className="h-full bg-[var(--accent-green)] transition-all duration-100"
                    />
                  </div>
                </div>
              </div>

              {/* Camera */}
              <div className="space-y-2">
                <label className="font-display text-xs uppercase tracking-wider flex items-center gap-2">
                  <IconVideo size={14} className="text-[var(--accent-blue)]" />
                  VIDEO CAMERA
                </label>
                <select
                  value={settings.cameraDeviceId}
                  onChange={(e) => onUpdateSettings({ cameraDeviceId: e.target.value })}
                  className="brutal-input font-mono-code text-xs"
                >
                  <option value="default">FaceTime HD (1080p)</option>
                  <option value="continuity">Continuity Camera (iPhone 4K)</option>
                  <option value="obs">OBS Virtual Camera</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="p-4 border-[3px] border-[var(--border)] bg-[var(--bg-card-alt)] space-y-4">
                {[
                  {
                    label: 'NOISE SUPPRESSION',
                    desc: 'AI noise reduction for keyboards and ambient hum.',
                    key: 'noiseCancellation' as const,
                  },
                  {
                    label: 'SPATIAL AUDIO',
                    desc: 'Binaural 3D studio acoustics simulation.',
                    key: 'spatialAudio' as const,
                  },
                ].map((toggle) => (
                  <div key={toggle.key} className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase">{toggle.label}</p>
                      <p className="text-[11px] text-[var(--ink-muted)]">{toggle.desc}</p>
                    </div>
                    <button
                      onClick={() => onUpdateSettings({ [toggle.key]: !settings[toggle.key] })}
                      className={`w-14 h-7 border-[3px] border-[var(--border)] p-0.5 transition-colors cursor-pointer ${
                        settings[toggle.key] ? 'bg-[var(--accent-green)]' : 'bg-[var(--ink-faint)]'
                      }`}
                    >
                      <div
                        className={`w-5 h-full bg-white border-[2px] border-[var(--border)] transition-transform ${
                          settings[toggle.key] ? 'translate-x-6' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-3">
              <span className="font-display text-[10px] uppercase tracking-widest text-[var(--ink-muted)]">
                KEYBINDINGS
              </span>
              <div className="border-[3px] border-[var(--border)] overflow-hidden divide-y-[2px] divide-[var(--border)]">
                {[
                  { key: '⌘ + K', label: 'COMMAND PALETTE' },
                  { key: 'M', label: 'TOGGLE MUTE' },
                  { key: 'V', label: 'TOGGLE VIDEO' },
                  { key: 'D', label: 'TOGGLE DEAFEN' },
                  { key: 'SPACE', label: 'PUSH-TO-TALK' },
                  { key: 'ESC', label: 'CLOSE MODALS' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between px-4 py-3 text-xs bg-white">
                    <span className="font-bold uppercase tracking-wide">{item.label}</span>
                    <kbd className="font-mono-code px-2 py-1 text-[11px] font-bold border-[2px] border-[var(--border)] bg-[var(--bg-card-alt)]">
                      {item.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="h-14 px-6 border-t-[3px] border-[var(--border)] bg-[var(--bg-paper)] flex items-center justify-end">
          <button onClick={onClose} className="brutal-btn">
            DONE
          </button>
        </div>
      </div>
    </div>
  );
};
