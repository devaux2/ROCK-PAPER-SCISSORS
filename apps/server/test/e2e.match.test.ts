import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { io as ioc, type Socket } from 'socket.io-client';
import {
  ROUNDS_TO_WIN,
  type ClientToServerEvents,
  ServerToClientEvents,
  MatchStartPayload,
  RoundStartPayload,
  RoundResultPayload,
  MatchEndPayload,
} from '@rps/shared';
import { createServer, type AppServer } from '../src/server';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function memoryDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf-8'));
  return db;
}

/** Buffers an event stream so nothing is lost between awaits. */
function makeQueue<E extends keyof ServerToClientEvents>(socket: ClientSocket, event: E) {
  type P = Parameters<ServerToClientEvents[E]>[0];
  const buf: P[] = [];
  const waiters: Array<(p: P) => void> = [];
  socket.on(event, ((p: P) => {
    const w = waiters.shift();
    if (w) w(p);
    else buf.push(p);
  }) as never);
  return {
    next(): Promise<P> {
      const b = buf.shift();
      if (b !== undefined) return Promise.resolve(b);
      return new Promise<P>((res) => waiters.push(res));
    },
  };
}

interface Player {
  socket: ClientSocket;
  starts: ReturnType<typeof makeQueue<'match:start'>>;
  rounds: ReturnType<typeof makeQueue<'round:start'>>;
  results: ReturnType<typeof makeQueue<'round:result'>>;
  ends: ReturnType<typeof makeQueue<'match:end'>>;
}

describe('e2e: real socket clients play ranked matches', () => {
  let server: AppServer;
  let base: string;
  const clients: ClientSocket[] = [];
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    server = createServer(memoryDb());
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
    for (const name of ['ann', 'ben', 'pauper']) {
      const res = await fetch(`${base}/auth/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: name, password: 'secret1' }),
      });
      const body = await res.json();
      tokens[name] = body.token;
    }
  });

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    await server.close();
  });

  function connect(name: string): Promise<Player> {
    const socket: ClientSocket = ioc(base, {
      auth: { token: tokens[name] },
      transports: ['websocket'],
    });
    clients.push(socket);
    return new Promise((resolve, reject) => {
      socket.on('connect', () =>
        resolve({
          socket,
          starts: makeQueue(socket, 'match:start'),
          rounds: makeQueue(socket, 'round:start'),
          results: makeQueue(socket, 'round:result'),
          ends: makeQueue(socket, 'match:end'),
        })
      );
      socket.on('connect_error', reject);
    });
  }

  function ack<T = { ok: boolean; error?: string }>(
    socket: ClientSocket,
    event: string,
    payload?: unknown
  ): Promise<T> {
    return new Promise((resolve) => {
      const emit = socket.emit.bind(socket) as (e: string, ...args: unknown[]) => void;
      if (payload === undefined) emit(event, resolve);
      else emit(event, payload, resolve);
    });
  }

  async function me(name: string) {
    const res = await fetch(`${base}/users/me`, {
      headers: { authorization: `Bearer ${tokens[name]}` },
    });
    return res.json();
  }

  /** Winner throws A, loser throws C every round until the match ends. */
  async function playMatch(
    winner: Player,
    loser: Player,
    matchId: string
  ): Promise<{ winnerEnd: MatchEndPayload; loserEnd: MatchEndPayload }> {
    for (let guard = 0; guard < 10; guard++) {
      const round = (await winner.rounds.next()) as RoundStartPayload;
      await loser.rounds.next();
      expect(round.deadline).toBeGreaterThan(Date.now());
      await ack(winner.socket, 'match:move', { matchId, move: 'A' });
      await ack(loser.socket, 'match:move', { matchId, move: 'C' });
      const result = (await winner.results.next()) as RoundResultPayload;
      await loser.results.next();
      expect(result.outcome).toBe('win');
      if (result.scores.p1 >= ROUNDS_TO_WIN || result.scores.p2 >= ROUNDS_TO_WIN) break;
    }
    return { winnerEnd: await winner.ends.next(), loserEnd: await loser.ends.next() };
  }

  it('queue -> escrow -> sudden death -> payout + elo -> rematch, verified over REST', async () => {
    const ann = await connect('ann');
    const ben = await connect('ben');

    expect((await ack(ann.socket, 'queue:join', { mode: 'ranked', wagerTier: 50 })).ok).toBe(true);
    // Escrow lands immediately on queue join.
    expect((await me('ann')).coins).toBe(450);
    expect((await ack(ben.socket, 'queue:join', { mode: 'ranked', wagerTier: 50 })).ok).toBe(true);

    const annStart = (await ann.starts.next()) as MatchStartPayload;
    const benStart = (await ben.starts.next()) as MatchStartPayload;
    expect(annStart.mode).toBe('ranked');
    expect(annStart.wager).toBe(50);
    expect(annStart.opponent.username).toBe('ben');
    expect(benStart.opponent.username).toBe('ann');
    expect(annStart.seat).not.toBe(benStart.seat);

    const { winnerEnd, loserEnd } = await playMatch(ann, ben, annStart.matchId);

    expect(winnerEnd.youWon).toBe(true);
    expect(winnerEnd.reason).toBe('score');
    expect(winnerEnd.coinsDelta).toBe(50);
    expect(winnerEnd.eloDelta).toBe(16);
    expect(winnerEnd.newCoins).toBe(550);
    expect(loserEnd.youWon).toBe(false);
    expect(loserEnd.coinsDelta).toBe(-50);
    expect(loserEnd.eloDelta).toBe(-16);

    const annProfile = await me('ann');
    const benProfile = await me('ben');
    expect(annProfile.coins).toBe(550);
    expect(annProfile.elo).toBe(1016);
    expect(annProfile.wins).toBe(1);
    expect(annProfile.winRate).toBe(1);
    expect(benProfile.coins).toBe(450);
    expect(benProfile.elo).toBe(984);
    expect(benProfile.losses).toBe(1);

    const lb = await fetch(`${base}/leaderboards?window=weekly`, {
      headers: { authorization: `Bearer ${tokens.ann}` },
    }).then((r) => r.json());
    expect(lb[0].user.username).toBe('ann');
    expect(lb[0].ratingGained).toBe(16);
    expect(lb[1].user.username).toBe('ben');
    expect(lb[1].ratingGained).toBe(-16);

    const history = await fetch(`${base}/economy/history`, {
      headers: { authorization: `Bearer ${tokens.ann}` },
    }).then((r) => r.json());
    const types = history.map((t: { type: string }) => t.type);
    expect(types).toContain('signup_bonus');
    expect(types).toContain('wager_escrow');
    expect(types).toContain('payout');

    // --- Rematch on the same terms; this time ben wins ---
    const offered = new Promise<{ matchId: string }>((res) => ben.socket.once('rematch:offered', res));
    expect((await ack(ann.socket, 'match:rematch', { matchId: annStart.matchId })).ok).toBe(true);
    expect((await offered).matchId).toBe(annStart.matchId);
    expect((await ack(ben.socket, 'match:rematch', { matchId: annStart.matchId })).ok).toBe(true);

    const annStart2 = (await ann.starts.next()) as MatchStartPayload;
    await ben.starts.next();
    expect(annStart2.wager).toBe(50);
    expect(annStart2.matchId).not.toBe(annStart.matchId);

    const second = await playMatch(ben, ann, annStart2.matchId);
    expect(second.winnerEnd.youWon).toBe(true);

    const annAfter = await me('ann');
    const benAfter = await me('ben');
    expect(annAfter.coins).toBe(500);
    expect(benAfter.coins).toBe(500);
    // Ben was behind, so winning back pays slightly more than 16.
    expect(benAfter.elo).toBeGreaterThan(984);

    // Match history: newest first, correct outcome/deltas per player.
    const annHistory = await fetch(`${base}/matches/history`, {
      headers: { authorization: `Bearer ${tokens.ann}` },
    }).then((r) => r.json());
    expect(annHistory).toHaveLength(2);
    expect(annHistory[0].won).toBe(false); // rematch, ben won
    expect(annHistory[0].coinsDelta).toBe(-50);
    expect(annHistory[0].opponent.username).toBe('ben');
    expect(annHistory[1].won).toBe(true); // first match
    expect(annHistory[1].coinsDelta).toBe(50);
    expect(annHistory[1].eloDelta).toBe(16);
    expect(annHistory[1].mode).toBe('ranked');
    expect(annHistory[1].myScore).toBe(ROUNDS_TO_WIN);
  }, 60_000);

  it('refunds escrow on queue leave, rejects invalid tiers and unaffordable wagers', async () => {
    const pauper = await connect('pauper');
    expect((await ack(pauper.socket, 'queue:join', { mode: 'ranked', wagerTier: 100 })).ok).toBe(true);
    expect((await me('pauper')).coins).toBe(400);
    pauper.socket.emit('queue:leave');
    await new Promise((r) => setTimeout(r, 150));
    expect((await me('pauper')).coins).toBe(500);
    // 500 was a tier once; it isn't any more.
    expect((await ack(pauper.socket, 'queue:join', { mode: 'ranked', wagerTier: 500 })).ok).toBe(false);
    expect((await ack(pauper.socket, 'queue:join', { mode: 'ranked', wagerTier: 77 })).ok).toBe(false);
    // 1000 is a real tier but out of reach on a fresh 500-coin account.
    const broke = await ack(pauper.socket, 'queue:join', { mode: 'ranked', wagerTier: 1000 });
    expect(broke.ok).toBe(false);
    expect((await me('pauper')).coins).toBe(500);
  });

  it('plays a bot match end-to-end without touching coins, elo or win rate', async () => {
    const pauper = await connect('pauper');
    expect((await ack<{ ok: boolean }>(pauper.socket, 'bot:start')).ok).toBe(true);
    const start = (await pauper.starts.next()) as MatchStartPayload;
    expect(start.mode).toBe('bot');
    expect(start.opponent.isBot).toBe(true);

    const endP = pauper.ends.next();
    let ended = false;
    void endP.then(() => {
      ended = true;
    });
    for (let guard = 0; guard < 12 && !ended; guard++) {
      const round = await Promise.race([pauper.rounds.next(), endP.then(() => null)]);
      if (round === null || ended) break;
      await ack(pauper.socket, 'match:move', { matchId: start.matchId, move: 'A' });
      await Promise.race([pauper.results.next(), endP.then(() => null)]);
    }
    const finalEnd = await endP;
    expect(finalEnd.coinsDelta).toBe(0);
    expect(finalEnd.eloDelta).toBe(0);

    const profile = await me('pauper');
    expect(profile.coins).toBe(500);
    expect(profile.elo).toBe(1000);
    expect(profile.wins + profile.losses).toBe(0);
  }, 60_000);
});
