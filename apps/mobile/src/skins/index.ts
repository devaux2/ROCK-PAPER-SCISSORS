import type { Skin } from './types';
import { classicSkin } from './classic';
import { fighterSkin } from './fighter';
import { useSettingsStore } from '../stores/settingsStore';

/** Add a new skin here (one folder + one entry) — nothing else changes. */
export const SKINS: Record<string, Skin> = {
  [classicSkin.id]: classicSkin,
  [fighterSkin.id]: fighterSkin,
};

export const DEFAULT_SKIN_ID = classicSkin.id;

export function useSkin(): Skin {
  const id = useSettingsStore((s) => s.activeSkinId);
  return SKINS[id] ?? SKINS[DEFAULT_SKIN_ID]!;
}
