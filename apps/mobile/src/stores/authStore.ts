import { create } from 'zustand';
import type { UserProfile } from '@rps/shared';
import { api } from '../api/client';
import { storage } from '../storage';

const TOKEN_KEY = 'rps.token';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  hydrated: boolean;
  hydrate(): Promise<void>;
  login(username: string, password: string): Promise<void>;
  signup(username: string, password: string): Promise<void>;
  refreshMe(): Promise<void>;
  setUser(user: UserProfile): void;
  logout(): Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  hydrated: false,

  async hydrate() {
    const token = await storage.get(TOKEN_KEY);
    if (token) {
      set({ token });
      try {
        const user = await api.me();
        set({ user });
      } catch {
        // Token expired or server unreachable — drop it.
        await storage.remove(TOKEN_KEY);
        set({ token: null, user: null });
      }
    }
    set({ hydrated: true });
  },

  async login(username, password) {
    const res = await api.login(username, password);
    await storage.set(TOKEN_KEY, res.token);
    set({ token: res.token, user: res.user });
  },

  async signup(username, password) {
    const res = await api.signup(username, password);
    await storage.set(TOKEN_KEY, res.token);
    set({ token: res.token, user: res.user });
  },

  async refreshMe() {
    if (!get().token) return;
    try {
      set({ user: await api.me() });
    } catch {
      // Keep the stale profile on transient failures.
    }
  },

  setUser(user) {
    set({ user });
  },

  async logout() {
    await storage.remove(TOKEN_KEY);
    set({ token: null, user: null });
  },
}));
