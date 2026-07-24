import type { DB } from '../db';
import type { MatchMode, MatchEndReason, Move } from '@rps/shared';

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

  updateElo(userId: number, matchId: string, delta: number, ratingAfter: number): void {
    this.db.prepare('UPDATE users SET elo = ? WHERE id = ?').run(ratingAfter, userId);
    this.db
      .prepare('INSERT INTO elo_history (user_id, match_id, delta, rating_after) VALUES (?, ?, ?, ?)')
      .run(userId, matchId, delta, ratingAfter);
  }
}
