import { Router, Response, RequestHandler } from 'express';
import type { AuthDB, AuthUser } from '../db/interface.js';
import type { AuthRequest } from '../middleware.js';
import { generateInitials, deriveNameFromEmail } from '../utils.js';

export interface AdminAuthRouterHooks {
  onUserCreated?: (user: AuthUser) => void;
  permissionDefinitions?: string[];
}

export function createAdminAuthRouter(
  db: AuthDB,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
  hooks?: AdminAuthRouterHooks,
): Router {
  const router = Router();

  // Get allowed emails
  router.get('/allowed-emails', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const emails = await db.listAllowedEmails();
    res.json(emails);
  });

  // Add allowed email
  router.post('/allowed-emails', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalized = email.trim().toLowerCase();

    const existing = await db.findAllowedEmail(normalized);
    if (existing) {
      return res.status(409).json({ error: 'Email already in allowlist' });
    }

    const result = await db.addAllowedEmail(normalized, req.user?.id ?? 0);
    res.json(result);
  });

  // Remove allowed email
  router.delete('/allowed-emails/:id', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    const entry = await db.removeAllowedEmail(Number(id));
    if (!entry) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Prevent removing own email from allowlist
    if (req.user?.email?.toLowerCase() === entry.email.toLowerCase()) {
      // Re-add it since we already removed
      await db.addAllowedEmail(entry.email, req.user?.id ?? 0);
      return res.status(400).json({ error: 'Cannot remove your own email from the allowlist' });
    }

    res.json({ success: true });
  });

  // Get registration mode
  router.get('/registration-mode', requireAuth as any, requireAdmin as any, async (_req: AuthRequest, res: Response) => {
    const mode = await db.getSetting('registration_mode') || 'open';
    res.json({ mode });
  });

  // Set registration mode
  router.put('/registration-mode', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { mode } = req.body;
    if (mode !== 'open' && mode !== 'allowlist') {
      return res.status(400).json({ error: 'Mode must be "open" or "allowlist"' });
    }
    await db.setSetting('registration_mode', mode);
    res.json({ mode });
  });

  // Start impersonation
  router.post('/impersonate/:id', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const targetId = Number(req.params.id);

    if (targetId === req.user?.id) {
      return res.status(400).json({ error: 'Cannot impersonate yourself' });
    }

    const target = await db.findUserById(targetId);
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
  router.post('/users/pre-create', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { email, name: providedName } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    const normalized = email.trim().toLowerCase();

    const existing = await db.findUserByEmail(normalized);
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Auto-add to allowlist if not already there
    await db.addAllowedEmail(normalized, req.user?.id ?? 0);

    const name = (providedName && typeof providedName === 'string' && providedName.trim())
      ? providedName.trim()
      : deriveNameFromEmail(normalized);
    const initials = generateInitials(name);

    const newUser = await db.createUser({
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

  // Change own password (any authenticated user)
  router.put('/users/me/password', requireAuth as any, async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const user = await db.findUserById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user already has a password, verify the current one
    if (user.passwordHash) {
      if (!currentPassword || typeof currentPassword !== 'string') {
        return res.status(400).json({ error: 'Current password is required' });
      }
      const valid = await Bun.password.verify(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
    }

    const hash = await Bun.password.hash(newPassword);
    await db.updateUserPassword(req.user!.id, hash);
    res.json({ success: true });
  });

  // Reset user password (admin only)
  router.put('/users/:id/reset-password', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await db.findUserById(Number(id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hash = await Bun.password.hash(password);
    await db.updateUserPassword(Number(id), hash);
    res.json({ success: true });
  });

  // --- Roles ---

  // List all roles
  router.get('/roles', requireAuth as any, requireAdmin as any, async (_req: AuthRequest, res: Response) => {
    const roles = await db.listRoles();
    res.json(roles);
  });

  // Create role
  router.post('/roles', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }
    try {
      const role = await db.createRole(name.trim(), description || '');
      res.json(role);
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Role name already exists' });
      }
      throw err;
    }
  });

  // Update role
  router.put('/roles/:id', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { name, description } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Role name is required' });
    }
    const role = await db.getRole(Number(id));
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    try {
      await db.updateRole(Number(id), name.trim(), description || '');
      res.json({ success: true });
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Role name already exists' });
      }
      throw err;
    }
  });

  // Delete role
  router.delete('/roles/:id', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const role = await db.getRole(Number(id));
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    await db.deleteRole(Number(id));
    res.json({ success: true });
  });

  // Get permissions for a role
  router.get('/roles/:id/permissions', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const role = await db.getRole(Number(id));
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    const permissions = await db.getRolePermissions(Number(id));
    res.json(permissions);
  });

  // Update permissions for a role
  router.put('/roles/:id/permissions', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { permissions } = req.body;
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions array is required' });
    }
    const role = await db.getRole(Number(id));
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    await db.setRolePermissions(Number(id), permissions);
    res.json({ success: true });
  });

  // Get available permission definitions
  router.get('/permissions', requireAuth as any, requireAdmin as any, (_req: AuthRequest, res: Response) => {
    res.json(hooks?.permissionDefinitions ?? []);
  });

  return router;
}
