import type { ComponentType } from 'react';
import type { Move, RoundOutcome } from '@rps/shared';

/** Pure data half of a skin — safe to import in node tests. */
export interface SkinMeta {
  id: string;
  displayName: string;
  tagline: string;
  moves: Record<Move, { label: string; icon: string }>;
  theme: {
    bg: string;
    panel: string;
    accent: string;
    text: string;
    textDim: string;
  };
  /** 'stacked': hands top/bottom (classic). 'arena': fighters side by side. */
  layout: 'stacked' | 'arena';
}

export interface MoveButtonProps {
  move: Move;
  disabled: boolean;
  selected: boolean;
  onPress: () => void;
}

export interface RevealSceneProps {
  myMove: Move;
  oppMove: Move;
  outcome: RoundOutcome;
  /** Called when the reveal animation finishes (client-side pacing only). */
  onDone: () => void;
}

export interface MatchEndSceneProps {
  won: boolean;
  reason: 'score' | 'forfeit' | 'disconnect';
}

/**
 * A complete visual skin. Game logic never changes per skin — the match
 * screen feeds abstract A/B/C moves in and renders whatever the skin returns.
 * Adding a skin = new folder + one registry entry.
 */
export interface Skin extends SkinMeta {
  MoveButton: ComponentType<MoveButtonProps>;
  RevealScene: ComponentType<RevealSceneProps>;
  MatchEndScene: ComponentType<MatchEndSceneProps>;
}
