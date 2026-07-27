import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { io as ioc, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  MatchStartPayload,
  VoiceSignalPayload,
} from '@rps/shared';
import { createServer, type AppServer } from '../src/server';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

function memoryDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf-8'));
  return db;
}

function once<E extends keyof ServerToClientEvents>(
  socket: ClientSocket,
  event: E
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((res) => socket.once(event, res as never));
}

function silence(socket: ClientSocket, event: 'voice:signal', ms: number): Promise<boolean> {
  return new Promise((res) => {
    const timer = setTimeout(() => res(true), ms);
    socket.once(event, () => {
      clearTimeout(timer);
      res(false);
    });
  });
}

describe('voice signaling relay', () => {
  let server: AppServer;
  let base: string;
  const clients: ClientSocket[] = [];

  beforeAll(async () => {
    server = createServer(memoryDb());
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    for (const c of clients) c.disconnect();
    await server.close();
  });

  async function join(name: string): Promise<ClientSocket> {
    const res = await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: name, password: 'secret1' }),
    });
    const { token } = await res.json();
    const socket: ClientSocket = ioc(base, { auth: { token }, transports: ['websocket'] });
    clients.push(socket);
    await new Promise<void>((r) => socket.on('connect', () => r()));
    return socket;
  }

  it('relays opaque blobs between match participants, and only them', async () => {
    const [va, vb, vc] = await Promise.all([join('vox_a'), join('vox_b'), join('vox_c')]);
    const startA = once(va, 'match:start');
    const startB = once(vb, 'match:start');
    va.emit('queue:join', { mode: 'casual' }, () => {});
    vb.emit('queue:join', { mode: 'casual' }, () => {});
    const [a] = (await Promise.all([startA, startB])) as [MatchStartPayload, MatchStartPayload];

    // A -> B: SDP-ish blob arrives verbatim.
    const gotB = once(vb, 'voice:signal');
    va.emit('voice:signal', { matchId: a.matchId, data: { sdp: { type: 'offer', sdp: 'x' } } });
    const sig = (await gotB) as VoiceSignalPayload;
    expect(sig.matchId).toBe(a.matchId);
    expect(sig.data).toEqual({ sdp: { type: 'offer', sdp: 'x' } });

    // B -> A: candidates flow the other way too.
    const gotA = once(va, 'voice:signal');
    vb.emit('voice:signal', { matchId: a.matchId, data: { candidate: { candidate: 'c' } } });
    expect(((await gotA) as VoiceSignalPayload).data).toEqual({ candidate: { candidate: 'c' } });

    // An outsider shouting the same matchId reaches nobody.
    const quietA = silence(va, 'voice:signal', 250);
    const quietB = silence(vb, 'voice:signal', 250);
    vc.emit('voice:signal', { matchId: a.matchId, data: { sdp: 'intruder' } });
    expect(await quietA).toBe(true);
    expect(await quietB).toBe(true);

    // The line stays open on the end screen (finished-match window).
    va.emit('match:forfeit', { matchId: a.matchId });
    await Promise.all([once(va, 'match:end'), once(vb, 'match:end')]);
    const lateB = once(vb, 'voice:signal');
    va.emit('voice:signal', { matchId: a.matchId, data: { candidate: null } });
    expect(((await lateB) as VoiceSignalPayload).data).toEqual({ candidate: null });
  });
});
