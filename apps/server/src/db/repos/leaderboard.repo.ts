import type { DB } from '../db';
import type { LeaderboardRow, LeaderboardWindow } from '@rps/shared';
import { toPublicProfile, type UserRow } from './users.repo';

export class LeaderboardRepo {
  constructor(private db: DB) {}

  top(window: LeaderboardWindow, limit = 50): LeaderboardRow[] {
    const modifier = window === 'weekly' ? '-7 days' : '-30 days';
    const rows = this.db
      .prepare(
        `SELECT u.*, SUM(e.delta) AS gained
         FROM elo_history e
         JOIN users u ON u.id = e.user_id
         WHERE e.created_at >= datetime('now', ?)
         GROUP BY e.user_id
         ORDER BY gained DESC, u.elo DESC
         LIMIT ?`
      )
      .all(modifier, limit) as Array<UserRow & { gained: number }>;
    return rows.map((r, i) => ({
      rank: i + 1,
      user: toPublicProfile(r),
      ratingGained: r.gained,
      currentElo: r.elo,
    }));
  }
}
