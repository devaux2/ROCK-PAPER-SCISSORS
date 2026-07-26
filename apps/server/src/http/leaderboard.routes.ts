import { Router } from 'express';
import type { AppContext } from '../context';
import { requireAuth } from '../auth/jwt';

export function leaderboardRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/', requireAuth, (req, res) => {
    const window = req.query.window === 'monthly' ? 'monthly' : 'weekly';
    res.json(ctx.leaderboard.top(window));
  });

  router.get('/feed', requireAuth, (_req, res) => {
    res.json(ctx.leaderboard.recentWins());
  });

  return router;
}
