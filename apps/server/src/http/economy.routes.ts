import { Router } from 'express';
import type { AppContext } from '../context';
import { requireAuth, type AuthedRequest } from '../auth/jwt';
import {
  DAILY_TOPUP_THRESHOLD,
  SOCIAL_BONUS_COINS,
  type SocialBonusResponse,
  type SocialPlatform,
  type TopupResponse,
} from '@rps/shared';

/** Hosts a share link may live on, per platform (www. is stripped first). */
const SOCIAL_HOSTS: Record<SocialPlatform, string[]> = {
  x: ['x.com', 'twitter.com', 'mobile.twitter.com'],
  facebook: ['facebook.com', 'm.facebook.com', 'fb.com'],
};

/** The one true host every alias of a platform collapses to. */
const CANONICAL_HOST: Record<SocialPlatform, string> = {
  x: 'x.com',
  facebook: 'facebook.com',
};

/**
 * Reduce a post link to a single canonical key so the same post can't be
 * claimed twice via trivial variants (scheme, www./mobile./m. aliases,
 * port, path case, trailing slash, %-encoding, query/hash). This is the
 * dedup key stored in social_claims.url (UNIQUE).
 */
function canonicalPostUrl(parsed: URL, platform: SocialPlatform): string {
  let path = parsed.pathname;
  try {
    path = decodeURIComponent(path);
  } catch {
    // leave malformed %-sequences as-is
  }
  path = path.toLowerCase().replace(/\/+$/, '');
  return `https://${CANONICAL_HOST[platform]}${path}`;
}

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

  /**
   * Share-to-earn: post about the game on X/Facebook, paste the post link,
   * collect coins. Verification is structural (a real post URL on the right
   * platform, never claimed before, one per platform per UTC day) — the
   * server has no platform API access to read the post body.
   */
  router.post('/social-bonus', (req: AuthedRequest, res) => {
    const { platform, url } = (req.body ?? {}) as { platform?: string; url?: string };
    if (platform !== 'x' && platform !== 'facebook') {
      res.status(400).json({ error: 'Unknown platform' });
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(String(url ?? ''));
    } catch {
      res.status(400).json({ error: "That doesn't look like a link" });
      return;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!SOCIAL_HOSTS[platform].includes(host)) {
      res.status(400).json({
        error: `That link isn't a ${platform === 'x' ? 'post on X' : 'Facebook post'}`,
      });
      return;
    }
    if (parsed.pathname.replace(/\/+$/, '').length < 3) {
      res.status(400).json({ error: 'Link to your post, not the homepage' });
      return;
    }
    const claimedToday = ctx.db
      .prepare(
        "SELECT COUNT(*) AS n FROM social_claims WHERE user_id = ? AND platform = ? AND created_at >= date('now')"
      )
      .get(req.auth!.userId, platform) as { n: number };
    if (claimedToday.n > 0) {
      res.status(429).json({ error: 'Already claimed today — post again tomorrow' });
      return;
    }
    const cleanUrl = canonicalPostUrl(parsed, platform);
    try {
      ctx.db
        .prepare('INSERT INTO social_claims (user_id, platform, url) VALUES (?, ?, ?)')
        .run(req.auth!.userId, platform, cleanUrl);
    } catch {
      res.status(409).json({ error: 'That post has already been claimed' });
      return;
    }
    const coins = ctx.transactions.apply(req.auth!.userId, SOCIAL_BONUS_COINS, 'social_bonus');
    const response: SocialBonusResponse = { granted: SOCIAL_BONUS_COINS, coins };
    res.json(response);
  });

  return router;
}
