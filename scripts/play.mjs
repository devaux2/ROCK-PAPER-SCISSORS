#!/usr/bin/env node
/**
 * One-command game launcher for playtesting without any hosting account.
 *
 * Starts the Throwdown server on this computer and opens a free public
 * Cloudflare "quick tunnel" (no account needed) so friends anywhere can
 * join. Falls back to local/Wi-Fi play if the tunnel can't be set up.
 *
 * Run via play.bat (Windows) or play.command (macOS) — or: node scripts/play.mjs
 */
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { networkInterfaces } from 'node:os';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = 3001;
const TOOLS = join(ROOT, '.tools');
const IS_WIN = process.platform === 'win32';
const IS_MAC = process.platform === 'darwin';

const children = [];
function shutdown(code = 0) {
  for (const child of children) {
    try {
      child.kill();
    } catch {}
  }
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
process.on('exit', () => {
  for (const child of children) {
    try {
      child.kill();
    } catch {}
  }
});
process.on('uncaughtException', (error) => {
  console.error(error.message);
  shutdown(1);
});

function say(msg) {
  console.log(msg);
}
function headline(msg) {
  console.log(`\n${'='.repeat(64)}\n  ${msg}\n${'='.repeat(64)}\n`);
}

function run(cmd, opts = {}) {
  const result = spawnSync(cmd, { shell: true, stdio: 'inherit', cwd: ROOT, ...opts });
  return result.status === 0;
}

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

function openBrowser(url) {
  // Best-effort: spawn errors arrive async, so swallow them via the event.
  try {
    const opener = IS_WIN
      ? spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' })
      : spawn(IS_MAC ? 'open' : 'xdg-open', [url], { detached: true, stdio: 'ignore' });
    opener.on('error', () => {});
  } catch {}
}

async function ensureDependencies() {
  if (existsSync(join(ROOT, 'node_modules', 'tsx'))) return;
  headline('First run: installing the game server (one-off, a few minutes)');
  if (!run('npm install -w @rps/server --no-audit --no-fund')) {
    say('Could not install dependencies. Is your internet connection up?');
    shutdown(1);
  }
}

async function ensureWebBuild() {
  if (existsSync(join(ROOT, 'apps', 'mobile', 'dist', 'index.html'))) return;
  headline('Building the game screen (one-off, can take ~10 minutes)');
  if (!run('npm install --no-audit --no-fund') || !run('npm run build:web')) {
    say('Could not build the web app.');
    shutdown(1);
  }
}

function cloudflaredUrl() {
  const base = 'https://github.com/cloudflare/cloudflared/releases/latest/download';
  const arm = process.arch === 'arm64';
  if (IS_WIN) return `${base}/cloudflared-windows-amd64.exe`;
  if (IS_MAC) return `${base}/cloudflared-darwin-${arm ? 'arm64' : 'amd64'}.tgz`;
  return `${base}/cloudflared-linux-${arm ? 'arm64' : 'amd64'}`;
}

async function ensureCloudflared() {
  const bin = join(TOOLS, IS_WIN ? 'cloudflared.exe' : 'cloudflared');
  if (existsSync(bin)) return bin;
  headline('Downloading the free tunnel helper (one-off, ~50 MB)');
  mkdirSync(TOOLS, { recursive: true });
  try {
    const res = await fetch(cloudflaredUrl());
    if (!res.ok) throw new Error(`download failed (${res.status})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (IS_MAC) {
      const tgz = join(TOOLS, 'cloudflared.tgz');
      writeFileSync(tgz, buffer);
      if (!run(`tar -xzf "${tgz}" -C "${TOOLS}"`)) throw new Error('could not unpack');
    } else {
      writeFileSync(bin, buffer);
    }
    if (!IS_WIN) chmodSync(bin, 0o755);
    return bin;
  } catch (error) {
    say(`\nCould not download the tunnel helper (${error.message}).`);
    say('No problem — the game still works on your Wi-Fi (see below).');
    return null;
  }
}

async function startServer() {
  // A server from a previous window may still be running — just reuse it.
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/health`);
    if (res.ok) {
      say('Game server already running from another window — reusing it.');
      return true;
    }
  } catch {}
  headline('Starting the game server');
  const server = spawn(
    process.execPath,
    [join('node_modules', 'tsx', 'dist', 'cli.mjs'), join('apps', 'server', 'src', 'index.ts')],
    { cwd: ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'ignore', 'inherit'] }
  );
  children.push(server);
  server.on('exit', (code) => {
    say(`\nGame server stopped (${code ?? 'signal'}).`);
    shutdown(code ?? 0);
  });
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (res.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  say('The game server did not start. Scroll up for any error message.');
  shutdown(1);
}

async function startTunnel(bin) {
  headline('Creating your public game link');
  const tunnel = spawn(bin, ['tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(tunnel);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 45_000);
    const sniff = (chunk) => {
      const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
      if (match) {
        clearTimeout(timer);
        resolve(match[0]);
      }
    };
    tunnel.stdout.on('data', sniff);
    tunnel.stderr.on('data', sniff);
    tunnel.on('exit', () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
}

await ensureDependencies();
await ensureWebBuild();
const cloudflared = await ensureCloudflared();
await startServer();
const publicUrl = cloudflared ? await startTunnel(cloudflared) : null;

const lan = lanAddress();
headline('THROWDOWN IS LIVE');
if (publicUrl) {
  say(`  Share this link with ANYONE, anywhere:\n`);
  say(`      ${publicUrl}\n`);
  say(`  (New link each time you run this — that's normal.)`);
} else {
  say('  No public link this time (tunnel unavailable), but you can still play:');
}
say(`\n  On this computer:            http://localhost:${PORT}`);
if (lan) say(`  Phones on the same Wi-Fi:    http://${lan}:${PORT}`);
say(`\n  Keep this window open while playing. Close it (or press Ctrl+C) to stop.\n`);
openBrowser(publicUrl ?? `http://localhost:${PORT}`);
