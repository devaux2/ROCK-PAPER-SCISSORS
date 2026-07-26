import type {
  AuthResponse,
  UserProfile,
  PublicProfile,
  FriendEntry,
  LeaderboardRow,
  LeaderboardWindow,
  TransactionRow,
  TopupResponse,
  MatchHistoryRow,
  RecentWinRow,
} from '@rps/shared';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

interface ApiConfig {
  baseUrl: string;
  getToken: () => string | null;
}

let cfg: ApiConfig = { baseUrl: 'http://localhost:3001', getToken: () => null };

export function configureApi(config: ApiConfig): void {
  cfg = config;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = cfg.getToken();
  const res = await fetch(cfg.baseUrl + path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  signup: (username: string, password: string) =>
    request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify({ username, password }) }),
  login: (username: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  me: () => request<UserProfile>('/users/me'),
  updateProfile: (fields: { bio?: string; avatar?: string }) =>
    request<UserProfile>('/users/me', { method: 'PATCH', body: JSON.stringify(fields) }),
  user: (id: number) => request<PublicProfile>(`/users/${id}`),
  friends: () => request<FriendEntry[]>('/friends'),
  sendFriendRequest: (username: string) =>
    request<{ ok: boolean }>('/friends/request', { method: 'POST', body: JSON.stringify({ username }) }),
  acceptFriend: (userId: number) => request<{ ok: boolean }>(`/friends/${userId}/accept`, { method: 'POST' }),
  declineFriend: (userId: number) => request<{ ok: boolean }>(`/friends/${userId}/decline`, { method: 'POST' }),
  removeFriend: (userId: number) => request<{ ok: boolean }>(`/friends/${userId}`, { method: 'DELETE' }),
  leaderboard: (window: LeaderboardWindow) => request<LeaderboardRow[]>(`/leaderboards?window=${window}`),
  winsFeed: () => request<RecentWinRow[]>('/leaderboards/feed'),
  dailyTopup: () => request<TopupResponse>('/economy/daily-topup', { method: 'POST' }),
  history: () => request<TransactionRow[]>('/economy/history'),
  matchHistory: () => request<MatchHistoryRow[]>('/matches/history'),
};
