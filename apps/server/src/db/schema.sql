CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT 'avatar_01',
  coins INTEGER NOT NULL DEFAULT 500,
  elo INTEGER NOT NULL DEFAULT 1000,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  last_topup_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id INTEGER NOT NULL REFERENCES users(id),
  addressee_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(requester_id, addressee_id),
  CHECK(requester_id != addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id);

CREATE TABLE IF NOT EXISTS matches (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK(mode IN ('ranked','casual','bot')),
  p1_id INTEGER NOT NULL REFERENCES users(id),
  p2_id INTEGER REFERENCES users(id),
  wager INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','complete')),
  winner_id INTEGER REFERENCES users(id),
  end_reason TEXT CHECK(end_reason IN ('score','forfeit','disconnect')),
  p1_score INTEGER NOT NULL DEFAULT 0,
  p2_score INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS rounds (
  match_id TEXT NOT NULL REFERENCES matches(id),
  round_no INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  p1_move TEXT NOT NULL,
  p2_move TEXT NOT NULL,
  winner TEXT NOT NULL CHECK(winner IN ('p1','p2','draw')),
  PRIMARY KEY(match_id, seq)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('signup_bonus','wager_escrow','wager_refund','payout','daily_topup')),
  match_id TEXT,
  balance_after INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_time ON transactions(created_at);

CREATE TABLE IF NOT EXISTS elo_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  match_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  rating_after INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_elo_history_time ON elo_history(created_at);
