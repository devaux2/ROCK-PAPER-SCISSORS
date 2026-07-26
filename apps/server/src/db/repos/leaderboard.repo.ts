import type { DB } from '../db';
import type { LeaderboardRow, LeaderboardWindow } from '@rps/shared';
import { toPublicProfile, type UserRow } from './users.repo';

export class LeaderboardRepo {
  constructor(private db: DB) {}

  /**
   * Winnings board: net coins won in the window (escrows are negative,
   * payouts positive, refunds cancel escrows — so the sum is pure P/L).
   */
  top(window: LeaderboardWindow, limit = 50): LeaderboardRow[] {
    const modifier = window === 'weekly' ? '-7 days' : '-30 days';
    const rows = this.db
      .prepare(
        `SELECT u.*, SUM(t.amount) AS won
         FROM transactions t
         JOIN users u ON u.id = t.user_id
         WHERE t.type IN ('wager_escrow', 'payout', 'wager_refund')
           AND t.created_at >= datetime('now', ?)
         GROUP BY t.user_id
         ORDER BY won DESC, u.wins DESC, u.id
         LIMIT ?`
      )
      .all(modifier, limit) as Array<UserRow & { won: number }>;
    return rows.map((r, i) => ({
      rank: i + 1,
      user: toPublicProfile(r),
      coinsWon: r.won,
    }));
  }
}
