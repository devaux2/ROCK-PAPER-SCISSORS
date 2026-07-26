import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ROUND_TIME_MS,
  FIRST_ROUND_EXTRA_MS,
  REVEAL_TIME_MS,
  DISCONNECT_GRACE_MS,
  type MatchEndPayload,
} from '@rps/shared';
import { MatchEngine, type MatchResult, type SeatSettlement } from '../src/game/MatchEngine';
import { FakePort } from './helpers';

// Round 1 carries the match-found grace on top of the base window.
const ROUND1_MS = ROUND_TIME_MS + FIRST_ROUND_EXTRA_MS;

const blank: SeatSettlement = { coinsDelta: 0, newCoins: 500 };

/** rng pinned to 0 makes every timeout-filled random move 'A' (deterministic draws). */
function makeEngine(p1: FakePort, p2: FakePort, rng: () => number = () => 0) {
  const results: MatchResult[] = [];
  const engine = new MatchEngine({
    matchId: 'm1',
    mode: 'casual',
    wager: 0,
    p1,
    p2,
    rng,
    onEnd: (result) => {
      results.push(result);
      return { p1: blank, p2: blank };
    },
  });
  return { engine, results };
}

describe('MatchEngine (sudden death: first decisive throw wins)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('one decisive throw ends the match', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    expect(p1.last('match:start')?.seat).toBe('p1');
    expect(p2.last('match:start')?.opponent.id).toBe(1);
    expect(p1.last('round:start')?.roundNo).toBe(1);

    engine.submitMove(1, 'A'); // A beats C
    engine.submitMove(2, 'C');
    expect(p1.last('round:result')?.outcome).toBe('win');
    expect(p2.last('round:result')?.outcome).toBe('lose');
    expect(p1.last('round:result')?.scores).toEqual({ p1: 1, p2: 0 });

    vi.advanceTimersByTime(REVEAL_TIME_MS);
    expect(results).toHaveLength(1);
    expect(results[0]!.winnerSeat).toBe('p1');
    expect(results[0]!.reason).toBe('score');
    expect(results[0]!.scores).toEqual({ p1: 1, p2: 0 });
    expect((p1.last('match:end') as MatchEndPayload).youWon).toBe(true);
    expect((p2.last('match:end') as MatchEndPayload).youWon).toBe(false);
  });

  it('drawn throws replay until someone lands a hit', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    engine.submitMove(1, 'A');
    engine.submitMove(2, 'A'); // draw
    expect(p1.last('round:result')?.outcome).toBe('draw');
    expect(p1.last('round:result')?.scores).toEqual({ p1: 0, p2: 0 });
    vi.advanceTimersByTime(REVEAL_TIME_MS);
    // Replay keeps the same round number.
    expect(p1.last('round:start')?.roundNo).toBe(1);

    engine.submitMove(1, 'B');
    engine.submitMove(2, 'A'); // B beats A
    vi.advanceTimersByTime(REVEAL_TIME_MS);

    expect(results[0]!.winnerSeat).toBe('p1');
    expect(results[0]!.scores).toEqual({ p1: 1, p2: 0 });
    expect(results[0]!.rounds).toHaveLength(2);
    expect(results[0]!.rounds[0]!.winner).toBe('draw');
  });

  it('a no-show loses the match immediately — idling can never win a pot', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    engine.submitMove(1, 'A');
    vi.advanceTimersByTime(ROUND1_MS); // p2 never throws
    expect(results).toHaveLength(1);
    expect(results[0]!.winnerSeat).toBe('p1');
    expect(results[0]!.reason).toBe('no_play');
    // No fabricated round was revealed.
    expect(results[0]!.rounds).toHaveLength(0);
  });

  it('voids the match when both players idle twice (stakes refunded)', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    vi.advanceTimersByTime(ROUND1_MS); // both idle #1 -> silent replay
    expect(results).toHaveLength(0);
    expect(p1.count('round:start')).toBe(2);
    vi.advanceTimersByTime(ROUND_TIME_MS); // both idle #2 -> void

    expect(results[0]!.winnerSeat).toBeNull();
    expect(results[0]!.reason).toBe('forfeit');
  });

  it('a thrown round resets the both-idle strike counter', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    vi.advanceTimersByTime(ROUND1_MS); // both idle #1 -> replay
    engine.submitMove(1, 'A');
    engine.submitMove(2, 'A'); // both throw -> counters reset (draw, replay)
    vi.advanceTimersByTime(REVEAL_TIME_MS);
    vi.advanceTimersByTime(ROUND_TIME_MS); // both idle again — strike #1, not #2

    expect(results).toHaveLength(0);
  });

  it('rejects double moves and out-of-phase moves', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine } = makeEngine(p1, p2);
    engine.start();

    expect(engine.submitMove(1, 'A').ok).toBe(true);
    expect(engine.submitMove(1, 'B').ok).toBe(false);
    expect(engine.submitMove(99, 'A').ok).toBe(false);
    engine.submitMove(2, 'A'); // draw -> reveal phase
    // Reveal phase — no moves accepted.
    expect(engine.submitMove(1, 'A').ok).toBe(false);
  });

  it('forfeits a disconnected player after the grace period', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    engine.playerDisconnected(2);
    engine.submitMove(1, 'A');
    // p1's throw is preserved while the clock extends for the missing
    // opponent; the grace timer decides their fate.
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS);

    expect(results[0]!.winnerSeat).toBe('p1');
    expect(results[0]!.reason).toBe('disconnect');
  });

  it('reconnect inside grace cancels the forfeit and resyncs state', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    engine.submitMove(1, 'A');
    engine.submitMove(2, 'A'); // draw — match continues
    vi.advanceTimersByTime(REVEAL_TIME_MS);

    engine.playerDisconnected(2);
    // Reconnect inside both the grace window and the (4s) round timer.
    vi.advanceTimersByTime(2000);
    const p2b = new FakePort(2);
    engine.playerReconnected(2, p2b);

    expect(results).toHaveLength(0);
    const snap = p2b.last('match:state');
    expect(snap?.scores).toEqual({ p1: 0, p2: 0 });
    expect(snap?.seat).toBe('p2');
    expect(snap?.youMoved).toBe(false);

    // The rebound port receives subsequent events and the match finishes
    // normally — proving the grace forfeit was cancelled.
    engine.submitMove(1, 'B');
    engine.submitMove(2, 'A');
    expect(p2b.last('round:result')?.outcome).toBe('lose');
    vi.advanceTimersByTime(REVEAL_TIME_MS);
    vi.advanceTimersByTime(DISCONNECT_GRACE_MS * 2);
    expect(results).toHaveLength(1);
    expect(results[0]!.reason).toBe('score');
    expect(results[0]!.winnerSeat).toBe('p1');
  });

  it('explicit forfeit ends the match immediately', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    engine.forfeit(1);
    expect(results[0]!.winnerSeat).toBe('p2');
    expect(results[0]!.reason).toBe('forfeit');
    // No lingering timers fire afterwards.
    vi.advanceTimersByTime(ROUND_TIME_MS * 3);
    expect(results).toHaveLength(1);
  });
});
