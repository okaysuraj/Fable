import {
  Channel,
  Message,
  User,
  WorkspaceSettings,
  VoiceNoteData,
} from '../types/chat';

const API_BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('fable_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const api = {
  // ─── AUTH ─────────────────────────────────
  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    return res.json();
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    return res.json();
  },

  async fetchMe(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
  },

  // ─── HEALTH ───────────────────────────────
  async checkHealth(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
    return res.json();
  },

  // ─── CHANNELS ─────────────────────────────
  async fetchChannels(): Promise<Channel[]> {
    const res = await fetch(`${API_BASE}/channels`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch channels: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },

  async fetchChannel(id: string): Promise<Channel> {
    const res = await fetch(`${API_BASE}/channels/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch channel ${id}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },

  // ─── MESSAGES ─────────────────────────────
  async fetchAllMessages(): Promise<Record<string, Message[]>> {
    const res = await fetch(`${API_BASE}/messages`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },

  async fetchMessages(channelId: string): Promise<Message[]> {
    const res = await fetch(`${API_BASE}/messages/${channelId}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch messages for ${channelId}: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },

  async sendMessage(
    channelId: string,
    content: string,
    voiceNote?: VoiceNoteData,
    codeSnippet?: { language: string; code: string }
  ): Promise<Message> {
    const res = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ channelId, content, voiceNote, codeSnippet }),
    });
    if (!res.ok) throw new Error(`Failed to send message: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },

  async toggleReaction(messageId: string, icon: string): Promise<Message> {
    const res = await fetch(`${API_BASE}/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ icon }),
    });
    if (!res.ok) throw new Error(`Failed to toggle reaction: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },

  // ─── TEAM ─────────────────────────────────
  async fetchTeamMembers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/team/members`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch team members: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },

  // ─── SETTINGS ─────────────────────────────
  async fetchSettings(): Promise<WorkspaceSettings> {
    const res = await fetch(`${API_BASE}/settings`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`Failed to fetch settings: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },

  async updateSettings(settings: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(`Failed to update settings: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  },
};
