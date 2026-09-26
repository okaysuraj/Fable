export type UserStatus = 'online' | 'idle' | 'in-huddle' | 'offline';

export interface User {
  id: string;
  name: string;
  handle: string;
  monogram: string;
  role: string;
  status: UserStatus;
  statusText?: string;
  avatarColor?: string;
}

export type ChannelType = 'text' | 'audio' | 'video';

export interface Channel {
  id: string;
  name: string;
  topic: string;
  type: ChannelType;
  unreadCount?: number;
  isPrivate?: boolean;
  memberCount: number;
  activeCall?: {
    mode: 'audio' | 'video';
    participantCount: number;
    startedAt: string;
  };
}

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: 'image' | 'code' | 'document';
}

export interface VoiceNoteData {
  duration: string;
  waveform: number[];
}

export interface Reaction {
  icon: string;
  count: number;
  reactedByMe: boolean;
}

export interface Message {
  id: string;
  channelId: string;
  sender: User;
  timestamp: string;
  content: string;
  codeSnippet?: {
    language: string;
    code: string;
  };
  attachments?: Attachment[];
  voiceNote?: VoiceNoteData;
  reactions?: Reaction[];
  isPinned?: boolean;
}

export interface CallParticipant {
  id: string;
  user: User;
  isSpeaking: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  isScreenSharing: boolean;
  audioLevel: number;
  stream?: any;
  accentColor: string;
}

export type CallMode = 'none' | 'audio' | 'video';

export type ThemeMode = 'dark' | 'light';

export interface WorkspaceSettings {
  micDeviceId: string;
  cameraDeviceId: string;
  speakerDeviceId: string;
  noiseCancellation: boolean;
  spatialAudio: boolean;
  theme: ThemeMode;
  inputVolume: number;
  outputVolume: number;
}
