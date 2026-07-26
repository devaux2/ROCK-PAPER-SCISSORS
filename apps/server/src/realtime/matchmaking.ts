import { isWagerTier, WAGER_TIERS, type WagerTier } from '@rps/shared';
import type { AppContext } from '../context';
import type { PlayerPort } from '../game/MatchEngine';
import type { MatchService } from '../game/matchService';
import { InsufficientFundsError } from '../db/repos/transactions.repo';
import { config } from '../config';

interface QueueEntry {
  port: PlayerPort;
  joinedAt: number;
}

/**
 * In-memory matchmaking. The wager brackets do the segmenting; inside a
 * bracket it's first-come-first-served for the fastest possible pairing.
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
      this.casual.push({ port, joinedAt: Date.now() });
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
      this.ranked.get(wagerTier)!.push({ port, joinedAt: Date.now() });
      this.tierByUser.set(port.userId, wagerTier);
    }
    port.send('queue:status', {
      mode,
      wager: mode === 'ranked' ? (wagerTier as number) : 0,
      waitingSince: Date.now(),
    });
    // Try to pair immediately so fast matches don't wait a tick.
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

  tick(): void {
    while (this.casual.length >= 2) {
      const a = this.casual.shift()!;
      const b = this.casual.shift()!;
      this.tierByUser.delete(a.port.userId);
      this.tierByUser.delete(b.port.userId);
      this.matches.createMatch('casual', 0, a.port, b.port);
    }
    for (const [tier, queue] of this.ranked) {
      while (queue.length >= 2) {
        const a = queue.shift()!;
        const b = queue.shift()!;
        this.tierByUser.delete(a.port.userId);
        this.tierByUser.delete(b.port.userId);
        this.matches.createMatch('ranked', tier, a.port, b.port);
      }
    }
  }
}
