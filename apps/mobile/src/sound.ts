import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSettingsStore } from './stores/settingsStore';

/* eslint-disable @typescript-eslint/no-require-imports */
const SOURCES = {
  click: require('../assets/sfx/click.wav'),
  reveal: require('../assets/sfx/reveal.wav'),
  win: require('../assets/sfx/win.wav'),
  lose: require('../assets/sfx/lose.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

const players = new Map<SoundName, AudioPlayer>();

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
