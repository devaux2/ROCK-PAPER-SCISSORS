export const EMOTES = [
  { id: 'laugh', emoji: '😂', label: 'Haha!' },
  { id: 'cry', emoji: '😭', label: 'Noo!' },
  { id: 'flex', emoji: '💪', label: 'Too easy' },
  { id: 'shocked', emoji: '😱', label: 'What?!' },
  { id: 'gg', emoji: '🤝', label: 'GG' },
  { id: 'taunt', emoji: '😏', label: 'Come on' },
  { id: 'sweat', emoji: '😅', label: 'Close one' },
  { id: 'zzz', emoji: '😴', label: 'Boring' },
] as const;

export type EmoteId = (typeof EMOTES)[number]['id'];

export function isEmoteId(value: unknown): value is EmoteId {
  return typeof value === 'string' && EMOTES.some((e) => e.id === value);
}

/** Minimum ms between emotes from one player (server-enforced). */
export const EMOTE_COOLDOWN_MS = 3000;
