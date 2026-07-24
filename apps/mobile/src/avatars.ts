/**
 * Built-in avatars: emoji on a colored disc — no bundled art needed.
 * Custom photos are stored as 'b64:<base64>' strings server-side.
 */
export const BUILTIN_AVATARS: Record<string, { emoji: string; bg: string }> = {
  avatar_01: { emoji: '🦊', bg: '#D97706' },
  avatar_02: { emoji: '🐼', bg: '#4B5563' },
  avatar_03: { emoji: '🐸', bg: '#059669' },
  avatar_04: { emoji: '🦁', bg: '#B45309' },
  avatar_05: { emoji: '🐙', bg: '#7C3AED' },
  avatar_06: { emoji: '🦈', bg: '#0369A1' },
  avatar_07: { emoji: '🐲', bg: '#15803D' },
  avatar_08: { emoji: '👻', bg: '#6B7280' },
  avatar_09: { emoji: '🦄', bg: '#DB2777' },
  avatar_10: { emoji: '🐯', bg: '#EA580C' },
  avatar_11: { emoji: '🦉', bg: '#92400E' },
  avatar_12: { emoji: '🤖', bg: '#334155' },
};

export const AVATAR_IDS = Object.keys(BUILTIN_AVATARS);

export function isCustomAvatar(avatar: string): boolean {
  return avatar.startsWith('b64:');
}

export function customAvatarUri(avatar: string): string {
  return `data:image/jpeg;base64,${avatar.slice(4)}`;
}
