import { create } from 'zustand';
import type { FriendEntry, ChallengePayload } from '@rps/shared';
import { api } from '../api/client';

interface FriendsState {
  friends: FriendEntry[];
  incomingChallenge: ChallengePayload | null;
  refresh(): Promise<void>;
  setPresence(userId: number, online: boolean): void;
  setIncomingChallenge(challenge: ChallengePayload | null): void;
}

export const useFriendsStore = create<FriendsState>((set) => ({
  friends: [],
  incomingChallenge: null,

  async refresh() {
    try {
      set({ friends: await api.friends() });
    } catch {
      // Keep the last known list on transient failures.
    }
  },

  setPresence(userId, online) {
    set((s) => ({
      friends: s.friends.map((f) => (f.user.id === userId ? { ...f, online } : f)),
    }));
  },

  setIncomingChallenge(challenge) {
    set({ incomingChallenge: challenge });
  },
}));
