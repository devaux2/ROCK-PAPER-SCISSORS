import type { DB } from '../db';
import type { UserProfile, PublicProfile } from '@rps/shared';
import { STARTING_COINS } from '@rps/shared';

export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  bio: string;
  avatar: string;
  coins: number;
  elo: number;
  wins: number;
  losses: number;
  last_topup_at: string | null;
  created_at: string;
  /** Present when the row was selected through UsersRepo (subquery). */
  biggest_win?: number;
}

export function toProfile(row: UserRow): UserProfile {
  const played = row.wins + row.losses;
  return {
    id: row.id,
    username: row.username,
    bio: row.bio,
    avatar: row.avatar,
    coins: row.coins,
    wins: row.wins,
    losses: row.losses,
    winRate: played === 0 ? 0 : row.wins / played,
    biggestWin: row.biggest_win ?? 0,
    createdAt: row.created_at,
  };
}

export function toPublicProfile(row: UserRow): PublicProfile {
  const { coins: _coins, ...rest } = toProfile(row);
  return rest;
}

export class UsersRepo {
  constructor(private db: DB) {}

  create(username: string, passwordHash: string): UserRow {
    const info = this.db
      .prepare('INSERT INTO users (username, password_hash, coins) VALUES (?, ?, ?)')
      .run(username, passwordHash, STARTING_COINS);
    const user = this.byId(Number(info.lastInsertRowid))!;
    this.db
      .prepare(
        'INSERT INTO transactions (user_id, amount, type, balance_after) VALUES (?, ?, ?, ?)'
      )
      .run(user.id, STARTING_COINS, 'signup_bonus', STARTING_COINS);
    return user;
  }

  private static readonly SELECT = `
    SELECT u.*, COALESCE((
      SELECT MAX(t.amount) FROM transactions t
      WHERE t.user_id = u.id AND t.type = 'payout'
    ), 0) AS biggest_win
    FROM users u`;

  byId(id: number): UserRow | undefined {
    return this.db.prepare(`${UsersRepo.SELECT} WHERE u.id = ?`).get(id) as UserRow | undefined;
  }

  byUsername(username: string): UserRow | undefined {
    return this.db.prepare(`${UsersRepo.SELECT} WHERE u.username = ?`).get(username) as
      | UserRow
      | undefined;
  }

  updateProfile(id: number, fields: { bio?: string; avatar?: string }): UserRow {
    const current = this.byId(id);
    if (!current) throw new Error('user not found');
    this.db
      .prepare('UPDATE users SET bio = ?, avatar = ? WHERE id = ?')
      .run(fields.bio ?? current.bio, fields.avatar ?? current.avatar, id);
    return this.byId(id)!;
  }
}
