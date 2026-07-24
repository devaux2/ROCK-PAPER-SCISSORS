import { create } from 'zustand';
import { storage } from '../storage';

const SKIN_KEY = 'rps.skin';
const SOUND_KEY = 'rps.sound';

interface SettingsState {
  activeSkinId: string;
  soundEnabled: boolean;
  hydrate(): Promise<void>;
  setSkin(id: string): void;
  setSoundEnabled(enabled: boolean): void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  activeSkinId: 'classic',
  soundEnabled: true,
  async hydrate() {
    const [skin, sound] = await Promise.all([storage.get(SKIN_KEY), storage.get(SOUND_KEY)]);
    if (skin) set({ activeSkinId: skin });
    if (sound !== null) set({ soundEnabled: sound === '1' });
  },
  setSkin(id) {
    set({ activeSkinId: id });
    void storage.set(SKIN_KEY, id);
  },
  setSoundEnabled(enabled) {
    set({ soundEnabled: enabled });
    void storage.set(SOUND_KEY, enabled ? '1' : '0');
  },
}));
