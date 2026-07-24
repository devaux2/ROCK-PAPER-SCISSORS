import { Router } from 'express';
import type { AppContext } from '../context';
import { requireAuth, type AuthedRequest } from '../auth/jwt';
import { toPublicProfile } from '../db/repos/users.repo';
import type { FriendEntry } from '@rps/shared';

/** isOnline lets the realtime layer inject presence without a circular dep. */
export function friendsRoutes(ctx: AppContext, isOnline: (userId: number) => boolean): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', (req: AuthedRequest, res) => {
    const me = req.auth!.userId;
    const entries: FriendEntry[] = ctx.friends.listFor(me).map(({ friendship, other }) => ({
      user: toPublicProfile(other),
      status: friendship.status,
      incoming: friendship.status === 'pending' && friendship.addressee_id === me,
      online: isOnline(other.id),
    }));
    res.json(entries);
  });

  router.post('/request', (req: AuthedRequest, res) => {
    const me = req.auth!.userId;
    const { username } = req.body ?? {};
    const target = typeof username === 'string' ? ctx.users.byUsername(username) : undefined;
    if (!target) {
      res.status(404).json({ error: 'No player with that username' });
      return;
    }
    if (target.id === me) {
      res.status(400).json({ error: "You can't friend yourself" });
      return;
    }
    const existing = ctx.friends.between(me, target.id);
    if (existing) {
      res.status(409).json({
        error: existing.status === 'accepted' ? 'Already friends' : 'Request already pending',
      });
      return;
    }
    ctx.friends.request(me, target.id);
    res.status(201).json({ ok: true });
  });

  router.post('/:userId/accept', (req: AuthedRequest, res) => {
    const me = req.auth!.userId;
    const other = Number(req.params.userId);
    const f = ctx.friends.between(me, other);
    if (!f || f.status !== 'pending' || f.addressee_id !== me) {
      res.status(404).json({ error: 'No incoming request from that user' });
      return;
    }
    ctx.friends.accept(f.id);
    res.json({ ok: true });
  });

  router.post('/:userId/decline', (req: AuthedRequest, res) => {
    const me = req.auth!.userId;
    const other = Number(req.params.userId);
    const f = ctx.friends.between(me, other);
    if (!f || f.status !== 'pending' || f.addressee_id !== me) {
      res.status(404).json({ error: 'No incoming request from that user' });
      return;
    }
    ctx.friends.remove(f.id);
    res.json({ ok: true });
  });

  router.delete('/:userId', (req: AuthedRequest, res) => {
    const me = req.auth!.userId;
    const other = Number(req.params.userId);
    const f = ctx.friends.between(me, other);
    if (!f) {
      res.status(404).json({ error: 'Not friends' });
      return;
    }
    ctx.friends.remove(f.id);
    res.json({ ok: true });
  });

  return router;
}
