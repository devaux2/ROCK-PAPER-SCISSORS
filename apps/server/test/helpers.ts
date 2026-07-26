import type { OpponentInfo, ServerToClientEvents } from '@rps/shared';
import type { PlayerPort } from '../src/game/MatchEngine';

export function fakeInfo(id: number): OpponentInfo {
  return {
    id,
    username: `player${id}`,
    bio: '',
    avatar: 'avatar_01',
    wins: 0,
    losses: 0,
    winRate: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

export interface Recorded {
  event: keyof ServerToClientEvents;
  payload: unknown;
}

/** A PlayerPort that records everything sent to it. */
export class FakePort implements PlayerPort {
  events: Recorded[] = [];
  info: OpponentInfo;

  constructor(public userId: number) {
    this.info = fakeInfo(userId);
  }

  send<E extends keyof ServerToClientEvents>(
    event: E,
    payload: Parameters<ServerToClientEvents[E]>[0]
  ): void {
    this.events.push({ event, payload });
  }

  last<E extends keyof ServerToClientEvents>(event: E): Parameters<ServerToClientEvents[E]>[0] | undefined {
    for (let i = this.events.length - 1; i >= 0; i--) {
      if (this.events[i]!.event === event) {
        return this.events[i]!.payload as Parameters<ServerToClientEvents[E]>[0];
      }
    }
    return undefined;
  }

  count(event: keyof ServerToClientEvents): number {
    return this.events.filter((e) => e.event === event).length;
  }
}
