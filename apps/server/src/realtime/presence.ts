import type { PlayerPort } from '../game/MatchEngine';
import type { AppContext } from '../context';

/** Who's online right now, and presence fan-out to friends. */
export class Presence {
  private ports = new Map<number, PlayerPort>();

  constructor(private ctx: AppContext) {}

  add(port: PlayerPort): void {
    this.ports.set(port.userId, port);
    this.broadcastTo(port.userId, true);
  }

  remove(userId: number): void {
    this.ports.delete(userId);
    this.broadcastTo(userId, false);
  }

  get(userId: number): PlayerPort | undefined {
    return this.ports.get(userId);
  }

  isOnline(userId: number): boolean {
    return this.ports.has(userId);
  }

  private broadcastTo(userId: number, online: boolean): void {
    for (const { friendship, other } of this.ctx.friends.listFor(userId)) {
      if (friendship.status !== 'accepted') continue;
      this.ports.get(other.id)?.send('friend:presence', { userId, online });
    }
  }
}
