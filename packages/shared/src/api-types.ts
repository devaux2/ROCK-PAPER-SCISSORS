import type { TransactionType } from './economy';

export interface UserProfile {
  id: number;
  username: string;
  bio: string;
  /** Built-in avatar id like 'avatar_03', or 'b64:<base64 png>' for a custom photo. */
  avatar: string;
  coins: number;
  wins: number;
  losses: number;
  /** wins / (wins + losses), 0 when unplayed. Excludes bot matches. */
  winRate: number;
  /** Largest single pot ever collected (payout amount), 0 if none. */
  biggestWin: number;
  createdAt: string;
}

/** What other players see (no coin balance). */
export type PublicProfile = Omit<UserProfile, 'coins'>;

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export type FriendshipStatus = 'pending' | 'accepted';

export interface FriendEntry {
  user: PublicProfile;
  status: FriendshipStatus;
  /** True when the other user sent the request and it awaits our accept. */
  incoming: boolean;
  online: boolean;
}

export interface LeaderboardRow {
  rank: number;
  user: PublicProfile;
  /** Net coins won in the window — the headline number. */
  coinsWon: number;
}

export type LeaderboardWindow = 'weekly' | 'monthly';

/** One entry in the global "recent big wins" ticker. */
export interface RecentWinRow {
  username: string;
  avatar: string;
  /** Pot collected (payout amount). */
  amount: number;
  at: string;
}

export interface TransactionRow {
  id: number;
  amount: number;
  type: TransactionType;
  matchId: string | null;
  balanceAfter: number;
  createdAt: string;
}

export interface TopupResponse {
  granted: number;
  coins: number;
}

export interface SocialBonusResponse {
  granted: number;
  coins: number;
}

export interface MatchHistoryRow {
  matchId: string;
  mode: 'ranked' | 'casual' | 'bot';
  wager: number;
  /** null for bot matches. */
  opponent: PublicProfile | null;
  won: boolean;
  /** Double-AFK abort — no winner, wagers refunded. */
  aborted: boolean;
  myScore: number;
  oppScore: number;
  endReason: 'score' | 'forfeit' | 'disconnect';
  coinsDelta: number;
  endedAt: string;
}

export interface ApiError {
  error: string;
}
