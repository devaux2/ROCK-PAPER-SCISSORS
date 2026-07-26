import type { SkinMeta } from '../types';

/** A=Rock, B=Paper, C=Scissors (A beats C, C beats B, B beats A). */
export const classicMeta: SkinMeta = {
  id: 'classic',
  displayName: 'Rock Paper Scissors',
  tagline: 'The timeless classic',
  moves: {
    A: { label: 'Rock', icon: '✊' },
    B: { label: 'Paper', icon: '✋' },
    C: { label: 'Scissors', icon: '✌️' },
  },
  theme: {
    bg: '#0B0906',
    panel: '#1B1408',
    accent: '#FFC93C',
    text: '#FFF6E3',
    textDim: '#A08F6C',
  },
  layout: 'stacked',
};
