/** Client DTOs describe the shipped text collaboration features, separate from database models. */
export type UserStatus = "online" | "idle" | "in-huddle" | "offline";

export interface User {
  id: string;
  name: string;
  handle: string;
  monogram: string;
  role: string;
  status: UserStatus;
  statusText?: string;
  avatarColor?: string;
  workspaceRole?: "owner" | "admin" | "member";
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
  codeSnippet?: {
    language: string;
    code: string;
  };
  reactions?: Reaction[];
  isPinned?: boolean;
  version: number;
  updatedAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  canEdit: boolean;
  canDelete: boolean;
  canPin: boolean;
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

export interface ChannelMember extends User {
  channelRole: "creator" | "member";
  canRemove: boolean;
  workspaceRole: "owner" | "admin" | "member";
  joinedAt: string;
}
