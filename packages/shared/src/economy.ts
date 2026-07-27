export const STARTING_COINS = 500;

/** Fixed wager tiers keep ranked matchmaking pools liquid. */
export const WAGER_TIERS = [1, 5, 10, 20, 50, 100, 1000] as const;
export type WagerTier = (typeof WAGER_TIERS)[number];

export function isWagerTier(value: unknown): value is WagerTier {
  return typeof value === 'number' && (WAGER_TIERS as readonly number[]).includes(value);
}

/** Daily top-up: eligible when balance is below the threshold; grants up to the threshold. */
export const DAILY_TOPUP_THRESHOLD = 100;

export type TransactionType =
  | 'signup_bonus'
  | 'wager_escrow'
  | 'wager_refund'
  | 'payout'
  | 'daily_topup'
  | 'social_bonus';

/** Coins granted for a verified share post, per platform per UTC day. */
export const SOCIAL_BONUS_COINS = 250;
export const SOCIAL_PLATFORMS = ['x', 'facebook'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
