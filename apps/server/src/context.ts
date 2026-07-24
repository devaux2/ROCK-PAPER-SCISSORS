import type { DB } from './db/db';
import { UsersRepo } from './db/repos/users.repo';
import { FriendsRepo } from './db/repos/friends.repo';
import { MatchesRepo } from './db/repos/matches.repo';
import { TransactionsRepo } from './db/repos/transactions.repo';
import { LeaderboardRepo } from './db/repos/leaderboard.repo';

export interface AppContext {
  db: DB;
  users: UsersRepo;
  friends: FriendsRepo;
  matches: MatchesRepo;
  transactions: TransactionsRepo;
  leaderboard: LeaderboardRepo;
}

export function createContext(db: DB): AppContext {
  return {
    db,
    users: new UsersRepo(db),
    friends: new FriendsRepo(db),
    matches: new MatchesRepo(db),
    transactions: new TransactionsRepo(db),
    leaderboard: new LeaderboardRepo(db),
  };
}
