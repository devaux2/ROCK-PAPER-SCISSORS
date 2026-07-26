import { Server, type Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import {
  isMove,
  isEmoteId,
  EMOTE_COOLDOWN_MS,
  REMATCH_TTL_MS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@rps/shared';
import type { AppContext } from '../context';
import { verifyToken } from '../auth/jwt';
import { toPublicProfile } from '../db/repos/users.repo';
import type { PlayerPort } from '../game/MatchEngine';
import { MatchService } from '../game/matchService';
import { Matchmaking } from './matchmaking';
import { Challenges } from './challenges';
import { Presence } from './presence';

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents> & {
  data: { userId: number };
};

export interface RealtimeServer {
  io: Server<ClientToServerEvents, ServerToClientEvents>;
  presence: Presence;
  matches: MatchService;
  matchmaking: Matchmaking;
  close(): void;
}

export function createSocketServer(httpServer: HttpServer, ctx: AppContext): RealtimeServer {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: '*' },
  });

  const presence = new Presence(ctx);
  const matches = new MatchService(ctx);
  const matchmaking = new Matchmaking(ctx, matches);
  const challenges = new Challenges(ctx, matches, presence);
  matchmaking.start();

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = typeof token === 'string' ? verifyToken(token) : null;
    if (!payload || !ctx.users.byId(payload.userId)) {
      next(new Error('Unauthorized'));
      return;
    }
    (socket as GameSocket).data.userId = payload.userId;
    next();
  });

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as GameSocket;
    const userId = socket.data.userId;
    let lastEmoteAt = 0;

    const port: PlayerPort = {
      userId,
      get info() {
        return toPublicProfile(ctx.users.byId(userId)!);
      },
      send: (event, payload) => {
        (socket.emit as (e: string, p: unknown) => void)(event, payload);
      },
    };

    // A second connection for the same user replaces the first.
    const existing = presence.get(userId);
    if (existing) io.in(`user:${userId}`).disconnectSockets(true);
    socket.join(`user:${userId}`);
    presence.add(port);
    matches.handleReconnect(userId, port);

    socket.on('queue:join', (p, ack) => {
      if (!p || (p.mode !== 'ranked' && p.mode !== 'casual')) {
        ack({ ok: false, error: 'Invalid mode' });
        return;
      }
      ack(matchmaking.join(port, p.mode, p.wagerTier));
    });

    socket.on('queue:leave', () => {
      matchmaking.leave(userId);
    });

    socket.on('bot:start', (ack) => {
      if (matches.isInMatch(userId)) {
        ack({ ok: false, error: 'Already in a match' });
        return;
      }
      matchmaking.leave(userId);
      matches.createBotMatch(port);
      ack({ ok: true });
    });

    socket.on('challenge:send', (p, ack) => {
      if (!p || typeof p.toUserId !== 'number') {
        ack({ ok: false, error: 'Invalid challenge' });
        return;
      }
      ack(challenges.send(userId, p.toUserId, p.wagerTier));
    });

    socket.on('challenge:accept', (p, ack) => {
      if (!p || typeof p.challengeId !== 'string') {
        ack({ ok: false, error: 'Invalid challenge' });
        return;
      }
      ack(challenges.accept(p.challengeId, userId));
    });

    socket.on('challenge:decline', (p) => {
      if (p && typeof p.challengeId === 'string') challenges.decline(p.challengeId, userId);
    });

    socket.on('match:move', (p, ack) => {
      const engine = p && typeof p.matchId === 'string' ? matches.engineById(p.matchId) : undefined;
      if (!engine || !isMove(p.move)) {
        ack({ ok: false, error: 'Invalid move' });
        return;
      }
      ack(engine.submitMove(userId, p.move));
    });

    socket.on('match:emote', (p) => {
      if (!p || !isEmoteId(p.emoteId)) return;
      const now = Date.now();
      if (now - lastEmoteAt < EMOTE_COOLDOWN_MS) return;
      const engine = matches.engineById(p.matchId);
      if (engine && engine.hasPlayer(userId)) {
        lastEmoteAt = now;
        engine.opponentOf(userId)?.send('match:emote', { matchId: p.matchId, emoteId: p.emoteId });
        return;
      }
      // End-screen taunts: the match is over but both players linger on
      // the result for the rematch window.
      const finished = matches.finishedById(p.matchId);
      if (!finished || !finished.userIds.includes(userId)) return;
      if (now - finished.endedAt > REMATCH_TTL_MS) return;
      lastEmoteAt = now;
      const oppId = finished.userIds[0] === userId ? finished.userIds[1] : finished.userIds[0];
      presence.get(oppId)?.send('match:emote', { matchId: p.matchId, emoteId: p.emoteId });
    });

    socket.on('match:rematch', (p, ack) => {
      if (!p || typeof p.matchId !== 'string') {
        ack({ ok: false, error: 'Invalid match' });
        return;
      }
      ack(challenges.requestRematch(p.matchId, userId));
    });

    socket.on('match:forfeit', (p) => {
      if (!p || typeof p.matchId !== 'string') return;
      const engine = matches.engineById(p.matchId);
      if (engine?.hasPlayer(userId)) engine.forfeit(userId);
    });

    socket.on('match:resync', (ack) => {
      const engine = matches.engineForUser(userId);
      ack(engine?.snapshotFor(userId) ?? null);
    });

    socket.on('disconnect', () => {
      // Ignore if a newer connection already replaced this one.
      if (presence.get(userId) !== port) return;
      presence.remove(userId);
      matchmaking.leave(userId);
      matches.handleDisconnect(userId);
    });
  });

  return {
    io,
    presence,
    matches,
    matchmaking,
    close() {
      matchmaking.stop();
      io.close();
    },
  };
}
