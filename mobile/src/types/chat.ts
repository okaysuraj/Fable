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
  avatarColor?: string;
}

export type ChannelType = "text" | "audio" | "video";

export interface Channel {
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
