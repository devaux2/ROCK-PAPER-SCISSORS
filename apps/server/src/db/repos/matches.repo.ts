import type { DB } from '../db';
import type { MatchMode, MatchEndReason, Move, MatchHistoryRow } from '@rps/shared';
import { toPublicProfile, type UserRow } from './users.repo';

export interface CompletedRound {
  roundNo: number;
  seq: number;
  p1Move: Move;
  p2Move: Move;
  winner: 'p1' | 'p2' | 'draw';
}

export class MatchesRepo {
  constructor(private db: DB) {}

  create(id: string, mode: MatchMode, p1Id: number, p2Id: number | null, wager: number): void {
    this.db
      .prepare('INSERT INTO matches (id, mode, p1_id, p2_id, wager) VALUES (?, ?, ?, ?, ?)')
      .run(id, mode, p1Id, p2Id, wager);
  }

  complete(
    id: string,
    winnerId: number | null,
    reason: MatchEndReason,
    p1Score: number,
    p2Score: number,
    rounds: CompletedRound[]
  ): void {
    const run = this.db.transaction(() => {
      this.db
        .prepare(
          "UPDATE matches SET status = 'complete', winner_id = ?, end_reason = ?, p1_score = ?, p2_score = ?, ended_at = datetime('now') WHERE id = ?"
        )
        .run(winnerId, reason, p1Score, p2Score, id);
      const ins = this.db.prepare(
        'INSERT INTO rounds (match_id, round_no, seq, p1_move, p2_move, winner) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const r of rounds) ins.run(id, r.roundNo, r.seq, r.p1Move, r.p2Move, r.winner);
    });
    run();
  }

  recordResult(winnerId: number, loserId: number): void {
    this.db.prepare('UPDATE users SET wins = wins + 1 WHERE id = ?').run(winnerId);
    this.db.prepare('UPDATE users SET losses = losses + 1 WHERE id = ?').run(loserId);
  }

  /** Completed matches for a user, newest first, with opponent + own Elo delta. */
  historyFor(userId: number, limit = 30): MatchHistoryRow[] {
    const rows = this.db
      .prepare(
        `SELECT m.*, u.*, m.id AS mid, m.created_at AS mcreated,
                (SELECT e.delta FROM elo_history e WHERE e.match_id = m.id AND e.user_id = ?) AS elo_delta
         FROM matches m
         LEFT JOIN users u ON u.id = CASE WHEN m.p1_id = ? THEN m.p2_id ELSE m.p1_id END
         WHERE m.status = 'complete' AND (m.p1_id = ? OR m.p2_id = ?)
         ORDER BY m.ended_at DESC, m.rowid DESC
         LIMIT ?`
      )
      .all(userId, userId, userId, userId, limit) as Array<Record<string, unknown>>;
    return rows.map((r) => {
      const isP1 = (r.p1_id as number) === userId;
      const myScore = isP1 ? (r.p1_score as number) : (r.p2_score as number);
      const oppScore = isP1 ? (r.p2_score as number) : (r.p1_score as number);
      const mode = r.mode as MatchMode;
      const wager = r.wager as number;
      const winnerId = r.winner_id as number | null;
      const won = winnerId === userId;
      const opponent =
        mode === 'bot' || r.id == null
          ? null
          : toPublicProfile(r as unknown as UserRow);
      return {
        matchId: r.mid as string,
        mode,
        wager,
        opponent,
        won,
        // In bot matches a null winner means the bot won; in PvP it means
        // the match was aborted (double-AFK) and wagers were refunded.
        aborted: winnerId === null && mode !== 'bot',
        myScore,
        oppScore,
        endReason: r.end_reason as MatchEndReason,
        eloDelta: (r.elo_delta as number | null) ?? 0,
        coinsDelta: mode === 'ranked' ? (won ? wager : winnerId === null ? 0 : -wager) : 0,
        endedAt: r.ended_at as string,
      };
    });
  }

  updateElo(userId: number, matchId: string, delta: number, ratingAfter: number): void {
    this.db.prepare('UPDATE users SET elo = ? WHERE id = ?').run(ratingAfter, userId);
    this.db
      .prepare('INSERT INTO elo_history (user_id, match_id, delta, rating_after) VALUES (?, ?, ?, ?)')
      .run(userId, matchId, delta, ratingAfter);
  }
}
