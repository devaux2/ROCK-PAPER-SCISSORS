import { create } from 'zustand';
import { storage } from '../storage';

const SKIN_KEY = 'rps.skin';
const SOUND_KEY = 'rps.sound';
const MUSIC_KEY = 'rps.music';
const WAGER_KEY = 'rps.wager';

interface SettingsState {
  activeSkinId: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
  /** Last chosen wager tier; 0 means casual. */
  wager: number;
  hydrate(): Promise<void>;
  setSkin(id: string): void;
  setSoundEnabled(enabled: boolean): void;
  setMusicEnabled(enabled: boolean): void;
  setWager(wager: number): void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  activeSkinId: 'classic',
  soundEnabled: true,
  musicEnabled: true,
  wager: 0,
  async hydrate() {
    const [skin, sound, music, wager] = await Promise.all([
      storage.get(SKIN_KEY),
      storage.get(SOUND_KEY),
      storage.get(MUSIC_KEY),
      storage.get(WAGER_KEY),
    ]);
    if (skin) set({ activeSkinId: skin });
    if (sound !== null) set({ soundEnabled: sound === '1' });
    if (music !== null) set({ musicEnabled: music === '1' });
    if (wager !== null) set({ wager: Number(wager) || 0 });
  },
  setSkin(id) {
    set({ activeSkinId: id });
    void storage.set(SKIN_KEY, id);
  },
  setSoundEnabled(enabled) {
    set({ soundEnabled: enabled });
    void storage.set(SOUND_KEY, enabled ? '1' : '0');
  },
  setMusicEnabled(enabled) {
    set({ musicEnabled: enabled });
    void storage.set(MUSIC_KEY, enabled ? '1' : '0');
  },
  setWager(wager) {
    set({ wager });
    void storage.set(WAGER_KEY, String(wager));
  },
}));
