/** Typed feature endpoints keep URL construction and JSON payloads out of components. */
import { request } from "./request";
export { ApiError } from "./request";
import {
  Channel,
  Message,
  User,
  WorkspaceSettings,
  ChannelMember,
} from "../types/chat";

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
export interface DirectoryPage<T> {
  data: T[];
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
}
export interface DirectoryQuery {
  limit?: number;
  after?: string;
  q?: string;
  signal?: AbortSignal;
}
export interface HistoryQuery {
  before?: string;
  after?: string;
  around?: string;
}
export interface Invitation {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  status: "pending" | "expired" | "accepted";
}
export interface SearchResult {
  message: Message;
  channel: { id: string; name: string };
}
export interface SearchPage {
  data: SearchResult[];
  hasMore: boolean;
  nextCursor: string | null;
}
export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  targetId: string | null;
  createdAt: string;
}
export interface AuditPage {
  data: AuditEvent[];
  hasMore: boolean;
  nextCursor: string | null;
}
const directoryQuery = (options: DirectoryQuery = {}) => {
  const query = new URLSearchParams({ limit: String(options.limit || 50) });
  if (options.after) query.set("after", options.after);
  if (options.q?.trim()) query.set("q", options.q.trim());
  return query.toString();
};
const historyQuery = (options?: string | HistoryQuery) => {
  const query = new URLSearchParams({ limit: "50" });
  if (typeof options === "string") query.set("before", options);
  else if (options)
    for (const [key, value] of Object.entries(options))
      if (value) query.set(key, value);
  return query.toString();
};
export const api = {
  createWorkspace: (name: string) =>
    request<{ data: Workspace }>("/workspace", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  renameWorkspace: (id: string, name: string) =>
    request<{ data: Workspace }>(`/workspace/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  setWorkspaceRole: (id: string, userId: string, role: "admin" | "member") =>
    request<void>(
      `/workspace/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
      { method: "PATCH", body: JSON.stringify({ role }) },
    ),
  removeWorkspaceMember: (id: string, userId: string) =>
    request<void>(
      `/workspace/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    ),
  transferWorkspace: (id: string, userId: string) =>
    request<{ data: Workspace }>(
      `/workspace/${encodeURIComponent(id)}/transfer-ownership`,
      { method: "POST", body: JSON.stringify({ userId }) },
    ),
  leaveWorkspace: (id: string) =>
    request<void>(`/workspace/${encodeURIComponent(id)}/leave`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  fetchInvitations: (options?: DirectoryQuery) =>
    request<DirectoryPage<Invitation>>(
      `/workspace/invitations?${directoryQuery(options)}`,
      { signal: options?.signal },
    ),
  revokeInvitation: (id: string) =>
    request<void>(`/workspace/invitations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  fetchAudit: (before?: string, signal?: AbortSignal) =>
    request<AuditPage>(
      `/workspace/audit?limit=50${before ? `&before=${encodeURIComponent(before)}` : ""}`,
      { signal },
    ),
  searchMessages: (
    query: string,
    after?: string,
    channelId?: string,
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams({ q: query.trim(), limit: "50" });
    if (after) params.set("after", after);
    if (channelId) params.set("channelId", channelId);
    return request<SearchPage>(`/messages/search?${params}`, { signal });
  },
  updateChannel: (id: string, data: { name: string; topic: string }) =>
    request<{ data: Channel }>(`/channels/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  transferChannel: (id: string, userId: string) =>
    request<{ data: Channel }>(
      `/channels/${encodeURIComponent(id)}/transfer-ownership`,
      { method: "POST", body: JSON.stringify({ userId }) },
    ),
  deleteChannel: (id: string, confirmName: string) =>
    request<void>(`/channels/${encodeURIComponent(id)}`, {
      method: "DELETE",
      body: JSON.stringify({ confirmName }),
    }),
  fetchWorkspaces: (options?: DirectoryQuery) =>
    request<DirectoryPage<Workspace> & { currentWorkspaceId: string | null }>(
      `/workspace?${directoryQuery(options)}`,
      { signal: options?.signal },
    ),
  fetchWorkspace: (id: string) =>
    request<{ data: Workspace }>(`/workspace/${encodeURIComponent(id)}`),
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
  createSession: () =>
    request<{ user: User }>("/auth/session", { method: "POST" }),
  fetchMe: () => request<{ user: User }>("/auth/me"),
  logoutAllDevices: () => request<void>("/auth/logout", { method: "POST" }),
  fetchChannelDirectory: (options?: DirectoryQuery) =>
    request<DirectoryPage<Channel>>(`/channels?${directoryQuery(options)}`, {
      signal: options?.signal,
    }),
  fetchChannel: async (id: string) =>
    (await request<{ data: Channel }>(`/channels/${encodeURIComponent(id)}`))
      .data,
  markChannelRead: (id: string, messageId: string) =>
    request<void>(`/channels/${encodeURIComponent(id)}/read`, {
      method: "POST",
      body: JSON.stringify({ messageId }),
    }),
  createChannel: async (
    name: string,
    topic: string,
    type: "text" | "audio" | "video" = "text",
    isPrivate = false,
  ) =>
    (
      await request<{ data: Channel }>("/channels", {
        method: "POST",
        body: JSON.stringify({ name, topic, type, isPrivate }),
      })
    ).data,
  fetchMessagePage: (id: string, options?: string | HistoryQuery) =>
    request<MessagePage>(
      `/messages/${encodeURIComponent(id)}?${historyQuery(options)}`,
    ),
  sendMessage: async (
    channelId: string,
    content: string,
    options: {
      codeSnippet?: Message["codeSnippet"];
      clientMutationId?: string;
    } = {},
  ) =>
    (
      await request<{ data: Message }>("/messages", {
        method: "POST",
        body: JSON.stringify({
          channelId,
          content,
          ...options,
        }),
      })
    ).data,
  toggleReaction: async (id: string, icon: string) =>
    (
      await request<{ data: Message }>(
        `/messages/${encodeURIComponent(id)}/reactions`,
        { method: "POST", body: JSON.stringify({ icon }) },
      )
    ).data,
  editMessage: async (id: string, content: string, expectedVersion: number) =>
    (
      await request<{ data: Message }>(`/messages/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ content, expectedVersion }),
      })
    ).data,
  deleteMessage: async (id: string, expectedVersion: number) =>
    (
      await request<{ data: Message }>(`/messages/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: JSON.stringify({ expectedVersion }),
      })
    ).data,
  pinMessage: async (id: string, isPinned: boolean, expectedVersion: number) =>
    (
      await request<{ data: Message }>(
        `/messages/${encodeURIComponent(id)}/pin`,
        { method: "PUT", body: JSON.stringify({ isPinned, expectedVersion }) },
      )
    ).data,
  fetchMessageChanges: (channelId: string, after: string) =>
    request<{ data: Message[]; changeCursor: string; hasMore: boolean }>(
      `/messages/${encodeURIComponent(channelId)}/changes?after=${encodeURIComponent(after)}&limit=100`,
    ),
  fetchChannelPins: (channelId: string, options?: string | HistoryQuery) =>
    request<MessagePage>(
      `/channels/${encodeURIComponent(channelId)}/pins?${historyQuery(options)}`,
    ),
  fetchChannelMembers: (channelId: string, options?: DirectoryQuery) =>
    request<DirectoryPage<ChannelMember> & { canManageMembers: boolean }>(
      `/channels/${encodeURIComponent(channelId)}/members?${directoryQuery(options)}`,
      { signal: options?.signal },
    ),
  fetchMemberCandidates: (channelId: string, options?: DirectoryQuery) =>
    request<DirectoryPage<User>>(
      `/channels/${encodeURIComponent(channelId)}/member-candidates?${directoryQuery(options)}`,
      { signal: options?.signal },
    ),
  addChannelMember: (channelId: string, userId: string) =>
    request<{ data: ChannelMember }>(
      `/channels/${encodeURIComponent(channelId)}/members`,
      { method: "POST", body: JSON.stringify({ userId }) },
    ),
  removeChannelMember: (channelId: string, userId: string) =>
    request<void>(
      `/channels/${encodeURIComponent(channelId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    ),
  updateProfile: (profile: { name: string; statusText: string }) =>
    request<{ user: User }>("/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(profile),
    }),
  fetchTeamDirectory: (options?: DirectoryQuery) =>
    request<DirectoryPage<User>>(`/team/members?${directoryQuery(options)}`, {
      signal: options?.signal,
    }),
  fetchProfiles: (userIds: string[]) =>
    request<{ data: User[] }>("/team/profiles", {
      method: "POST",
      body: JSON.stringify({ userIds }),
    }),
  fetchSettings: async () =>
    (await request<{ data: WorkspaceSettings }>("/settings")).data,
  updateSettings: async (settings: Partial<WorkspaceSettings>) =>
    (
      await request<{ data: WorkspaceSettings }>("/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      })
    ).data,
};
