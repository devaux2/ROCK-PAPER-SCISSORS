import { create } from 'zustand';
import type {
  Move,
  MatchMode,
  OpponentInfo,
  RoundResultPayload,
  MatchEndPayload,
  MatchStartPayload,
  MatchStatePayload,
  EmoteId,
} from '@rps/shared';

export type MatchPhase = 'idle' | 'queueing' | 'choosing' | 'revealing' | 'ended';

export interface IncomingEmote {
  emoteId: EmoteId;
  /** Monotonic key so repeated emotes re-trigger the bubble. */
  seq: number;
}

interface MatchState {
  phase: MatchPhase;
  matchId: string | null;
  mode: MatchMode | null;
  wager: number;
  opponent: OpponentInfo | null;
  seat: 'p1' | 'p2';
  roundNo: number;
  deadline: number | null;
  scores: { p1: number; p2: number };
  myMove: Move | null;
  lastResult: RoundResultPayload | null;
  endResult: MatchEndPayload | null;
  incomingEmote: IncomingEmote | null;
  rematchOffered: boolean;
  queueMode: 'ranked' | 'casual' | null;
  queueWager: number;

  startQueueing(mode: 'ranked' | 'casual', wager: number): void;
  stopQueueing(): void;
  onMatchStart(p: MatchStartPayload): void;
  onRoundStart(p: { roundNo: number; deadline: number; scores: { p1: number; p2: number } }): void;
  onRoundResult(p: RoundResultPayload): void;
  onMatchEnd(p: MatchEndPayload): void;
  onResync(p: MatchStatePayload): void;
  onEmote(emoteId: EmoteId): void;
  onRematchOffered(): void;
  setMyMove(move: Move): void;
  reset(): void;
}

const initial = {
  phase: 'idle' as MatchPhase,
  matchId: null,
  mode: null,
  wager: 0,
  opponent: null,
  seat: 'p1' as const,
  roundNo: 1,
  deadline: null,
  scores: { p1: 0, p2: 0 },
  myMove: null,
  lastResult: null,
  endResult: null,
  incomingEmote: null,
  rematchOffered: false,
  queueMode: null,
  queueWager: 0,
};

export const useMatchStore = create<MatchState>((set, get) => ({
  ...initial,

  startQueueing(mode, wager) {
    // Never clobber a match that already started (instant pairing race).
    const phase = get().phase;
    if (phase === 'choosing' || phase === 'revealing') return;
    set({ ...initial, phase: 'queueing', queueMode: mode, queueWager: wager });
  },

  stopQueueing() {
    if (get().phase === 'queueing') set({ ...initial });
  },

  onMatchStart(p) {
    set({
      ...initial,
      phase: 'choosing',
      matchId: p.matchId,
      mode: p.mode,
      wager: p.wager,
      opponent: p.opponent,
      seat: p.seat,
    });
  },

  onRoundStart(p) {
    set({
      phase: 'choosing',
      roundNo: p.roundNo,
      deadline: p.deadline,
      scores: p.scores,
      myMove: null,
      lastResult: null,
    });
  },

  onRoundResult(p) {
    set({ phase: 'revealing', lastResult: p, scores: p.scores, deadline: null });
  },

  onMatchEnd(p) {
    set({ phase: 'ended', endResult: p, scores: p.scores, deadline: null });
  },

  onResync(p) {
    set({
      phase: 'choosing',
      matchId: p.matchId,
      mode: p.mode,
      wager: p.wager,
      opponent: p.opponent,
      seat: p.seat,
      roundNo: p.roundNo,
      deadline: p.deadline,
      scores: p.scores,
      myMove: p.youMoved ? get().myMove : null,
    });
  },

  onEmote(emoteId) {
    set((s) => ({ incomingEmote: { emoteId, seq: (s.incomingEmote?.seq ?? 0) + 1 } }));
  },

  onRematchOffered() {
    set({ rematchOffered: true });
  },

  setMyMove(move) {
    set({ myMove: move });
  },

  reset() {
    set({ ...initial });
  },
}));
