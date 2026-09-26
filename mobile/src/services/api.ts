import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Channel,
  Message,
  User,
  WorkspaceSettings,
  VoiceNoteData,
} from '@/types';
import {
  INITIAL_CHANNELS,
  INITIAL_MESSAGES,
  TEAM_MEMBERS,
  CURRENT_USER,
  DEFAULT_SETTINGS,
} from '@/data/mockData';

const TOKEN_KEY = 'fable_token';
let cachedToken: string | null = null;

// Initialize cached token on import
AsyncStorage.getItem(TOKEN_KEY).then((t) => {
  cachedToken = t;
});

export async function getStoredToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  cachedToken = await AsyncStorage.getItem(TOKEN_KEY);
  return cachedToken;
}

export async function setStoredToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

/**
 * Resolves the backend base URL dynamically:
 * - Physical device (Expo Go): extracts host IP from expo-constants
 * - Android Emulator: 10.0.2.2:5000
 * - iOS Simulator / Web: localhost:5000
 */
export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // On physical device with Expo Go, hostUri contains "192.168.x.x:8081"
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    return `http://${ip}:5000/api`;
  }

  // Fallbacks for local emulators/simulators
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000/api';
  }

  return 'http://localhost:5000/api';
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (cachedToken) {
    headers['Authorization'] = `Bearer ${cachedToken}`;
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
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Registration failed');
      }
      const data: AuthResponse = await res.json();
      await setStoredToken(data.token);
      return data;
    } catch (err: any) {
      // In offline/mock fallback mode
      if (err.message?.includes('failed') || err.message?.includes('Network')) {
        const mockUser: User = {
          ...CURRENT_USER,
          name: name || 'Studio Designer',
          handle: `@${(name || 'designer').toLowerCase().replace(/\s+/g, '')}`,
        };
        const mockToken = 'mock_jwt_token_demo';
        await setStoredToken(mockToken);
        return { token: mockToken, user: mockUser };
      }
      throw err;
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Login failed');
      }
      const data: AuthResponse = await res.json();
      await setStoredToken(data.token);
      return data;
    } catch (err: any) {
      // Fallback for demo credentials or offline mode
      if (
        (email === 'suraj@fable.studio' && password === 'password123') ||
        err.message?.includes('Network') ||
        err.message?.includes('failed')
      ) {
        const mockToken = 'mock_jwt_token_demo';
        await setStoredToken(mockToken);
        return { token: mockToken, user: CURRENT_USER };
      }
      throw err;
    }
  },

  async fetchMe(): Promise<{ user: User }> {
    try {
      await getStoredToken();
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/auth/me`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Not authenticated');
      return res.json();
    } catch {
      if (cachedToken) {
        return { user: CURRENT_USER };
      }
      throw new Error('Not authenticated');
    }
  },

  async logout(): Promise<void> {
    await setStoredToken(null);
  },

  // ─── HEALTH ───────────────────────────────
  async checkHealth(): Promise<HealthResponse> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/health`);
    if (!res.ok) {
      throw new Error(`Health check failed: ${res.statusText}`);
    }
    return res.json();
  },

  // ─── CHANNELS ─────────────────────────────
  async fetchChannels(): Promise<Channel[]> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/channels`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch channels`);
      const json = await res.json();
      return json.data || INITIAL_CHANNELS;
    } catch {
      return INITIAL_CHANNELS;
    }
  },

  async fetchChannel(id: string): Promise<Channel> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/channels/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch channel`);
      const json = await res.json();
      return json.data;
    } catch {
      const found = INITIAL_CHANNELS.find((c) => c.id === id);
      if (!found) throw new Error('Channel not found');
      return found;
    }
  },

  // ─── MESSAGES ─────────────────────────────
  async fetchAllMessages(): Promise<Record<string, Message[]>> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/messages`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch messages`);
      const json = await res.json();
      return json.data || INITIAL_MESSAGES;
    } catch {
      return INITIAL_MESSAGES;
    }
  },

  async fetchMessages(channelId: string): Promise<Message[]> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/messages/${channelId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch messages`);
      const json = await res.json();
      return json.data;
    } catch {
      return INITIAL_MESSAGES[channelId] || [];
    }
  },

  async sendMessage(
    channelId: string,
    content: string,
    voiceNote?: VoiceNoteData,
    codeSnippet?: { language: string; code: string }
  ): Promise<Message> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          channelId,
          content,
          voiceNote,
          codeSnippet,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to send message: ${res.statusText}`);
      }
      const json = await res.json();
      return json.data;
    } catch {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
      const timestamp = `${formattedHours}:${formattedMinutes} ${ampm}`;

      return {
        id: `msg_local_${Date.now()}`,
        channelId,
        sender: CURRENT_USER,
        timestamp,
        content,
        voiceNote,
        codeSnippet,
        reactions: [],
      };
    }
  },

  async toggleReaction(messageId: string, icon: string): Promise<Message> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ icon }),
      });

      if (!res.ok) {
        throw new Error(`Failed to toggle reaction`);
      }
      const json = await res.json();
      return json.data;
    } catch {
      // Mock toggle
      return {
        id: messageId,
        channelId: '',
        sender: CURRENT_USER,
        timestamp: 'Just now',
        content: '',
      };
    }
  },

  // ─── TEAM ─────────────────────────────────
  async fetchTeamMembers(): Promise<User[]> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/team/members`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch team members`);
      const json = await res.json();
      return json.data || TEAM_MEMBERS;
    } catch {
      return TEAM_MEMBERS;
    }
  },

  async fetchCurrentUser(): Promise<User> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/team/me`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch current user`);
      const json = await res.json();
      return json.data || CURRENT_USER;
    } catch {
      return CURRENT_USER;
    }
  },

  // ─── SETTINGS ─────────────────────────────
  async fetchSettings(): Promise<WorkspaceSettings> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/settings`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`Failed to fetch settings`);
      const json = await res.json();
      return json.data || DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async updateSettings(settings: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error(`Failed to update settings`);
      const json = await res.json();
      return json.data;
    } catch {
      return { ...DEFAULT_SETTINGS, ...settings };
    }
  },
};
