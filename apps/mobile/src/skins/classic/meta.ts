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
    bg: '#1A2233',
    panel: '#243047',
    accent: '#F0B429',
    text: '#EAF0FA',
    textDim: '#93A3BE',
  },
  layout: 'stacked',
};
