import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ROUND_TIME_MS, REVEAL_TIME_MS, DISCONNECT_GRACE_MS, type MatchEndPayload } from '@rps/shared';
import { MatchEngine, type MatchResult, type SeatSettlement } from '../src/game/MatchEngine';
import { FakePort } from './helpers';

const blank: SeatSettlement = { eloDelta: 0, coinsDelta: 0, newElo: 1000, newCoins: 500 };

function makeEngine(p1: FakePort, p2: FakePort) {
  const results: MatchResult[] = [];
  const engine = new MatchEngine({
    matchId: 'm1',
    mode: 'casual',
    wager: 0,
    p1,
    p2,
    onEnd: (result) => {
      results.push(result);
      return { p1: blank, p2: blank };
    },
  });
  return { engine, results };
}

describe('MatchEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('plays a clean 2-0 match', () => {
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
    expect(p1.last('round:start')?.roundNo).toBe(2);

    engine.submitMove(1, 'B');
    engine.submitMove(2, 'A');
    vi.advanceTimersByTime(REVEAL_TIME_MS);

    expect(results).toHaveLength(1);
    expect(results[0]!.winnerSeat).toBe('p1');
    expect(results[0]!.reason).toBe('score');
    expect(results[0]!.scores).toEqual({ p1: 2, p2: 0 });
    const end = p1.last('match:end') as MatchEndPayload;
    expect(end.youWon).toBe(true);
    expect((p2.last('match:end') as MatchEndPayload).youWon).toBe(false);
  });

  it('replays drawn rounds without advancing the score (2-1 with a draw)', () => {
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

    engine.submitMove(1, 'A');
    engine.submitMove(2, 'B'); // p2 wins round 1
    vi.advanceTimersByTime(REVEAL_TIME_MS);
    engine.submitMove(1, 'C');
    engine.submitMove(2, 'B'); // p1 wins round 2
    vi.advanceTimersByTime(REVEAL_TIME_MS);
    engine.submitMove(1, 'B');
    engine.submitMove(2, 'A'); // p1 wins round 3
    vi.advanceTimersByTime(REVEAL_TIME_MS);

    expect(results[0]!.winnerSeat).toBe('p1');
    expect(results[0]!.scores).toEqual({ p1: 2, p2: 1 });
    expect(results[0]!.rounds).toHaveLength(4);
    expect(results[0]!.rounds[0]!.winner).toBe('draw');
  });

  it('fills a random move on timeout and keeps playing', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine } = makeEngine(p1, p2);
    engine.start();

    engine.submitMove(1, 'A');
    vi.advanceTimersByTime(ROUND_TIME_MS);
    // Round resolved despite p2 never moving.
    expect(p1.count('round:result')).toBe(1);
    expect(p2.last('round:result')?.yourMove).toBeDefined();
  });

  it('forfeits a player after two consecutive timeouts', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    engine.submitMove(1, 'A');
    vi.advanceTimersByTime(ROUND_TIME_MS); // p2 timeout #1
    vi.advanceTimersByTime(REVEAL_TIME_MS);
    engine.submitMove(1, 'A');
    vi.advanceTimersByTime(ROUND_TIME_MS); // p2 timeout #2 -> forfeit

    expect(results).toHaveLength(1);
    expect(results[0]!.winnerSeat).toBe('p1');
    expect(results[0]!.reason).toBe('forfeit');
  });

  it('aborts with no winner when both players go AFK twice', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    vi.advanceTimersByTime(ROUND_TIME_MS); // both timeout #1
    vi.advanceTimersByTime(REVEAL_TIME_MS);
    vi.advanceTimersByTime(ROUND_TIME_MS); // both timeout #2

    expect(results[0]!.winnerSeat).toBeNull();
    expect(results[0]!.reason).toBe('forfeit');
  });

  it('a move resets the consecutive-timeout counter', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    engine.submitMove(1, 'A');
    vi.advanceTimersByTime(ROUND_TIME_MS); // p2 timeout #1
    vi.advanceTimersByTime(REVEAL_TIME_MS);
    engine.submitMove(1, 'A');
    engine.submitMove(2, 'A'); // p2 moves -> counter reset (draw, replay)
    vi.advanceTimersByTime(REVEAL_TIME_MS);
    engine.submitMove(1, 'A');
    vi.advanceTimersByTime(ROUND_TIME_MS); // p2 timeout — only #1 again

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
    engine.submitMove(2, 'C');
    // Reveal phase — no moves accepted.
    expect(engine.submitMove(1, 'A').ok).toBe(false);
  });

  it('forfeits a disconnected player after the grace period', () => {
    const p1 = new FakePort(1);
    const p2 = new FakePort(2);
    const { engine, results } = makeEngine(p1, p2);
    engine.start();

    engine.playerDisconnected(2);
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
    engine.submitMove(2, 'C'); // p1 leads 1-0
    vi.advanceTimersByTime(REVEAL_TIME_MS);

    engine.playerDisconnected(2);
    // Reconnect inside both the grace window and the round timer.
    vi.advanceTimersByTime(5000);
    const p2b = new FakePort(2);
    engine.playerReconnected(2, p2b);

    expect(results).toHaveLength(0);
    const snap = p2b.last('match:state');
    expect(snap?.scores).toEqual({ p1: 1, p2: 0 });
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
