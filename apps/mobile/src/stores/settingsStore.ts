import { create } from 'zustand';
import { storage } from '../storage';

const SKIN_KEY = 'rps.skin';

interface SettingsState {
  activeSkinId: string;
  hydrate(): Promise<void>;
  setSkin(id: string): void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  activeSkinId: 'classic',
  async hydrate() {
    const saved = await storage.get(SKIN_KEY);
    if (saved) set({ activeSkinId: saved });
  },
  setSkin(id) {
    set({ activeSkinId: id });
    void storage.set(SKIN_KEY, id);
  },
}));
