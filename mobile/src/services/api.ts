/** Feature endpoints share session-aware transport; screens do not construct API requests. */
import type {
  Channel,
  ChannelMember,
  Message,
  User,
  WorkspaceSettings,
} from "@/types/chat";
import {
  request,
  session,
  selectWorkspace,
  getSelectedWorkspaceId,
} from "./session";
export { ApiError } from "./request";
export {
  authError,
  getSessionToken,
  onSessionExpired,
  getApiBaseUrl,
} from "./session";
export type { AuthResponse, RegistrationResponse } from "./session";

export interface Workspace {
  id: string;
  name: string;
  role: string;
}
export interface MessagePage {
  data: Message[];
  hasMore: boolean;
  nextCursor: string | null;
  changeCursor: string;
  hasOlder: boolean;
  hasNewer: boolean;
  olderCursor: string | null;
  newerCursor: string | null;
}
export interface MessageChanges {
  data: Message[];
  hasMore: boolean;
  changeCursor: string;
}
export interface DirectoryPage<T> {
  data: T[];
  total?: number;
  hasMore: boolean;
  nextCursor: string | null;
}
export interface WorkspaceInvitation {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  status: "pending" | "expired" | "accepted";
}
export interface MessageSearchResult {
  message: Message;
  channel: { id: string; name: string };
}
export interface WorkspaceAuditEvent {
  id: string;
  actorId: string;
  action: string;
  targetId: string | null;
  createdAt: string;
}
export interface ChannelMembers extends DirectoryPage<ChannelMember> {
  canManageMembers: boolean;
}
export interface DirectoryOptions {
  after?: string;
  q?: string;
  limit?: number;
  signal?: AbortSignal;
}
export interface PageOptions {
  before?: string;
  after?: string;
  around?: string;
  limit?: number;
  signal?: AbortSignal;
}
function directoryQuery(options: DirectoryOptions = {}) {
  const query = new URLSearchParams({ limit: String(options.limit ?? 50) });
  if (options.after) query.set("after", options.after);
  if (options.q?.trim()) query.set("q", options.q.trim());
  return query;
}

export const api = {
  ...session,
  selectWorkspace,
  getSelectedWorkspaceId,
  fetchWorkspaces: (options: DirectoryOptions = {}) =>
    request<DirectoryPage<Workspace> & { currentWorkspaceId: string | null }>(
      `/workspace?${directoryQuery(options)}`,
      { signal: options.signal },
    ),
  async fetchWorkspace(
    id: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<Workspace> {
    return (
      await request<{ data: Workspace }>(
        `/workspace/${encodeURIComponent(id)}`,
        { signal: options.signal },
      )
    ).data;
  },
  async createWorkspace(name: string): Promise<Workspace> {
    return (
      await request<{ data: Workspace }>("/workspace", {
        method: "POST",
        body: JSON.stringify({ name }),
      })
    ).data;
  },
  async renameWorkspace(id: string, name: string): Promise<Workspace> {
    return (
      await request<{ data: Workspace }>(
        `/workspace/${encodeURIComponent(id)}`,
        { method: "PATCH", body: JSON.stringify({ name }) },
      )
    ).data;
  },
  updateWorkspaceMember: (
    id: string,
    userId: string,
    role: "admin" | "member",
  ) =>
    request(
      `/workspace/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
      { method: "PATCH", body: JSON.stringify({ role }) },
    ),
  removeWorkspaceMember: (id: string, userId: string) =>
    request<void>(
      `/workspace/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    ),
  async transferWorkspaceOwnership(
    id: string,
    userId: string,
  ): Promise<Workspace> {
    return (
      await request<{ data: Workspace }>(
        `/workspace/${encodeURIComponent(id)}/transfer-ownership`,
        { method: "POST", body: JSON.stringify({ userId }) },
      )
    ).data;
  },
  leaveWorkspace: (id: string) =>
    request<void>(`/workspace/${encodeURIComponent(id)}/leave`, {
      method: "POST",
      body: "{}",
    }),
  fetchInvitations: (options: DirectoryOptions = {}) =>
    request<DirectoryPage<WorkspaceInvitation>>(
      `/workspace/invitations?${directoryQuery(options)}`,
      { signal: options.signal },
    ),
  revokeInvitation: (id: string) =>
    request<void>(`/workspace/invitations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  fetchWorkspaceAudit: (options: DirectoryOptions = {}) => {
    const query = new URLSearchParams({ limit: String(options.limit ?? 50) });
    if (options.after) query.set("before", options.after);
    return request<DirectoryPage<WorkspaceAuditEvent>>(
      `/workspace/audit?${query}`,
      { signal: options.signal },
    );
  },
  invite: (email: string) =>
    request<{ data: { token: string; email: string; expiresAt: string } }>(
      "/workspace/invitations",
      { method: "POST", body: JSON.stringify({ email }) },
    ),
  joinWorkspace: (token: string) =>
    request<{ data: { workspaceId: string } }>("/workspace/join", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  fetchChannelDirectory: (options: DirectoryOptions = {}) =>
    request<DirectoryPage<Channel>>(`/channels?${directoryQuery(options)}`, {
      signal: options.signal,
    }),
  async fetchChannels(options: DirectoryOptions = {}): Promise<Channel[]> {
    return (await api.fetchChannelDirectory(options)).data;
  },
  async fetchChannel(
    id: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<Channel> {
    return (
      await request<{ data: Channel }>(`/channels/${encodeURIComponent(id)}`, {
        signal: options.signal,
      })
    ).data;
  },
  markChannelRead: (
    id: string,
    messageId?: string,
    options: { signal?: AbortSignal } = {},
  ) =>
    request<void>(`/channels/${encodeURIComponent(id)}/read`, {
      method: "POST",
      body: JSON.stringify({ ...(messageId ? { messageId } : {}) }),
      signal: options.signal,
    }),
  async createChannel(values: {
    name: string;
    topic?: string;
    type?: "text" | "audio" | "video";
    isPrivate?: boolean;
  }): Promise<Channel> {
    return (
      await request<{ data: Channel }>("/channels", {
        method: "POST",
        body: JSON.stringify(values),
      })
    ).data;
  },
  async updateChannel(
    id: string,
    values: { name: string; topic: string },
  ): Promise<Channel> {
    return (
      await request<{ data: Channel }>(`/channels/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      })
    ).data;
  },
  async transferChannelOwnership(id: string, userId: string): Promise<Channel> {
    return (
      await request<{ data: Channel }>(
        `/channels/${encodeURIComponent(id)}/transfer-ownership`,
        { method: "POST", body: JSON.stringify({ userId }) },
      )
    ).data;
  },
  deleteChannel: (id: string, confirmName: string) =>
    request<void>(`/channels/${encodeURIComponent(id)}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmName }),
    }),
  searchMessages: (options: DirectoryOptions & { channelId?: string } = {}) => {
    const query = directoryQuery(options);
    if (options.channelId) query.set("channelId", options.channelId);
    return request<DirectoryPage<MessageSearchResult>>(
      `/messages/search?${query}`,
      { signal: options.signal },
    );
  },
  async fetchMessagePage(
    channelId: string,
    options: PageOptions = {},
  ): Promise<MessagePage> {
    const query = new URLSearchParams({ limit: String(options.limit ?? 50) });
    if (options.before) query.set("before", options.before);
    if (options.after) query.set("after", options.after);
    if (options.around) query.set("around", options.around);
    return request<MessagePage>(
      `/messages/${encodeURIComponent(channelId)}?${query}`,
      { signal: options.signal },
    );
  },
  fetchMessageChanges(
    channelId: string,
    after: string,
    options: { limit?: number; signal?: AbortSignal } = {},
  ): Promise<MessageChanges> {
    const query = new URLSearchParams({
      after,
      limit: String(options.limit ?? 100),
    });
    return request<MessageChanges>(
      `/messages/${encodeURIComponent(channelId)}/changes?${query}`,
      { signal: options.signal },
    );
  },
  fetchPinnedMessages(
    channelId: string,
    options: PageOptions = {},
  ): Promise<MessagePage> {
    const query = new URLSearchParams({ limit: String(options.limit ?? 50) });
    if (options.before) query.set("before", options.before);
    if (options.after) query.set("after", options.after);
    return request<MessagePage>(
      `/channels/${encodeURIComponent(channelId)}/pins?${query}`,
      { signal: options.signal },
    );
  },
  fetchChannelMembers(
    channelId: string,
    options: DirectoryOptions = {},
  ): Promise<ChannelMembers> {
    return request<ChannelMembers>(
      `/channels/${encodeURIComponent(channelId)}/members?${directoryQuery(options)}`,
      { signal: options.signal },
    );
  },
  fetchChannelCandidates(
    channelId: string,
    options: DirectoryOptions = {},
  ): Promise<DirectoryPage<User>> {
    return request<DirectoryPage<User>>(
      `/channels/${encodeURIComponent(channelId)}/member-candidates?${directoryQuery(options)}`,
      { signal: options.signal },
    );
  },
  async addChannelMember(channelId: string, userId: string): Promise<void> {
    await request(`/channels/${encodeURIComponent(channelId)}/members`, {
      method: "POST",
      body: JSON.stringify({ userId }),
    });
  },
  removeChannelMember(channelId: string, userId: string): Promise<void> {
    return request<void>(
      `/channels/${encodeURIComponent(channelId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    );
  },
  async editMessage(
    id: string,
    values: { content: string; expectedVersion: number },
  ): Promise<Message> {
    return (
      await request<{ data: Message }>(`/messages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      })
    ).data;
  },
  async deleteMessage(id: string, expectedVersion: number): Promise<Message> {
    return (
      await request<{ data: Message }>(`/messages/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion }),
      })
    ).data;
  },
  async pinMessage(
    id: string,
    isPinned: boolean,
    expectedVersion: number,
  ): Promise<Message> {
    return (
      await request<{ data: Message }>(
        `/messages/${encodeURIComponent(id)}/pin`,
        { method: "PUT", body: JSON.stringify({ isPinned, expectedVersion }) },
      )
    ).data;
  },
  async updateProfile(values: {
    name?: string;
    statusText?: string;
  }): Promise<User> {
    return (
      await request<{ user: User }>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify(values),
      })
    ).user;
  },
  async sendMessage(
    channelId: string,
    content: string,
    options: {
      codeSnippet?: Message["codeSnippet"];
      clientMutationId?: string;
    } = {},
  ): Promise<Message> {
    return (
      await request<{ data: Message }>("/messages", {
        method: "POST",
        body: JSON.stringify({
          channelId,
          content,
          ...options,
        }),
      })
    ).data;
  },
  async toggleReaction(messageId: string, icon: string): Promise<Message> {
    return (
      await request<{ data: Message }>(
        `/messages/${encodeURIComponent(messageId)}/reactions`,
        { method: "POST", body: JSON.stringify({ icon }) },
      )
    ).data;
  },
  fetchTeamDirectory: (options: DirectoryOptions = {}) =>
    request<DirectoryPage<User>>(`/team/members?${directoryQuery(options)}`, {
      signal: options.signal,
    }),
  async fetchProfiles(
    userIds: string[],
    options: { signal?: AbortSignal } = {},
  ): Promise<User[]> {
    return (
      await request<{ data: User[] }>("/team/profiles", {
        method: "POST",
        body: JSON.stringify({ userIds }),
        signal: options.signal,
      })
    ).data;
  },
  async fetchTeamMembers(options: DirectoryOptions = {}): Promise<User[]> {
    return (await api.fetchTeamDirectory(options)).data;
  },
  async fetchCurrentUser(
    options: { signal?: AbortSignal } = {},
  ): Promise<User> {
    return (await api.fetchMe(options)).user;
  },
  async fetchSettings(
    options: { signal?: AbortSignal } = {},
  ): Promise<WorkspaceSettings> {
    return (
      await request<{ data: WorkspaceSettings }>("/settings", {
        signal: options.signal,
      })
    ).data;
  },
  async updateSettings(
    settings: Partial<WorkspaceSettings>,
  ): Promise<WorkspaceSettings> {
    return (
      await request<{ data: WorkspaceSettings }>("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      })
    ).data;
  },
};
