import { create } from 'zustand';
import { storage } from '../storage';

const SKIN_KEY = 'rps.skin';
const SOUND_KEY = 'rps.sound';
const MUSIC_KEY = 'rps.music';
const WAGER_KEY = 'rps.wager';
const VOICE_KEY = 'rps.voice';
const VOICE_VOL_KEY = 'rps.voiceVol';

interface SettingsState {
  activeSkinId: string;
  soundEnabled: boolean;
  musicEnabled: boolean;
  /** In-match voice chat with the opponent; on by default. */
  voiceEnabled: boolean;
  /** Remote voice volume 0..1. */
  voiceVolume: number;
  /** Last chosen wager tier; 0 means casual. */
  wager: number;
  hydrate(): Promise<void>;
  setSkin(id: string): void;
  setSoundEnabled(enabled: boolean): void;
  setMusicEnabled(enabled: boolean): void;
  setVoiceEnabled(enabled: boolean): void;
  setVoiceVolume(volume: number): void;
  setWager(wager: number): void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  activeSkinId: 'classic',
  soundEnabled: true,
  musicEnabled: true,
  voiceEnabled: true,
  voiceVolume: 1,
  wager: 0,
  async hydrate() {
    const [skin, sound, music, wager, voice, voiceVol] = await Promise.all([
      storage.get(SKIN_KEY),
      storage.get(SOUND_KEY),
      storage.get(MUSIC_KEY),
      storage.get(WAGER_KEY),
      storage.get(VOICE_KEY),
      storage.get(VOICE_VOL_KEY),
    ]);
    if (skin) set({ activeSkinId: skin });
    if (sound !== null) set({ soundEnabled: sound === '1' });
    if (music !== null) set({ musicEnabled: music === '1' });
    if (wager !== null) set({ wager: Number(wager) || 0 });
    if (voice !== null) set({ voiceEnabled: voice === '1' });
    if (voiceVol !== null) {
      const v = Number(voiceVol);
      if (Number.isFinite(v)) set({ voiceVolume: Math.min(1, Math.max(0, v)) });
    }
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
  setVoiceEnabled(enabled) {
    set({ voiceEnabled: enabled });
    void storage.set(VOICE_KEY, enabled ? '1' : '0');
  },
  setVoiceVolume(volume) {
    const v = Math.min(1, Math.max(0, volume));
    set({ voiceVolume: v });
    void storage.set(VOICE_VOL_KEY, String(v));
  },
  setWager(wager) {
    set({ wager });
    void storage.set(WAGER_KEY, String(wager));
  },
}));
