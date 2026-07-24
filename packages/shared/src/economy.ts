export const STARTING_COINS = 500;

/** Fixed wager tiers keep ranked matchmaking pools liquid. */
export const WAGER_TIERS = [10, 50, 100, 500] as const;
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
  | 'daily_topup';
