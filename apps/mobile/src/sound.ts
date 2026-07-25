import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSettingsStore } from './stores/settingsStore';

/* eslint-disable @typescript-eslint/no-require-imports */
const SOURCES = {
  click: require('../assets/sfx/click.wav'),
  reveal: require('../assets/sfx/reveal.wav'),
  win: require('../assets/sfx/win.wav'),
  lose: require('../assets/sfx/lose.wav'),
  tick: require('../assets/sfx/tick.wav'),
  found: require('../assets/sfx/found.wav'),
} as const;
const MUSIC_SOURCE = require('../assets/sfx/music.wav');

export type SoundName = keyof typeof SOURCES;

const players = new Map<SoundName, AudioPlayer>();
let music: AudioPlayer | null = null;

// Browsers refuse audio before the first user gesture; native never does.
let unlocked = typeof document === 'undefined';
if (!unlocked) {
  const unlock = () => {
    unlocked = true;
    document.removeEventListener('pointerdown', unlock);
    syncMusic();
  };
  document.addEventListener('pointerdown', unlock);
}

export function playSound(name: SoundName): void {
  if (!useSettingsStore.getState().soundEnabled) return;
  try {
    let player = players.get(name);
    if (!player) {
      player = createAudioPlayer(SOURCES[name]);
      players.set(name, player);
    }
    player.seekTo(0);
    player.play();
  } catch {
    // Audio is never worth crashing over (e.g. web autoplay restrictions).
  }
}

/**
 * Start the arcade loop. Safe to call repeatedly — browsers block autoplay
 * until the first tap, so this is invoked on mount AND on big taps.
 */
export function startMusic(): void {
  if (!unlocked || !useSettingsStore.getState().musicEnabled) return;
  try {
    if (!music) {
      music = createAudioPlayer(MUSIC_SOURCE);
      music.loop = true;
      music.volume = 0.55;
    }
    if (!music.playing) music.play();
  } catch {}
}

export function stopMusic(): void {
  try {
    music?.pause();
  } catch {}
}

/** Keep the loop in lockstep with the settings toggle. */
export function syncMusic(): void {
  if (useSettingsStore.getState().musicEnabled) startMusic();
  else stopMusic();
}
