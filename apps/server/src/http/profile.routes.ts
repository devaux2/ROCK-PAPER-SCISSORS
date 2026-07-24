import { Router } from 'express';
import type { AppContext } from '../context';
import { requireAuth, type AuthedRequest } from '../auth/jwt';
import { toProfile, toPublicProfile } from '../db/repos/users.repo';

const MAX_BIO = 160;
// ~40 KB of base64 ≈ 30 KB image — plenty for a 128×128 avatar.
const MAX_AVATAR = 60_000;
const BUILTIN_AVATAR_RE = /^avatar_(0[1-9]|1[0-2])$/;

export function profileRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/me', requireAuth, (req: AuthedRequest, res) => {
    const user = ctx.users.byId(req.auth!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(toProfile(user));
  });

  router.patch('/me', requireAuth, (req: AuthedRequest, res) => {
    const { bio, avatar } = req.body ?? {};
    if (bio !== undefined && (typeof bio !== 'string' || bio.length > MAX_BIO)) {
      res.status(400).json({ error: `Bio must be a string of at most ${MAX_BIO} characters` });
      return;
    }
    if (avatar !== undefined) {
      const valid =
        typeof avatar === 'string' &&
        avatar.length <= MAX_AVATAR &&
        (BUILTIN_AVATAR_RE.test(avatar) || avatar.startsWith('b64:'));
      if (!valid) {
        res.status(400).json({ error: 'Invalid avatar' });
        return;
      }
    }
    const user = ctx.users.updateProfile(req.auth!.userId, { bio, avatar });
    res.json(toProfile(user));
  });

  router.get('/:id', requireAuth, (req, res) => {
    const id = Number(req.params.id);
    const user = Number.isInteger(id) ? ctx.users.byId(id) : undefined;
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json(toPublicProfile(user));
  });

  return router;
}
