import type { DB } from '../db';
import type { UserRow } from './users.repo';

export interface FriendshipRow {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: 'pending' | 'accepted';
  created_at: string;
}

export class FriendsRepo {
  constructor(private db: DB) {}

  between(a: number, b: number): FriendshipRow | undefined {
    return this.db
      .prepare(
        'SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)'
      )
      .get(a, b, b, a) as FriendshipRow | undefined;
  }

  request(requesterId: number, addresseeId: number): FriendshipRow {
    const info = this.db
      .prepare('INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?)')
      .run(requesterId, addresseeId);
    return this.db.prepare('SELECT * FROM friendships WHERE id = ?').get(Number(info.lastInsertRowid)) as FriendshipRow;
  }

  accept(id: number): void {
    this.db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?").run(id);
  }

  remove(id: number): void {
    this.db.prepare('DELETE FROM friendships WHERE id = ?').run(id);
  }

  areFriends(a: number, b: number): boolean {
    return this.between(a, b)?.status === 'accepted';
  }

  /** All friendships (pending + accepted) involving the user, with the other user's row joined. */
  listFor(userId: number): Array<{ friendship: FriendshipRow; other: UserRow }> {
    const rows = this.db
      .prepare(
        `SELECT f.id fid, f.requester_id, f.addressee_id, f.status, f.created_at fcreated, u.*
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
         WHERE f.requester_id = ? OR f.addressee_id = ?
         ORDER BY f.status DESC, u.username`
      )
      .all(userId, userId, userId) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      friendship: {
        id: r.fid as number,
        requester_id: r.requester_id as number,
        addressee_id: r.addressee_id as number,
        status: r.status as 'pending' | 'accepted',
        created_at: r.fcreated as string,
      },
      other: {
        id: r.id as number,
        username: r.username as string,
        password_hash: r.password_hash as string,
        bio: r.bio as string,
        avatar: r.avatar as string,
        coins: r.coins as number,
        elo: r.elo as number,
        wins: r.wins as number,
        losses: r.losses as number,
        last_topup_at: r.last_topup_at as string | null,
        created_at: r.created_at as string,
      },
    }));
  }
}
