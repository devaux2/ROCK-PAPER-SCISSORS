# THROWDOWN — Rock Paper Scissors with stakes

A cross-platform (iOS + Android) mobile game where players face off in **best-of-3 rock-paper-scissors** matches, wagering **simulated coins** in ranked play. Built with React Native + Expo and a self-contained Node.js realtime server.

## Features

- **Realtime PvP** — Socket.io matches with hidden simultaneous moves, 10s round timers, disconnect grace + reconnect resync, AFK forfeit.
- **Ranked & casual matchmaking** — ranked queues per wager tier (10/50/100/500 coins) pair players by Elo proximity (tolerance widens while you wait); casual is free and unrated.
- **Simulated economy** — 500 coins at signup, matched bets escrowed on queue join, winner takes the pot, daily top-up when you're broke. Every coin movement is an auditable transaction row.
- **Elo rating + leaderboards** — K=32 Elo on ranked matches; weekly & monthly boards ranked by rating gained.
- **Profiles** — win rate, bio, avatar (12 built-in avatars or a photo from your library).
- **Friends** — requests by username, online presence, direct challenges with optional wagers, post-match rematch offers.
- **Emote wheel** — radial 8-emote taunt wheel in-match, rate-limited server-side.
- **Three visual skins, one mechanic** — the game logic only knows moves `A/B/C` (`A>C>B>A`). Skins are pure presentation:
  - **Rock Paper Scissors** — classic stacked layout, synced fist-shake reveal.
  - **Kick Block Punch** — side-view arena, 3-2-1-FIGHT countdown, lunge attacks, hit-flash + screen shake.
  - **Spell Duel** — wizard duel; spell orbs channel, fly and collide, the winning element flares.
  - Adding a skin = one folder + one registry entry (`apps/mobile/src/skins/`). No logic changes — Spell Duel was added exactly this way to prove it.
- **Match history** — recent matches with opponent, score, coin and Elo deltas (Profile → Match history).
- **Sound effects** — procedurally generated click/reveal/win/lose cues, mutable in Settings.
- **Practice vs bot** — server-side bot reuses the exact same match engine.

## Repository layout

```
packages/shared/   # @rps/shared — abstract moves, Elo math, economy constants,
                   # typed socket protocol + REST DTOs (both sides compile against this)
apps/server/       # @rps/server — Express + Socket.io + better-sqlite3 (SQLite)
apps/mobile/       # @rps/mobile — Expo app (Expo Router, zustand, Reanimated)
```

## Running it

Requires Node 20+.

```bash
npm install

# 1. Start the game server (listens on :3001, SQLite db in apps/server/data/)
npm run server

# 2. Start the app (Expo dev server) in another terminal
cd apps/mobile
npx expo start
```

Scan the QR code with **Expo Go** on iOS/Android. The app auto-derives the server address from the Metro host, so a phone on the same Wi-Fi reaches your dev machine automatically. To point elsewhere set `EXPO_PUBLIC_API_URL`, e.g.:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.50:3001 npx expo start
```

To try two-player matches locally, run the app twice (e.g. one phone + `npx expo start --web`, or two simulators), sign up two accounts, and queue both into the same ranked tier — or friend each other and use **Challenge**.

## Tests

```bash
npm test            # all workspaces
npm run typecheck   # tsc --noEmit in all workspaces
```

- `packages/shared` — full truth-table of the move cycle, Elo math.
- `apps/server` — match engine unit tests with fake timers (draw replays, timeouts, AFK forfeit, disconnect grace/resync), plus **end-to-end tests where two real socket.io clients sign up over REST, queue, play full ranked matches, rematch, challenge, emote** and every coin/Elo movement is asserted via the REST API.
- `apps/mobile` — store lifecycle tests and skin-registry invariants.

Visual smoke: `npx expo export --platform web` builds the full app graph; the exported web build has been driven with a headless browser (signup → menu → bot matches on both skins → K.O. screen). Reanimated animations target native devices — verify feel on a phone via Expo Go.

## Building for app stores (EAS)

`apps/mobile/eas.json` defines `development`, `preview` and `production` profiles. With an [Expo account](https://expo.dev) and the servers deployed somewhere reachable:

```bash
cd apps/mobile
npx eas-cli login
# set EXPO_PUBLIC_API_URL in eas.json to your deployed server URL first
npx eas-cli build --profile preview --platform all
```

`ios.bundleIdentifier` / `android.package` are already set in `app.json` (`com.rps.throwdown`). The server is a single Node process with a SQLite file — it runs anywhere Node 20+ does (`npm -w @rps/server run start`, set `PORT`, `JWT_SECRET` and `DB_PATH` in production).

## Notes

- Money is **simulated** — there are no payment rails of any kind.
- Auth is username + password (bcrypt) with 7-day JWTs; sessions are stateless.
- The matchmaking queues and live matches are in-memory; SQLite holds everything durable (users, matches, rounds, transactions, Elo history, friendships).
