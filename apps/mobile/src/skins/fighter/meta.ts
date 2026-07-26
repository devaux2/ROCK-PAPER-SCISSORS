import type { SkinMeta } from '../types';

/**
 * Same mechanic, fighting-game clothes.
 * A=Kick, B=Punch, C=Block (kick breaks block, block absorbs punch, punch counters kick).
 */
export const fighterMeta: SkinMeta = {
  id: 'fighter',
  displayName: 'Kick Block Punch',
  tagline: 'Round one. FIGHT!',
  moves: {
    A: { label: 'Kick', icon: '🦵' },
    B: { label: 'Punch', icon: '👊' },
    C: { label: 'Block', icon: '🛡️' },
  },
  theme: {
    bg: '#140807',
    panel: '#2A120E',
    accent: '#FF4655',
    text: '#FFEDEA',
    textDim: '#B98A8A',
  },
  layout: 'arena',
};
