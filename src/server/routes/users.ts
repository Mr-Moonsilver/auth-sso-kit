import { Router, Response, RequestHandler } from 'express';
import type { AuthDB } from '../db/interface.js';
import type { AuthRequest } from '../middleware.js';

export interface UsersRouterHooks {
  onBeforeUserDelete?: (userId: number) => void;
}

export function createUsersRouter(
  db: AuthDB,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
  hooks?: UsersRouterHooks,
): Router {
  const router = Router();

  // Get all users
  router.get('/', requireAuth as any, (req: AuthRequest, res: Response) => {
    const users = db.listUsers();
    const usersWithRoles = users.map((u) => ({
      ...u,
      roles: db.getUserRoles(u.id),
    }));
    res.json(usersWithRoles);
  });

  // Toggle admin status
  router.put('/:id/admin', requireAuth as any, requireAdmin as any, (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { isAdmin } = req.body;

    if (Number(id) === req.user?.id && !isAdmin) {
      return res.status(400).json({ error: 'Cannot remove your own admin status' });
    }

    db.updateUserAdmin(Number(id), isAdmin);
    res.json({ success: true });
  });

  // Assign roles to user
  router.put('/:id/roles', requireAuth as any, requireAdmin as any, (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { roleIds } = req.body;
    if (!Array.isArray(roleIds)) {
      return res.status(400).json({ error: 'roleIds array is required' });
    }
    const user = db.findUserById(Number(id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    db.setUserRoles(Number(id), roleIds);
    res.json({ success: true });
  });

  // Delete user
  router.delete('/:id', requireAuth as any, requireAdmin as any, (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (Number(id) === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Call hook so the app can clean up its own tables
    hooks?.onBeforeUserDelete?.(Number(id));

    db.deleteUser(Number(id));
    res.json({ success: true });
  });

  return router;
}
