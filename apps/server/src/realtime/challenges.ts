import { nanoid } from 'nanoid';
import { isWagerTier, CHALLENGE_TTL_MS, REMATCH_TTL_MS } from '@rps/shared';
import type { AppContext } from '../context';
import type { MatchService } from '../game/matchService';
import type { Presence } from './presence';
import { InsufficientFundsError } from '../db/repos/transactions.repo';
import { toPublicProfile } from '../db/repos/users.repo';

interface PendingChallenge {
  id: string;
  fromId: number;
  toId: number;
  wager: number;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Friend challenges and post-match rematches. Both bypass the queue and
 * escrow wagers only at the moment both sides have agreed.
 */
export class Challenges {
  private pending = new Map<string, PendingChallenge>();
  /** matchId -> userIds who have asked for a rematch of that match. */
  private rematchVotes = new Map<string, Set<number>>();

  constructor(
    private ctx: AppContext,
    private matches: MatchService,
    private presence: Presence
  ) {}

  send(fromId: number, toUserId: number, wagerTier?: number): { ok: boolean; challengeId?: string; error?: string } {
    if (wagerTier !== undefined && !isWagerTier(wagerTier)) {
      return { ok: false, error: 'Invalid wager tier' };
    }
    if (!this.ctx.friends.areFriends(fromId, toUserId)) {
      return { ok: false, error: 'You can only challenge friends' };
    }
    const toPort = this.presence.get(toUserId);
    if (!toPort) return { ok: false, error: 'That player is offline' };
    if (this.matches.isInMatch(fromId) || this.matches.isInMatch(toUserId)) {
      return { ok: false, error: 'One of you is already in a match' };
    }
    const wager = wagerTier ?? 0;
    const id = nanoid(10);
    const timer = setTimeout(() => this.pending.delete(id), CHALLENGE_TTL_MS);
    this.pending.set(id, { id, fromId, toId: toUserId, wager, timer });
    const fromRow = this.ctx.users.byId(fromId)!;
    toPort.send('challenge:incoming', {
      challengeId: id,
      from: toPublicProfile(fromRow),
      wager,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    return { ok: true, challengeId: id };
  }

  accept(challengeId: string, userId: number): { ok: boolean; error?: string } {
    const c = this.pending.get(challengeId);
    if (!c || c.toId !== userId) return { ok: false, error: 'Challenge expired' };
    const fromPort = this.presence.get(c.fromId);
    const toPort = this.presence.get(c.toId);
    if (!fromPort || !toPort) return { ok: false, error: 'Challenger went offline' };
    if (this.matches.isInMatch(c.fromId) || this.matches.isInMatch(c.toId)) {
      return { ok: false, error: 'One of you is already in a match' };
    }
    const escrowError = this.escrowBoth(c.fromId, c.toId, c.wager);
    if (escrowError) return { ok: false, error: escrowError };

    clearTimeout(c.timer);
    this.pending.delete(challengeId);
    fromPort.send('challenge:result', { challengeId, accepted: true });
    this.matches.createMatch(c.wager > 0 ? 'ranked' : 'casual', c.wager, fromPort, toPort);
    return { ok: true };
  }

  decline(challengeId: string, userId: number): void {
    const c = this.pending.get(challengeId);
    if (!c || c.toId !== userId) return;
    clearTimeout(c.timer);
    this.pending.delete(challengeId);
    this.presence.get(c.fromId)?.send('challenge:result', { challengeId, accepted: false });
  }

  /** Both participants asking within the TTL starts a fresh match on the same terms. */
  requestRematch(matchId: string, userId: number): { ok: boolean; error?: string } {
    const info = this.matches.finishedById(matchId);
    if (!info || Date.now() - info.endedAt > REMATCH_TTL_MS) {
      return { ok: false, error: 'Rematch window has closed' };
    }
    if (!info.userIds.includes(userId)) return { ok: false, error: 'Not your match' };
    if (info.mode === 'bot') {
      const port = this.presence.get(userId);
      if (!port) return { ok: false, error: 'Not connected' };
      this.matches.createBotMatch(port);
      return { ok: true };
    }

    const votes = this.rematchVotes.get(matchId) ?? new Set<number>();
    votes.add(userId);
    this.rematchVotes.set(matchId, votes);

    const opponentId = info.userIds[0] === userId ? info.userIds[1] : info.userIds[0];
    if (!votes.has(opponentId)) {
      this.presence.get(opponentId)?.send('rematch:offered', { matchId });
      return { ok: true };
    }

    const a = this.presence.get(userId);
    const b = this.presence.get(opponentId);
    if (!a || !b) return { ok: false, error: 'Opponent went offline' };
    if (this.matches.isInMatch(userId) || this.matches.isInMatch(opponentId)) {
      return { ok: false, error: 'One of you is already in a match' };
    }
    if (info.mode === 'ranked') {
      const escrowError = this.escrowBoth(userId, opponentId, info.wager);
      if (escrowError) return { ok: false, error: escrowError };
    }
    this.rematchVotes.delete(matchId);
    this.matches.createMatch(info.mode, info.wager, b, a);
    return { ok: true };
  }

  /** Escrow both wagers atomically; refund the first if the second fails. */
  private escrowBoth(aId: number, bId: number, wager: number): string | null {
    if (wager <= 0) return null;
    try {
      this.ctx.transactions.apply(aId, -wager, 'wager_escrow');
    } catch (e) {
      if (e instanceof InsufficientFundsError) return 'Not enough coins for the wager';
      throw e;
    }
    try {
      this.ctx.transactions.apply(bId, -wager, 'wager_escrow');
    } catch (e) {
      this.ctx.transactions.apply(aId, wager, 'wager_refund');
      if (e instanceof InsufficientFundsError) return 'Opponent cannot afford the wager';
      throw e;
    }
    return null;
  }
}
