import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { SOCIAL_BONUS_COINS, STARTING_COINS } from '@rps/shared';
import { createServer, type AppServer } from '../src/server';

function memoryDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf-8'));
  return db;
}

describe('share-to-earn social bonus', () => {
  let server: AppServer;
  let base: string;
  const tokens: Record<string, string> = {};

  beforeAll(async () => {
    server = createServer(memoryDb());
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
    for (const name of ['sharer', 'copycat']) {
      const res = await fetch(`${base}/auth/signup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: name, password: 'secret1' }),
      });
      tokens[name] = (await res.json()).token;
    }
  });

  afterAll(async () => {
    await server.close();
  });

  async function claim(user: string, platform: string, url: string) {
    const res = await fetch(`${base}/economy/social-bonus`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens[user]}` },
      body: JSON.stringify({ platform, url }),
    });
    return { status: res.status, body: await res.json() };
  }

  it('grants coins for a valid post link', async () => {
    const r = await claim('sharer', 'x', 'https://x.com/sharer/status/123456789');
    expect(r.status).toBe(200);
    expect(r.body.granted).toBe(SOCIAL_BONUS_COINS);
    expect(r.body.coins).toBe(STARTING_COINS + SOCIAL_BONUS_COINS);
  });

  it('rejects the wrong host, junk links and homepage links', async () => {
    expect((await claim('sharer', 'facebook', 'https://x.com/me/status/1')).status).toBe(400);
    expect((await claim('sharer', 'x', 'not a url')).status).toBe(400);
    expect((await claim('sharer', 'x', 'https://evil.com/x.com/post')).status).toBe(400);
    expect((await claim('sharer', 'facebook', 'https://facebook.com/')).status).toBe(400);
  });

  it('caps at one claim per platform per day, but platforms are independent', async () => {
    const again = await claim('sharer', 'x', 'https://x.com/sharer/status/987654321');
    expect(again.status).toBe(429);
    const fb = await claim('sharer', 'facebook', 'https://www.facebook.com/sharer/posts/42');
    expect(fb.status).toBe(200);
  });

  it('never pays the same post URL twice, even for another user', async () => {
    const stolen = await claim('copycat', 'x', 'https://x.com/sharer/status/123456789?ref=copy');
    expect(stolen.status).toBe(409);
  });

  it('canonicalizes away trivial variants of the same post', async () => {
    // A fresh signup so the daily cap isn't what blocks these.
    const res = await fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'ringer', password: 'secret1' }),
    });
    tokens['ringer'] = (await res.json()).token;
    // ringer claims the canonical form first…
    expect((await claim('ringer', 'x', 'https://x.com/whale/status/555')).status).toBe(200);
    // …every variant of the SAME post is now a duplicate for everyone.
    for (const variant of [
      'https://x.com/whale/status/555/', // trailing slash
      'http://x.com/whale/status/555', // scheme
      'https://www.x.com/whale/status/555', // www.
      'https://twitter.com/whale/status/555', // host alias
      'https://mobile.twitter.com/whale/status/555', // mobile alias
      'https://x.com/whale/status/555?s=20', // query string
      'https://x.com/%77hale/status/555', // percent-encoded 'w'
    ]) {
      expect((await claim('copycat', 'x', variant)).status).toBe(409);
    }
  });
});
