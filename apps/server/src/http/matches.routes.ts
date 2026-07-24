import { Router } from 'express';
import type { AppContext } from '../context';
import { requireAuth, type AuthedRequest } from '../auth/jwt';

export function matchesRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/history', requireAuth, (req: AuthedRequest, res) => {
    res.json(ctx.matches.historyFor(req.auth!.userId));
  });

  return router;
}
