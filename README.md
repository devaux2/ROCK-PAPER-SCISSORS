# THROWDOWN — Rock Paper Scissors with stakes

A **mobile-first web game** where players face off in best-of-3 rock-paper-scissors matches, wagering **simulated coins** in ranked play. One Node.js process serves everything — the game client, the REST API, and the realtime match server. Players just open a URL on their phone (and can add it to their home screen as an app).

Built with React Native + Expo (via react-native-web), so the same codebase still runs as a native iOS/Android app through Expo Go — but the web is the primary way to play.

## Features

- **Realtime PvP** — Socket.io matches with hidden simultaneous moves, 10s round timers, disconnect grace + reconnect resync, AFK forfeit.
- **Ranked & casual matchmaking** — ranked queues per wager tier (10/50/100/500 coins) pair players by Elo proximity (tolerance widens while you wait); casual is free and unrated.
- **Simulated economy** — 500 coins at signup, matched bets escrowed on queue join, winner takes the pot, daily top-up when you're broke. Every coin movement is an auditable transaction row. No real money anywhere.
- **Elo rating + leaderboards** — K=32 Elo on ranked matches; weekly & monthly boards ranked by rating gained.
- **Profiles & friends** — win rate, bio, avatars (12 built-in or a photo); friend requests by username, online presence, direct challenges with optional wagers, post-match rematches.
- **Emote wheel** — radial two-arc taunt wheel in-match, rate-limited server-side.
- **Match history** — recent matches with opponent, score, coin and Elo deltas.
- **Three visual skins, one mechanic** — game logic only knows moves `A/B/C` (`A>C>B>A`); skins are pure presentation:
  - **Rock Paper Scissors** — classic stacked layout, synced fist-shake reveal.
  - **Kick Block Punch** — side-view arena, 3-2-1-FIGHT countdown, lunge attacks, hit-flash + screen shake.
  - **Spell Duel** — wizard duel; spell orbs channel, fly and collide.
  - Adding a skin = one folder + one registry entry (`apps/mobile/src/skins/`), zero logic changes.
- **Sound effects** — procedurally generated cues, mutable in Settings.
- **Practice vs bot** — server-side bot reuses the exact same match engine.

## Repository layout

```
packages/shared/   # @rps/shared — abstract moves, Elo math, economy constants,
                   # typed socket protocol + REST DTOs (both sides compile against this)
apps/server/       # @rps/server — Express + Socket.io + better-sqlite3; also serves the web app
apps/mobile/       # @rps/mobile — Expo app (Expo Router, zustand, Reanimated) -> web via react-native-web
```

## Run it (web)

Requires Node 20+.

```bash
npm install
npm run build:web   # export the web client (adds PWA/mobile-web tags)
npm start           # one server: game API + realtime + web client on :3001
```

Open **http://localhost:3001** — on your phone, use your machine's LAN address (e.g. `http://192.168.1.50:3001`). Sign up, hit **Practice vs bot**, or open a second browser/phone with a second account for real PvP. On iOS/Android you can **Add to Home Screen** and it launches standalone like an installed app.

Deploying is the same story anywhere Node runs (Fly.io, Railway, Render, a VPS): build the web client, start the server, done. State lives in a single SQLite file. Configure with env vars: `PORT`, `JWT_SECRET` (set a real one in production!), `DB_PATH`, `WEB_DIST`.

### Dev loop

```bash
npm run server               # backend with hot reload on :3001
cd apps/mobile && npx expo start   # press "w" for web with fast refresh
```

In dev the client auto-targets port 3001 on the Metro host, so phones on the same Wi-Fi work in Expo Go too.

## Tests

```bash
npm test            # all workspaces
npm run typecheck
```

- `packages/shared` — full truth-table of the move cycle, Elo math.
- `apps/server` — match engine unit tests with fake timers (draw replays, timeouts, AFK forfeit, disconnect grace/resync); single-process web-serving tests (SPA fallback vs API routes); and **end-to-end tests where two real socket.io clients sign up over REST, queue, escrow, play full ranked matches, rematch, challenge, emote**, asserting every coin/Elo movement via the API.
- `apps/mobile` — store lifecycle tests (including the instant-pairing race) and skin-registry invariants.

The deployed web build has also been driven with headless browsers: two phone-sized pages signing up, getting matched in ranked, taunting via the emote wheel, and playing a full match to the victory/defeat screens with correct ±coin deltas.

## Native apps (optional)

The same codebase still runs natively: `npx expo start` + Expo Go for development, and `apps/mobile/eas.json` has EAS build profiles if app-store distribution ever becomes interesting again.

## Notes

- Money is **simulated** — there are no payment rails of any kind.
- Auth is username + password (bcrypt) with 7-day JWTs; sessions are stateless.
- Matchmaking queues and live matches are in-memory; SQLite holds everything durable (users, matches, rounds, transactions, Elo history, friendships).
