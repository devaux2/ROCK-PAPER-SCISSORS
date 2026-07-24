import { describe, it, expect, beforeEach } from 'vitest';
import { useMatchStore } from '../src/stores/matchStore';
import type { MatchStartPayload, RoundResultPayload, MatchEndPayload } from '@rps/shared';

const opponent = {
  id: 2,
  username: 'rival',
  bio: '',
  avatar: 'avatar_02',
  elo: 1010,
  wins: 3,
  losses: 1,
  winRate: 0.75,
  createdAt: '2026-01-01',
};

const startPayload: MatchStartPayload = {
  matchId: 'm1',
  mode: 'ranked',
  wager: 50,
  opponent,
  seat: 'p1',
};

describe('matchStore', () => {
  beforeEach(() => {
    useMatchStore.getState().reset();
  });

  it('walks through a full match lifecycle', () => {
    const s = useMatchStore.getState;

    s().startQueueing('ranked', 50);
    expect(s().phase).toBe('queueing');
    expect(s().queueWager).toBe(50);

    s().onMatchStart(startPayload);
    expect(s().phase).toBe('choosing');
    expect(s().matchId).toBe('m1');
    expect(s().opponent?.username).toBe('rival');

    s().onRoundStart({ roundNo: 1, deadline: Date.now() + 10000, scores: { p1: 0, p2: 0 } });
    s().setMyMove('A');
    expect(s().myMove).toBe('A');

    const result: RoundResultPayload = {
      matchId: 'm1',
      roundNo: 1,
      yourMove: 'A',
      oppMove: 'C',
      outcome: 'win',
      scores: { p1: 1, p2: 0 },
    };
    s().onRoundResult(result);
    expect(s().phase).toBe('revealing');
    expect(s().scores).toEqual({ p1: 1, p2: 0 });

    // Next round clears the selection.
    s().onRoundStart({ roundNo: 2, deadline: Date.now() + 10000, scores: { p1: 1, p2: 0 } });
    expect(s().phase).toBe('choosing');
    expect(s().myMove).toBeNull();
    expect(s().lastResult).toBeNull();

    const end: MatchEndPayload = {
      matchId: 'm1',
      youWon: true,
      reason: 'score',
      scores: { p1: 2, p2: 0 },
      eloDelta: 16,
      coinsDelta: 50,
      newElo: 1016,
      newCoins: 550,
    };
    s().onMatchEnd(end);
    expect(s().phase).toBe('ended');
    expect(s().endResult?.youWon).toBe(true);
  });

  it('match start resets stale end state from a previous match', () => {
    const s = useMatchStore.getState;
    s().onMatchStart(startPayload);
    s().onMatchEnd({
      matchId: 'm1',
      youWon: false,
      reason: 'forfeit',
      scores: { p1: 0, p2: 2 },
      eloDelta: -16,
      coinsDelta: -50,
      newElo: 984,
      newCoins: 450,
    });
    s().onRematchOffered();
    expect(s().rematchOffered).toBe(true);

    s().onMatchStart({ ...startPayload, matchId: 'm2' });
    expect(s().matchId).toBe('m2');
    expect(s().endResult).toBeNull();
    expect(s().rematchOffered).toBe(false);
    expect(s().scores).toEqual({ p1: 0, p2: 0 });
  });

  it('emote sequence increments so repeats re-trigger', () => {
    const s = useMatchStore.getState;
    s().onEmote('laugh');
    s().onEmote('laugh');
    expect(s().incomingEmote?.seq).toBe(2);
  });

  it('resync restores an in-flight match', () => {
    const s = useMatchStore.getState;
    s().onResync({
      matchId: 'm9',
      mode: 'casual',
      wager: 0,
      opponent,
      seat: 'p2',
      roundNo: 2,
      deadline: Date.now() + 5000,
      scores: { p1: 1, p2: 1 },
      youMoved: false,
    });
    expect(s().phase).toBe('choosing');
    expect(s().seat).toBe('p2');
    expect(s().scores).toEqual({ p1: 1, p2: 1 });
    expect(s().myMove).toBeNull();
  });
});
