import express from 'express';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import type { DB } from './db/db';
import { createContext, type AppContext } from './context';
import { authRoutes } from './auth/auth.routes';
import { profileRoutes } from './http/profile.routes';
import { friendsRoutes } from './http/friends.routes';
import { leaderboardRoutes } from './http/leaderboard.routes';
import { economyRoutes } from './http/economy.routes';
import { matchesRoutes } from './http/matches.routes';
import { createSocketServer, type RealtimeServer } from './realtime/socketServer';

export interface AppServer {
  ctx: AppContext;
  httpServer: HttpServer;
  realtime: RealtimeServer;
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

export function createServer(db: DB): AppServer {
  const ctx = createContext(db);
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  // The mobile app never needs CORS, but the Expo web build does.
  app.use((req, res, next) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'content-type, authorization');
    res.setHeader('access-control-allow-methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  const httpServer = createHttpServer(app);
  const realtime = createSocketServer(httpServer, ctx);

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use('/auth', authRoutes(ctx));
  app.use('/users', profileRoutes(ctx));
  app.use('/friends', friendsRoutes(ctx, (id) => realtime.presence.isOnline(id)));
  app.use('/leaderboards', leaderboardRoutes(ctx));
  app.use('/economy', economyRoutes(ctx));
  app.use('/matches', matchesRoutes(ctx));

  return {
    ctx,
    httpServer,
    realtime,
    listen(port: number) {
      return new Promise((resolve) => {
        httpServer.listen(port, () => {
          const address = httpServer.address();
          resolve(typeof address === 'object' && address ? address.port : port);
        });
      });
    },
    close() {
      return new Promise((resolve) => {
        realtime.close();
        httpServer.close(() => resolve());
        // Sockets keep the server alive; force-close any stragglers.
        httpServer.closeAllConnections?.();
      });
    },
  };
}
