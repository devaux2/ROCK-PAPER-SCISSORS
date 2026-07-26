import { randomMove, type ServerToClientEvents, type OpponentInfo } from '@rps/shared';
import type { PlayerPort, MatchEngine } from './MatchEngine';

export const BOT_USER_ID = -1;

export const BOT_INFO: OpponentInfo = {
  id: BOT_USER_ID,
  username: 'RoboThrow',
  bio: 'Beep boop. I never sleep, I only throw.',
  avatar: 'avatar_12',
  wins: 0,
  losses: 0,
  winRate: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  isBot: true,
};

/**
 * A PlayerPort that plays random moves after a short human-ish delay.
 * Reuses the exact same MatchEngine as PvP matches.
 */
export class BotPlayer implements PlayerPort {
  readonly userId = BOT_USER_ID;
  readonly info = BOT_INFO;
  private engine: MatchEngine | null = null;
  private moveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private rng: () => number = Math.random) {}

  bind(engine: MatchEngine): void {
    this.engine = engine;
  }

  send<E extends keyof ServerToClientEvents>(
    event: E,
    _payload: Parameters<ServerToClientEvents[E]>[0]
  ): void {
    if (event === 'round:start' && this.engine) {
      const delayMs = 1000 + Math.floor(this.rng() * 2000);
      this.moveTimer = setTimeout(() => {
        this.moveTimer = null;
        if (this.engine && !this.engine.ended) {
          this.engine.submitMove(this.userId, randomMove(this.rng));
        }
      }, delayMs);
    }
    if (event === 'match:end' && this.moveTimer) {
      clearTimeout(this.moveTimer);
      this.moveTimer = null;
    }
  }
}
