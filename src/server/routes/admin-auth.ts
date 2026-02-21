import { Router, Response, RequestHandler } from 'express';
import type { AuthDB, AuthUser } from '../db/interface.js';
import type { AuthRequest } from '../middleware.js';
import { generateInitials, deriveNameFromEmail } from '../utils.js';

export interface AdminAuthRouterHooks {
  onUserCreated?: (user: AuthUser) => void;
}

export function createAdminAuthRouter(
  db: AuthDB,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
  hooks?: AdminAuthRouterHooks,
): Router {
  const router = Router();

  // Get allowed emails
  router.get('/allowed-emails', requireAuth as any, requireAdmin as any, (req: AuthRequest, res: Response) => {
    const emails = db.listAllowedEmails();
    res.json(emails);
  });

  // Add allowed email
  router.post('/allowed-emails', requireAuth as any, requireAdmin as any, (req: AuthRequest, res: Response) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalized = email.trim().toLowerCase();

    const existing = db.findAllowedEmail(normalized);
    if (existing) {
      return res.status(409).json({ error: 'Email already in allowlist' });
    }

    const result = db.addAllowedEmail(normalized, req.user?.id ?? 0);
    res.json(result);
  });

  // Remove allowed email
  router.delete('/allowed-emails/:id', requireAuth as any, requireAdmin as any, (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const entry = db.removeAllowedEmail(Number(id));
    if (!entry) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Prevent removing own email from allowlist
    if (req.user?.email?.toLowerCase() === entry.email.toLowerCase()) {
      // Re-add it since we already removed
      db.addAllowedEmail(entry.email, req.user?.id ?? 0);
      return res.status(400).json({ error: 'Cannot remove your own email from the allowlist' });
    }

    res.json({ success: true });
  });

  // Get registration mode
  router.get('/registration-mode', requireAuth as any, requireAdmin as any, (_req: AuthRequest, res: Response) => {
    const mode = db.getSetting('registration_mode') || 'open';
    res.json({ mode });
  });

  // Set registration mode
  router.put('/registration-mode', requireAuth as any, requireAdmin as any, (req: AuthRequest, res: Response) => {
    const { mode } = req.body;
    if (mode !== 'open' && mode !== 'allowlist') {
      return res.status(400).json({ error: 'Mode must be "open" or "allowlist"' });
    }
    db.setSetting('registration_mode', mode);
    res.json({ mode });
  });

  // Start impersonation
  router.post('/impersonate/:id', requireAuth as any, requireAdmin as any, (req: AuthRequest, res: Response) => {
    const targetId = Number(req.params.id);

    if (targetId === req.user?.id) {
      return res.status(400).json({ error: 'Cannot impersonate yourself' });
    }

    const target = db.findUserById(targetId);
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    req.session.impersonateUserId = target.id;
    res.json({
      success: true,
      impersonating: { id: target.id, name: target.name, email: target.email, initials: target.initials },
    });
  });

  // Stop impersonation — requires auth only, NOT requireAdmin
  // Authorizes via req.impersonatedBy (set by middleware when impersonating)
  router.post('/stop-impersonate', requireAuth as any, (req: AuthRequest, res: Response) => {
    if (!req.impersonatedBy) {
      return res.status(400).json({ error: 'Not currently impersonating' });
    }

    delete req.session.impersonateUserId;
    res.json({ success: true });
  });

  // Pre-create a user account
  router.post('/users/pre-create', requireAuth as any, requireAdmin as any, (req: AuthRequest, res: Response) => {
    const { email, name: providedName } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalized = email.trim().toLowerCase();

    const existing = db.findUserByEmail(normalized);
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Auto-add to allowlist if not already there
    db.addAllowedEmail(normalized, req.user?.id ?? 0);

    const name = (providedName && typeof providedName === 'string' && providedName.trim())
      ? providedName.trim()
      : deriveNameFromEmail(normalized);
    const initials = generateInitials(name);

    const newUser = db.createUser({
      name,
      email: normalized,
      initials,
      isAdmin: false,
      passwordHash: null,
    });

    hooks?.onUserCreated?.(newUser);

    res.json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      initials: newUser.initials,
      isAdmin: newUser.isAdmin,
    });
  });

  // Reset user password (password mode only)
  router.put('/users/:id/reset-password', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = db.findUserById(Number(id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hash = await Bun.password.hash(password);
    db.updateUserPassword(Number(id), hash);
    res.json({ success: true });
  });

  return router;
}
