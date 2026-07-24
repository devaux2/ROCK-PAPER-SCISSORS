import type { DB } from '../db';
import type { TransactionType, TransactionRow } from '@rps/shared';

export class InsufficientFundsError extends Error {
  constructor() {
    super('Insufficient coins');
  }
}

export class TransactionsRepo {
  constructor(private db: DB) {}

  /**
   * Atomically apply a signed coin movement and record it.
   * Throws InsufficientFundsError if the balance would go negative.
   */
  apply(userId: number, amount: number, type: TransactionType, matchId?: string): number {
    const run = this.db.transaction(() => {
      const row = this.db.prepare('SELECT coins FROM users WHERE id = ?').get(userId) as
        | { coins: number }
        | undefined;
      if (!row) throw new Error('user not found');
      const after = row.coins + amount;
      if (after < 0) throw new InsufficientFundsError();
      this.db.prepare('UPDATE users SET coins = ? WHERE id = ?').run(after, userId);
      this.db
        .prepare(
          'INSERT INTO transactions (user_id, amount, type, match_id, balance_after) VALUES (?, ?, ?, ?, ?)'
        )
        .run(userId, amount, type, matchId ?? null, after);
      return after;
    });
    return run();
  }

  history(userId: number, limit = 50): TransactionRow[] {
    const rows = this.db
      .prepare(
        'SELECT id, amount, type, match_id, balance_after, created_at FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT ?'
      )
      .all(userId, limit) as Array<{
      id: number;
      amount: number;
      type: TransactionType;
      match_id: string | null;
      balance_after: number;
      created_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      amount: r.amount,
      type: r.type,
      matchId: r.match_id,
      balanceAfter: r.balance_after,
      createdAt: r.created_at,
    }));
  }
}
