import { Router, Request, Response, RequestHandler } from 'express';
import * as client from 'openid-client';
import type { AuthDB, AuthUser } from '../db/interface.js';
import type { AuthRequest } from '../middleware.js';
import { isOIDCEnabled, getAppUrl, getRedirectUri, getOIDCConfig } from '../oidc.js';
import { generateInitials, deriveNameFromEmail } from '../utils.js';

// ── In-memory rate limiter for login ──
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const RATE_LIMIT_MAX = 5;         // max attempts per window
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

function getRateLimitKey(req: Request): string {
  // Trust X-Forwarded-For if trust proxy is set, otherwise use socket IP
  return (req.ip || req.socket.remoteAddress || 'unknown');
}

function checkLoginRateLimit(req: Request, res: Response): boolean {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const entry = loginAttempts.get(key);

  if (!entry || now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
    loginAttempts.set(key, { count: 1, firstAttempt: now });
    return true;
  }

  entry.count++;

  if (entry.count > RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.firstAttempt + RATE_LIMIT_WINDOW - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({ error: 'Too many login attempts. Please try again later.' });
    return false;
  }

  return true;
}

// Cleanup stale entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if (now - entry.firstAttempt > RATE_LIMIT_WINDOW) {
      loginAttempts.delete(key);
    }
  }
}, 30 * 60 * 1000);

export interface AuthRouterHooks {
  onUserCreated?: (user: AuthUser) => void;
}

export function createAuthRouter(
  db: AuthDB,
  requireAuth: RequestHandler,
  hooks?: AuthRouterHooks,
): Router {
  const router = Router();

  // Auth config — tells the client which auth method is active
  router.get('/config', async (_req: Request, res: Response) => {
    const registrationMode = await db.getSetting('registration_mode') || 'open';
    res.json({
      method: isOIDCEnabled() ? 'oidc' : 'password',
      registrationMode,
    });
  });

  // Password login (disabled when SSO is enabled)
  router.post('/login', async (req: Request, res: Response) => {
    if (isOIDCEnabled()) {
      return res.status(400).json({ error: 'Password login is disabled when SSO is enabled' });
    }

    // Rate limit: 5 attempts per 15 minutes per IP
    if (!checkLoginRateLimit(req, res)) return;

    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const registrationMode = await db.getSetting('registration_mode') || 'open';

    // Check allowlist (skip in open mode)
    const allowed = await db.findAllowedEmail(normalizedEmail);
    if (registrationMode === 'allowlist' && !allowed) {
      return res.status(403).json({ error: 'Email not authorized. Contact an administrator.' });
    }

    // Find existing user
    const existingUser = await db.findUserByEmail(normalizedEmail);

    if (!existingUser) {
      // First-time login: create user with this password
      const name = deriveNameFromEmail(normalizedEmail);
      const initials = generateInitials(name);
      const hash = await Bun.password.hash(password);

      // First-user auto-admin in open mode
      const allUsers = await db.listUsers();
      const isFirstUser = registrationMode === 'open' && allUsers.length === 0;
      const isAdmin = isFirstUser || (allowed?.isAdmin ?? false);

      const newUser = await db.createUser({
        name,
        email: normalizedEmail,
        initials,
        isAdmin,
        passwordHash: hash,
      });

      req.session.userId = newUser.id;
      hooks?.onUserCreated?.(newUser);

      return res.json({
        id: newUser.id,
        name: newUser.name,
        email: normalizedEmail,
        initials: newUser.initials,
        isAdmin: newUser.isAdmin,
      });
    }

    // Existing user
    if (!existingUser.passwordHash) {
      // User exists but has no password (e.g., created via OIDC) — set it now
      const hash = await Bun.password.hash(password);
      await db.updateUserPassword(existingUser.id, hash);
    } else {
      const valid = await Bun.password.verify(password, existingUser.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }

    req.session.userId = existingUser.id;
    res.json({
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email,
      initials: existingUser.initials,
      isAdmin: existingUser.isAdmin,
    });
  });

  // OIDC login — redirects to identity provider
  router.get('/oidc/login', async (req: Request, res: Response) => {
    if (!isOIDCEnabled()) {
      return res.status(400).json({ error: 'SSO is not configured' });
    }

    try {
      const config = await getOIDCConfig();
      const codeVerifier = client.randomPKCECodeVerifier();
      const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
      const state = client.randomState();

      req.session.oidcState = state;
      req.session.oidcCodeVerifier = codeVerifier;

      const redirectTo = client.buildAuthorizationUrl(config, {
        redirect_uri: getRedirectUri(),
        scope: 'openid email profile',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
      });

      req.session.save(() => {
        res.redirect(redirectTo.href);
      });
    } catch (err) {
      console.error('OIDC login error:', err);
      res.redirect('/#login?error=oidc_failed');
    }
  });

  // OIDC callback — handles the redirect from identity provider
  router.get('/oidc/callback', async (req: Request, res: Response) => {
    if (!isOIDCEnabled()) {
      return res.status(400).json({ error: 'SSO is not configured' });
    }

    try {
      const config = await getOIDCConfig();
      const currentUrl = new URL(`${getAppUrl()}${req.originalUrl}`);

      const tokens = await client.authorizationCodeGrant(config, currentUrl, {
        pkceCodeVerifier: req.session.oidcCodeVerifier,
        expectedState: req.session.oidcState,
      });

      delete req.session.oidcState;
      delete req.session.oidcCodeVerifier;

      const claims = tokens.claims();
      const email = claims?.email as string | undefined;

      if (!email) {
        return res.redirect('/#login?error=no_email');
      }

      const normalizedEmail = email.trim().toLowerCase();
      const registrationMode = await db.getSetting('registration_mode') || 'open';

      // Check allowlist (skip in open mode)
      const allowed = await db.findAllowedEmail(normalizedEmail);
      if (registrationMode === 'allowlist' && !allowed) {
        return res.redirect('/#login?error=not_authorized');
      }

      // Find or create user
      let user = await db.findUserByEmail(normalizedEmail);

      if (!user) {
        const name = (claims?.name as string) || deriveNameFromEmail(normalizedEmail);
        const initials = generateInitials(name);

        // First-user auto-admin in open mode
        const allUsers = await db.listUsers();
        const isFirstUser = registrationMode === 'open' && allUsers.length === 0;
        const isAdmin = isFirstUser || (allowed?.isAdmin ?? false);

        user = await db.createUser({
          name,
          email: normalizedEmail,
          initials,
          isAdmin,
        });

        hooks?.onUserCreated?.(user);
      }

      req.session.userId = user.id;

      req.session.save(() => {
        res.redirect('/');
      });
    } catch (err) {
      console.error('OIDC callback error:', err);
      res.redirect('/#login?error=oidc_failed');
    }
  });

  // Get current user
  router.get('/me', requireAuth as any, async (req: AuthRequest, res: Response) => {
    const data: any = { ...req.user };
    if (req.impersonatedBy) {
      data.impersonatedBy = req.impersonatedBy;
    }
    // Include roles (already on req.user) and permissions
    if (req.user) {
      data.roles = req.user.roles;
      data.permissions = await db.getUserPermissions(req.user.id);
    }
    res.json(data);
  });

  // Logout
  router.post('/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to logout' });
      }
      res.json({ success: true });
    });
  });

  return router;
}
