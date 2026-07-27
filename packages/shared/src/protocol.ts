import type { Move, RoundOutcome } from './moves';
import type { WagerTier } from './economy';
import type { EmoteId } from './emotes';
import type { PublicProfile } from './api-types';

export type MatchMode = 'ranked' | 'casual' | 'bot';
export type MatchEndReason = 'score' | 'forfeit' | 'disconnect' | 'no_play';
/** What lands in persistence/history — no_play is stored as a forfeit. */
export type StoredEndReason = 'score' | 'forfeit' | 'disconnect';

/** Server-side timings, exported so clients and tests share one source of truth. */
export const ROUND_TIME_MS = 4_000;
/** Extra time on the very first round so the match-found moment isn't unfair. */
export const FIRST_ROUND_EXTRA_MS = 1_200;
export const REVEAL_TIME_MS = 3_000;
export const DISCONNECT_GRACE_MS = 10_000;
export const CHALLENGE_TTL_MS = 60_000;
export const REMATCH_TTL_MS = 60_000;

export interface OpponentInfo extends PublicProfile {
  isBot?: boolean;
}

export interface MatchStartPayload {
  matchId: string;
  mode: MatchMode;
  wager: number;
  opponent: OpponentInfo;
  /** Which seat you occupy; scores are always [p1, p2]. */
  seat: 'p1' | 'p2';
}

export interface RoundStartPayload {
  matchId: string;
  roundNo: number;
  /** Epoch ms deadline — absolute so client countdowns can't drift. */
  deadline: number;
  scores: { p1: number; p2: number };
}

export interface RoundResultPayload {
  matchId: string;
  roundNo: number;
  yourMove: Move;
  oppMove: Move;
  outcome: RoundOutcome;
  scores: { p1: number; p2: number };
}

export interface MatchEndPayload {
  matchId: string;
  youWon: boolean;
  reason: MatchEndReason;
  scores: { p1: number; p2: number };
  coinsDelta: number;
  newCoins: number;
}

export interface MatchStatePayload {
  /** Full resync snapshot sent on reconnect. */
  matchId: string;
  mode: MatchMode;
  wager: number;
  opponent: OpponentInfo;
  seat: 'p1' | 'p2';
  roundNo: number;
  deadline: number | null;
  scores: { p1: number; p2: number };
  youMoved: boolean;
}

export interface ChallengePayload {
  challengeId: string;
  from: PublicProfile;
  wager: number;
  expiresAt: number;
}

export interface QueueStatusPayload {
  mode: 'ranked' | 'casual';
  wager: number;
  waitingSince: number;
}

/**
 * Opaque WebRTC signaling blob (SDP offer/answer or ICE candidate) relayed
 * verbatim between the two participants of a match. The server never
 * inspects it. Voice stays available through the end screen for the same
 * window as end-screen emotes.
 */
export interface VoiceSignalPayload {
  matchId: string;
  data: unknown;
}

export interface ClientToServerEvents {
  'queue:join': (p: { mode: 'ranked' | 'casual'; wagerTier?: WagerTier }, ack: (r: { ok: boolean; error?: string }) => void) => void;
  'queue:leave': () => void;
  'bot:start': (ack: (r: { ok: boolean; error?: string }) => void) => void;
  'challenge:send': (p: { toUserId: number; wagerTier?: WagerTier }, ack: (r: { ok: boolean; challengeId?: string; error?: string }) => void) => void;
  'challenge:accept': (p: { challengeId: string }, ack: (r: { ok: boolean; error?: string }) => void) => void;
  'challenge:decline': (p: { challengeId: string }) => void;
  'match:move': (p: { matchId: string; move: Move }, ack: (r: { ok: boolean; error?: string }) => void) => void;
  'match:emote': (p: { matchId: string; emoteId: EmoteId }) => void;
  'match:rematch': (p: { matchId: string }, ack: (r: { ok: boolean; error?: string }) => void) => void;
  'match:forfeit': (p: { matchId: string }) => void;
  'match:resync': (ack: (state: MatchStatePayload | null) => void) => void;
  'voice:signal': (p: VoiceSignalPayload) => void;
}

export interface ServerToClientEvents {
  'queue:status': (p: QueueStatusPayload) => void;
  'match:start': (p: MatchStartPayload) => void;
  'round:start': (p: RoundStartPayload) => void;
  'round:result': (p: RoundResultPayload) => void;
  'match:end': (p: MatchEndPayload) => void;
  'match:emote': (p: { matchId: string; emoteId: EmoteId }) => void;
  'match:state': (p: MatchStatePayload) => void;
  'challenge:incoming': (p: ChallengePayload) => void;
  'challenge:result': (p: { challengeId: string; accepted: boolean }) => void;
  'rematch:offered': (p: { matchId: string }) => void;
  'friend:presence': (p: { userId: number; online: boolean }) => void;
  'voice:signal': (p: VoiceSignalPayload) => void;
}
