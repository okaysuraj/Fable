/** Native client DTOs follow the same text collaboration records and permissions as web. */
export type UserStatus = "online" | "idle" | "in-huddle" | "offline";

export interface User {
  id: string;
  name: string;
  handle: string;
  monogram: string;
  role: string;
  workspaceRole?: "owner" | "admin" | "member";
  status: UserStatus;
  statusText?: string;
  avatarColor?: string | null;
  email?: string;
  phoneNumber?: string | null;
  photoVersion?: number;
}

export type ChannelType = "text" | "audio" | "video";

export interface Channel {
  workspaceId: string;
  isDirect?: boolean;
  lastMessage?: { text: string; timestamp: string } | null;
  id: string;
  name: string;
  topic: string;
  type: ChannelType;
  unreadCount?: number;
  isPrivate?: boolean;
  memberCount: number;
  createdById?: string | null;
  canManageMembers?: boolean;
  canManageChannel?: boolean;
  canLeave?: boolean;
}

export interface Reaction {
  icon: string;
  count: number;
  reactedByMe: boolean;
}

export interface Message {
  attachments?: MediaAsset[];
  replyToId?: string | null;
  id: string;
  channelId: string;
  sender: User;
  timestamp: string;
  content: string;
  version: number;
  updatedAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
  codeSnippet?: {
    language: string;
    code: string;
  };
  reactions?: Reaction[];
  isPinned?: boolean;
}
export interface MediaAsset {
  id: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface ConversationPresence {
  typing: { id: string; name: string }[];
  receipt: { messageId: string; readCount: number } | null;
}
export interface CallSession {
  id: string;
  channelId: string;
  callerId: string;
  calleeId: string;
  kind: "audio" | "video";
  status: "ringing" | "active" | "ended" | "declined";
  offer: string | null;
  answer: string | null;
  createdAt: string;
}

export interface ChannelMember extends User {
  canRemove: boolean;
  channelRole: string;
  workspaceRole: "owner" | "admin" | "member";
  joinedAt: string;
}

export type ThemeMode = "dark" | "light";

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
