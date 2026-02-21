import { Router, Response, RequestHandler } from 'express';
import type { AuthDB } from '../db/interface.js';
import type { AuthRequest } from '../middleware.js';

export function createAdminAuthRouter(
  db: AuthDB,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
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
