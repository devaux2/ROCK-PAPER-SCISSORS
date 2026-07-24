import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type AppServer } from '../src/server';

function memoryDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(new URL('../src/db/schema.sql', import.meta.url), 'utf-8'));
  return db;
}

describe('single-process web serving', () => {
  let server: AppServer;
  let base: string;

  beforeAll(async () => {
    const dist = mkdtempSync(join(tmpdir(), 'rps-dist-'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>Throwdown</title>app-shell');
    writeFileSync(join(dist, 'app.js'), 'console.log("bundle")');
    server = createServer(memoryDb(), { webDist: dist });
    const port = await server.listen(0);
    base = `http://127.0.0.1:${port}`;
  });
  afterAll(async () => {
    await server.close();
  });

  it('serves the app shell at /', async () => {
    const res = await fetch(base + '/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('app-shell');
  });

  it('serves static assets', async () => {
    const res = await fetch(base + '/app.js');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('bundle');
  });

  it('falls back to the app shell for client-side routes', async () => {
    for (const path of ['/match/abc123', '/leaderboard', '/user/7']) {
      const res = await fetch(base + path);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('app-shell');
    }
  });

  it('keeps API routes working alongside the web app', async () => {
    const health = await fetch(base + '/health');
    expect((await health.json()).ok).toBe(true);
    const signup = await fetch(base + '/auth/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'webby', password: 'secret1' }),
    });
    expect(signup.status).toBe(201);
    // Unknown API-ish POST is not swallowed by the SPA fallback.
    const missing = await fetch(base + '/auth/nope', { method: 'POST' });
    expect(missing.status).toBe(404);
  });

  it('disables static serving when no dist exists', async () => {
    const bare = createServer(memoryDb(), { webDist: '/nonexistent/path' });
    const port = await bare.listen(0);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    expect(res.status).toBe(404);
    await bare.close();
  });
});
