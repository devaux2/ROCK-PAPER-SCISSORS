import type { SkinMeta } from '../types';

/**
 * Skin #3 — added purely to prove the architecture: one folder + one
 * registry entry, zero logic changes.
 * A=Fire, B=Water, C=Leaf (fire burns leaf, leaf drinks water, water douses fire).
 */
export const spellMeta: SkinMeta = {
  id: 'spell',
  displayName: 'Spell Duel',
  tagline: 'Fire burns leaf. Leaf drinks water. Water douses fire.',
  moves: {
    A: { label: 'Fire', icon: '🔥' },
    B: { label: 'Water', icon: '💧' },
    C: { label: 'Leaf', icon: '🍃' },
  },
  theme: {
    bg: '#120B26',
    panel: '#221641',
    accent: '#B583FF',
    text: '#F1EAFF',
    textDim: '#9C8CC4',
  },
  layout: 'arena',
};
