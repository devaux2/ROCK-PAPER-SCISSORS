import { describe, it, expect } from 'vitest';
import { beats, isMove, randomMove, MOVES, type Move } from '../src/moves';
import { eloUpdate, expectedScore } from '../src/elo';
import { isWagerTier } from '../src/economy';
import { isEmoteId } from '../src/emotes';

describe('beats — full truth table', () => {
  const table: Array<[Move, Move, string]> = [
    ['A', 'A', 'draw'],
    ['A', 'B', 'lose'],
    ['A', 'C', 'win'],
    ['B', 'A', 'win'],
    ['B', 'B', 'draw'],
    ['B', 'C', 'lose'],
    ['C', 'A', 'lose'],
    ['C', 'B', 'win'],
    ['C', 'C', 'draw'],
  ];
  it.each(table)('%s vs %s -> %s', (mine, theirs, expected) => {
    expect(beats(mine, theirs)).toBe(expected);
  });

  it('is a perfect cycle: every move beats exactly one and loses to exactly one', () => {
    for (const m of MOVES) {
      const wins = MOVES.filter((o) => beats(m, o) === 'win');
      const losses = MOVES.filter((o) => beats(m, o) === 'lose');
      expect(wins).toHaveLength(1);
      expect(losses).toHaveLength(1);
    }
  });
});

describe('isMove / randomMove', () => {
  it('validates moves', () => {
    expect(isMove('A')).toBe(true);
    expect(isMove('rock')).toBe(false);
    expect(isMove(null)).toBe(false);
  });
  it('randomMove covers all moves and only moves', () => {
    expect(randomMove(() => 0)).toBe('A');
    expect(randomMove(() => 0.5)).toBe('B');
    expect(randomMove(() => 0.99)).toBe('C');
  });
});

describe('elo', () => {
  it('equal ratings: winner gains K/2 = 16', () => {
    const r = eloUpdate(1000, 1000);
    expect(r.winnerDelta).toBe(16);
    expect(r.loserDelta).toBe(-16);
    expect(r.winnerNew).toBe(1016);
    expect(r.loserNew).toBe(984);
  });
  it('underdog win pays more than favourite win', () => {
    const underdog = eloUpdate(900, 1100);
    const favourite = eloUpdate(1100, 900);
    expect(underdog.winnerDelta).toBeGreaterThan(favourite.winnerDelta);
  });
  it('deltas are symmetric (zero-sum)', () => {
    const r = eloUpdate(1234, 987);
    expect(r.winnerDelta + r.loserDelta).toBe(0);
  });
  it('expectedScore is complementary', () => {
    expect(expectedScore(1000, 1200) + expectedScore(1200, 1000)).toBeCloseTo(1);
  });
});

describe('economy & emotes validators', () => {
  it('wager tiers', () => {
    expect(isWagerTier(50)).toBe(true);
    expect(isWagerTier(37)).toBe(false);
  });
  it('emote ids', () => {
    expect(isEmoteId('laugh')).toBe(true);
    expect(isEmoteId('rude')).toBe(false);
  });
});
