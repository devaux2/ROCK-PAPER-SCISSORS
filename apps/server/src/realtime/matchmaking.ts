import { isWagerTier, WAGER_TIERS, type WagerTier } from '@rps/shared';
import type { AppContext } from '../context';
import type { PlayerPort } from '../game/MatchEngine';
import type { MatchService } from '../game/matchService';
import { InsufficientFundsError } from '../db/repos/transactions.repo';
import { config } from '../config';

interface QueueEntry {
  port: PlayerPort;
  elo: number;
  joinedAt: number;
}

/**
 * In-memory matchmaking. Casual is FIFO; ranked keeps one queue per wager
 * tier and pairs the closest-Elo players whose tolerance windows overlap.
 * Tolerance grows the longer a player waits.
 */
export class Matchmaking {
  private casual: QueueEntry[] = [];
  private ranked = new Map<WagerTier, QueueEntry[]>(WAGER_TIERS.map((t) => [t, []]));
  private tierByUser = new Map<number, WagerTier | 'casual'>();
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private ctx: AppContext,
    private matches: MatchService
  ) {}

  start(): void {
    this.interval = setInterval(() => this.tick(), config.mmTickMs);
  }

  stop(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
  }

  join(
    port: PlayerPort,
    mode: 'ranked' | 'casual',
    wagerTier?: number
  ): { ok: boolean; error?: string } {
    if (this.tierByUser.has(port.userId)) return { ok: false, error: 'Already in queue' };
    if (this.matches.isInMatch(port.userId)) return { ok: false, error: 'Already in a match' };

    if (mode === 'casual') {
      this.casual.push({ port, elo: port.info.elo, joinedAt: Date.now() });
      this.tierByUser.set(port.userId, 'casual');
    } else {
      if (!isWagerTier(wagerTier)) return { ok: false, error: 'Invalid wager tier' };
      try {
        this.ctx.transactions.apply(port.userId, -wagerTier, 'wager_escrow');
      } catch (e) {
        if (e instanceof InsufficientFundsError) {
          return { ok: false, error: 'Not enough coins for that wager' };
        }
        throw e;
      }
      this.ranked.get(wagerTier)!.push({ port, elo: port.info.elo, joinedAt: Date.now() });
      this.tierByUser.set(port.userId, wagerTier);
    }
    port.send('queue:status', {
      mode,
      wager: mode === 'ranked' ? (wagerTier as number) : 0,
      waitingSince: Date.now(),
    });
    // Try to pair immediately so tests and fast matches don't wait a tick.
    this.tick();
    return { ok: true };
  }

  /** Remove from queue, refunding ranked escrow. */
  leave(userId: number): void {
    const tier = this.tierByUser.get(userId);
    if (tier === undefined) return;
    this.tierByUser.delete(userId);
    if (tier === 'casual') {
      this.casual = this.casual.filter((e) => e.port.userId !== userId);
    } else {
      const queue = this.ranked.get(tier)!;
      const idx = queue.findIndex((e) => e.port.userId === userId);
      if (idx >= 0) {
        queue.splice(idx, 1);
        this.ctx.transactions.apply(userId, tier, 'wager_refund');
      }
    }
  }

  private toleranceFor(entry: QueueEntry, now: number): number {
    const waited = now - entry.joinedAt;
    return config.mmBaseTolerance + Math.floor(waited / 3000) * config.mmToleranceStepPer3s;
  }

  tick(): void {
    const now = Date.now();

    while (this.casual.length >= 2) {
      const a = this.casual.shift()!;
      const b = this.casual.shift()!;
      this.tierByUser.delete(a.port.userId);
      this.tierByUser.delete(b.port.userId);
      this.matches.createMatch('casual', 0, a.port, b.port);
    }

    for (const [tier, queue] of this.ranked) {
      while (queue.length >= 2) {
        const pair = this.bestPair(queue, now);
        if (!pair) break;
        const [i, j] = pair;
        // Remove higher index first so the lower index stays valid.
        const b = queue.splice(Math.max(i, j), 1)[0]!;
        const a = queue.splice(Math.min(i, j), 1)[0]!;
        this.tierByUser.delete(a.port.userId);
        this.tierByUser.delete(b.port.userId);
        this.matches.createMatch('ranked', tier, a.port, b.port);
      }
    }
  }

  /** Closest-Elo pair whose combined tolerance covers their gap, or null. */
  private bestPair(queue: QueueEntry[], now: number): [number, number] | null {
    let best: [number, number] | null = null;
    let bestGap = Infinity;
    for (let i = 0; i < queue.length; i++) {
      for (let j = i + 1; j < queue.length; j++) {
        const a = queue[i]!;
        const b = queue[j]!;
        const gap = Math.abs(a.elo - b.elo);
        const allowed = this.toleranceFor(a, now) + this.toleranceFor(b, now);
        if (gap <= allowed && gap < bestGap) {
          bestGap = gap;
          best = [i, j];
        }
      }
    }
    return best;
  }
}
