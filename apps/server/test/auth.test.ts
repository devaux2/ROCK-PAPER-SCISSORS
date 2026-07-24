import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { createServer, type AppServer } from '../src/server';

function memoryDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf-8'));
  return db;
}

describe('auth + profile REST', () => {
  let server: AppServer;
  let base: string;

  beforeAll(async () => {
    server = createServer(memoryDb());
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
  });
  afterAll(async () => {
    await server.close();
  });

  async function post(path: string, body: unknown, token?: string) {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  it('signs up with starting coins and elo', async () => {
    const r = await post('/auth/signup', { username: 'alice', password: 'secret1' });
    expect(r.status).toBe(201);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.coins).toBe(500);
    expect(r.body.user.elo).toBe(1000);
    expect(r.body.user.winRate).toBe(0);
  });

  it('rejects bad usernames, short passwords and duplicates', async () => {
    expect((await post('/auth/signup', { username: 'x', password: 'secret1' })).status).toBe(400);
    expect((await post('/auth/signup', { username: 'bob', password: '123' })).status).toBe(400);
    expect((await post('/auth/signup', { username: 'ALICE', password: 'secret1' })).status).toBe(409);
  });

  it('logs in and fetches own profile', async () => {
    const login = await post('/auth/login', { username: 'alice', password: 'secret1' });
    expect(login.status).toBe(200);
    const me = await fetch(`${base}/users/me`, {
      headers: { authorization: `Bearer ${login.body.token}` },
    });
    expect(me.status).toBe(200);
    expect((await me.json()).username).toBe('alice');
  });

  it('rejects wrong password and missing token', async () => {
    expect((await post('/auth/login', { username: 'alice', password: 'wrong99' })).status).toBe(401);
    expect((await fetch(`${base}/users/me`)).status).toBe(401);
  });

  it('updates bio and avatar with validation', async () => {
    const login = await post('/auth/login', { username: 'alice', password: 'secret1' });
    const token = login.body.token as string;
    const patch = await fetch(`${base}/users/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ bio: 'rock enjoyer', avatar: 'avatar_07' }),
    });
    expect(patch.status).toBe(200);
    const body = await patch.json();
    expect(body.bio).toBe('rock enjoyer');
    expect(body.avatar).toBe('avatar_07');

    const bad = await fetch(`${base}/users/me`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ avatar: 'avatar_99' }),
    });
    expect(bad.status).toBe(400);
  });

  it("serves other users' public profiles without coin balance", async () => {
    const login = await post('/auth/login', { username: 'alice', password: 'secret1' });
    const other = await post('/auth/signup', { username: 'carol', password: 'secret1' });
    const res = await fetch(`${base}/users/${other.body.user.id}`, {
      headers: { authorization: `Bearer ${login.body.token}` },
    });
    const body = await res.json();
    expect(body.username).toBe('carol');
    expect(body.coins).toBeUndefined();
  });
});
