import { Router } from 'express';
import type { AppContext } from '../context';
import { hashPassword, verifyPassword } from './password';
import { signToken } from './jwt';
import { toProfile } from '../db/repos/users.repo';
import type { AuthResponse } from '@rps/shared';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function authRoutes(ctx: AppContext): Router {
  const router = Router();

  router.post('/signup', (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
      res.status(400).json({ error: 'Username must be 3-20 letters, numbers or underscores' });
      return;
    }
    if (typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }
    if (ctx.users.byUsername(username)) {
      res.status(409).json({ error: 'Username is taken' });
      return;
    }
    const user = ctx.users.create(username, hashPassword(password));
    const response: AuthResponse = {
      token: signToken({ userId: user.id, username: user.username }),
      user: toProfile(user),
    };
    res.status(201).json(response);
  });

  router.post('/login', (req, res) => {
    const { username, password } = req.body ?? {};
    const user = typeof username === 'string' ? ctx.users.byUsername(username) : undefined;
    if (!user || typeof password !== 'string' || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }
    const response: AuthResponse = {
      token: signToken({ userId: user.id, username: user.username }),
      user: toProfile(user),
    };
    res.json(response);
  });

  return router;
}
