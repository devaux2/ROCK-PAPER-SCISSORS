import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type DB = Database.Database;

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf-8');

export function openDb(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  migrate(db);
  return db;
}

/**
 * In-place migrations for databases created by older builds. SQLite can't
 * ALTER a CHECK constraint, so widening transactions.type means rebuilding
 * the table (rename → recreate → copy → drop).
 */
function migrate(db: DB): void {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='transactions'")
    .get() as { sql: string } | undefined;
  if (row && !row.sql.includes('social_bonus')) {
    db.pragma('foreign_keys = OFF');
    db.transaction(() => {
      db.exec('ALTER TABLE transactions RENAME TO transactions_old');
      db.exec(`CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('signup_bonus','wager_escrow','wager_refund','payout','daily_topup','social_bonus')),
        match_id TEXT,
        balance_after INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`);
      db.exec(`INSERT INTO transactions (id, user_id, amount, type, match_id, balance_after, created_at)
        SELECT id, user_id, amount, type, match_id, balance_after, created_at FROM transactions_old`);
      db.exec('DROP TABLE transactions_old');
    })();
    db.pragma('foreign_keys = ON');
    // Recreate any indexes that were dropped with the old table.
    db.exec(schema);
  }
}
