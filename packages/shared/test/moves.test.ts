import { describe, it, expect } from 'vitest';
import { beats, isMove, randomMove, MOVES, type Move } from '../src/moves';
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

describe('economy & emotes validators', () => {
  it('wager tiers', () => {
    expect(isWagerTier(1)).toBe(true);
    expect(isWagerTier(20)).toBe(true);
    expect(isWagerTier(1000)).toBe(true);
    expect(isWagerTier(500)).toBe(false);
    expect(isWagerTier(37)).toBe(false);
  });
  it('emote ids', () => {
    expect(isEmoteId('laugh')).toBe(true);
    expect(isEmoteId('rude')).toBe(false);
  });
});
