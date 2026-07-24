import { Router } from 'express';
import type { AppContext } from '../context';
import { requireAuth, type AuthedRequest } from '../auth/jwt';
import { DAILY_TOPUP_THRESHOLD, type TopupResponse } from '@rps/shared';

function utcDay(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

export function economyRoutes(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/daily-topup', (req: AuthedRequest, res) => {
    const user = ctx.users.byId(req.auth!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (user.coins >= DAILY_TOPUP_THRESHOLD) {
      res.status(400).json({ error: `Top-up is only available below ${DAILY_TOPUP_THRESHOLD} coins` });
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (utcDay(user.last_topup_at) === today) {
      res.status(429).json({ error: 'Already claimed today — come back tomorrow' });
      return;
    }
    const granted = DAILY_TOPUP_THRESHOLD - user.coins;
    const coins = ctx.transactions.apply(user.id, granted, 'daily_topup');
    ctx.db
      .prepare("UPDATE users SET last_topup_at = datetime('now') WHERE id = ?")
      .run(user.id);
    const response: TopupResponse = { granted, coins };
    res.json(response);
  });

  router.get('/history', (req: AuthedRequest, res) => {
    res.json(ctx.transactions.history(req.auth!.userId));
  });

  return router;
}
