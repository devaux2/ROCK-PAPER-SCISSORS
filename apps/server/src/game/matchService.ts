import { nanoid } from 'nanoid';
import type { MatchMode } from '@rps/shared';
import type { AppContext } from '../context';
import { MatchEngine, type PlayerPort } from './MatchEngine';
import { settleMatch } from './settlement';
import { BOT_USER_ID, BotPlayer } from './bot';

export interface FinishedMatchInfo {
  matchId: string;
  mode: MatchMode;
  wager: number;
  userIds: [number, number];
  endedAt: number;
}

export class MatchService {
  private engines = new Map<string, MatchEngine>();
  private byUser = new Map<number, string>();
  /** Recently finished matches kept around briefly so rematch offers can reference them. */
  private finished = new Map<string, FinishedMatchInfo>();

  constructor(private ctx: AppContext) {}

  createMatch(mode: MatchMode, wager: number, p1: PlayerPort, p2: PlayerPort): MatchEngine {
    const matchId = nanoid(12);
    this.ctx.matches.create(
      matchId,
      mode,
      p1.userId,
      p2.userId === BOT_USER_ID ? null : p2.userId,
      wager
    );
    const engine = new MatchEngine({
      matchId,
      mode,
      wager,
      p1,
      p2,
      onEnd: (result) => {
        this.engines.delete(matchId);
        this.byUser.delete(p1.userId);
        this.byUser.delete(p2.userId);
        this.finished.set(matchId, {
          matchId,
          mode,
          wager,
          userIds: [p1.userId, p2.userId],
          endedAt: Date.now(),
        });
        return settleMatch(this.ctx, result);
      },
    });
    this.engines.set(matchId, engine);
    this.byUser.set(p1.userId, matchId);
    if (p2.userId !== BOT_USER_ID) this.byUser.set(p2.userId, matchId);
    if (p2 instanceof BotPlayer) p2.bind(engine);
    engine.start();
    return engine;
  }

  createBotMatch(human: PlayerPort): MatchEngine {
    return this.createMatch('bot', 0, human, new BotPlayer());
  }

  engineById(matchId: string): MatchEngine | undefined {
    return this.engines.get(matchId);
  }

  engineForUser(userId: number): MatchEngine | undefined {
    const matchId = this.byUser.get(userId);
    return matchId ? this.engines.get(matchId) : undefined;
  }

  finishedById(matchId: string): FinishedMatchInfo | undefined {
    const info = this.finished.get(matchId);
    if (!info) return undefined;
    return info;
  }

  isInMatch(userId: number): boolean {
    return this.byUser.has(userId);
  }

  handleDisconnect(userId: number): void {
    this.engineForUser(userId)?.playerDisconnected(userId);
  }

  handleReconnect(userId: number, port: PlayerPort): void {
    this.engineForUser(userId)?.playerReconnected(userId, port);
  }
}
