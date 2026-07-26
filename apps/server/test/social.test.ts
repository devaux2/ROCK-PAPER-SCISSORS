import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { io as ioc, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@rps/shared';
import { createServer, type AppServer } from '../src/server';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function memoryDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf-8'));
  return db;
}

describe('friends, challenges, emotes, economy', () => {
  let server: AppServer;
  let base: string;
  const clients: ClientSocket[] = [];
  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    server = createServer(memoryDb());
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
    for (const name of ['dana', 'eli', 'finn']) {
      const res = await fetch(`${base}/auth/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: name, password: 'secret1' }),
      });
      const body = await res.json();
      tokens[name] = body.token;
      ids[name] = body.user.id;
    }
  });

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    await server.close();
  });

  function connect(name: string): Promise<ClientSocket> {
    const socket: ClientSocket = ioc(base, {
      auth: { token: tokens[name] },
      transports: ['websocket'],
    });
    clients.push(socket);
    return new Promise((resolve, reject) => {
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  function api(name: string, path: string, method = 'GET', body?: unknown) {
    return fetch(base + path, {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${tokens[name]}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  it('friend request lifecycle: request, accept, list, remove', async () => {
    expect((await api('dana', '/friends/request', 'POST', { username: 'eli' })).status).toBe(201);
    // Duplicate blocked.
    expect((await api('eli', '/friends/request', 'POST', { username: 'dana' })).status).toBe(409);
    expect((await api('dana', '/friends/request', 'POST', { username: 'dana' })).status).toBe(400);
    expect((await api('dana', '/friends/request', 'POST', { username: 'ghost' })).status).toBe(404);

    const eliList = await (await api('eli', '/friends')).json();
    expect(eliList).toHaveLength(1);
    expect(eliList[0].incoming).toBe(true);
    expect(eliList[0].status).toBe('pending');

    expect((await api('eli', `/friends/${ids.dana}/accept`, 'POST')).status).toBe(200);
    const danaList = await (await api('dana', '/friends')).json();
    expect(danaList[0].status).toBe('accepted');

    // Third user declines.
    await api('dana', '/friends/request', 'POST', { username: 'finn' });
    expect((await api('finn', `/friends/${ids.dana}/decline`, 'POST')).status).toBe(200);
    expect(await (await api('finn', '/friends')).json()).toHaveLength(0);
  });

  it('challenge between friends starts a wagered match; non-friends rejected', async () => {
    const dana = await connect('dana');
    const eli = await connect('eli');
    const finn = await connect('finn');

    // finn is not dana's friend.
    const denied = await new Promise<{ ok: boolean; error?: string }>((resolve) => {
      finn.emit('challenge:send', { toUserId: ids.dana!, wagerTier: 10 }, resolve);
    });
    expect(denied.ok).toBe(false);

    const incomingP = new Promise<{ challengeId: string; wager: number }>((resolve) => {
      eli.once('challenge:incoming', resolve);
    });
    const sent = await new Promise<{ ok: boolean; challengeId?: string }>((resolve) => {
      dana.emit('challenge:send', { toUserId: ids.eli!, wagerTier: 10 }, resolve);
    });
    expect(sent.ok).toBe(true);
    const incoming = await incomingP;
    expect(incoming.wager).toBe(10);

    const danaStartP = new Promise<{ matchId: string; wager: number }>((resolve) => {
      dana.once('match:start', resolve);
    });
    const accepted = await new Promise<{ ok: boolean }>((resolve) => {
      eli.emit('challenge:accept', { challengeId: incoming.challengeId }, resolve);
    });
    expect(accepted.ok).toBe(true);
    const start = await danaStartP;
    expect(start.wager).toBe(10);

    // Both escrowed.
    expect((await (await api('dana', '/users/me')).json()).coins).toBe(490);
    expect((await (await api('eli', '/users/me')).json()).coins).toBe(490);

    // Emote relay + rate limit inside the live match.
    const emoteP = new Promise<{ emoteId: string }>((resolve) => {
      eli.once('match:emote', resolve);
    });
    dana.emit('match:emote', { matchId: start.matchId, emoteId: 'taunt' });
    expect((await emoteP).emoteId).toBe('taunt');

    let second = 0;
    eli.on('match:emote', () => {
      second += 1;
    });
    dana.emit('match:emote', { matchId: start.matchId, emoteId: 'laugh' }); // inside cooldown
    await new Promise((r) => setTimeout(r, 200));
    expect(second).toBe(0);

    // Clean up: dana forfeits so both are free again; eli wins the pot.
    const endP = new Promise<{ youWon: boolean }>((resolve) => {
      eli.once('match:end', resolve);
    });
    dana.emit('match:forfeit', { matchId: start.matchId });
    expect((await endP).youWon).toBe(true);
    expect((await (await api('eli', '/users/me')).json()).coins).toBe(510);
    expect((await (await api('dana', '/users/me')).json()).coins).toBe(490);
  });

  it('presence shows online friends', async () => {
    const list = await (await api('dana', '/friends')).json();
    const eliEntry = list.find((f: { user: { username: string } }) => f.user.username === 'eli');
    expect(eliEntry.online).toBe(true);
  });

  it('daily top-up only below threshold and once per day', async () => {
    // dana has 490 coins — above threshold.
    expect((await api('dana', '/economy/daily-topup', 'POST')).status).toBe(400);

    // Drain dana to 40 coins directly for the test.
    server.ctx.db.prepare('UPDATE users SET coins = 40 WHERE id = ?').run(ids.dana!);
    const topup = await api('dana', '/economy/daily-topup', 'POST');
    expect(topup.status).toBe(200);
    const body = await topup.json();
    expect(body.granted).toBe(60);
    expect(body.coins).toBe(100);

    server.ctx.db.prepare('UPDATE users SET coins = 40 WHERE id = ?').run(ids.dana!);
    expect((await api('dana', '/economy/daily-topup', 'POST')).status).toBe(429);
  });

  it('leaderboard windows rank recent winnings', async () => {
    const weekly = await (await api('dana', '/leaderboards?window=weekly')).json();
    const monthly = await (await api('dana', '/leaderboards?window=monthly')).json();
    // dana/eli played a ranked challenge match above.
    expect(weekly.length).toBeGreaterThanOrEqual(2);
    expect(monthly.length).toBeGreaterThanOrEqual(2);
    expect(weekly[0].coinsWon).toBeGreaterThan(0);
    expect(weekly[0].rank).toBe(1);
  });
});
