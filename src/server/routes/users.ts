import { Router, Response, RequestHandler } from 'express';
import type { AuthDB } from '../db/interface.js';
import type { AuthRequest } from '../middleware.js';

export interface UsersRouterHooks {
  onBeforeUserDelete?: (userId: number) => void | Promise<void>;
}

export function createUsersRouter(
  db: AuthDB,
  requireAuth: RequestHandler,
  requireAdmin: RequestHandler,
  hooks?: UsersRouterHooks,
): Router {
  const router = Router();

  // Get all users
  router.get('/', requireAuth as any, async (req: AuthRequest, res: Response) => {
    const users = await db.listUsers();
    res.json(users);
  });

  // Toggle admin status
  router.put('/:id/admin', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { isAdmin } = req.body;

    if (Number(id) === req.user?.id && !isAdmin) {
      return res.status(400).json({ error: 'Cannot remove your own admin status' });
    }

    await db.updateUserAdmin(Number(id), isAdmin);
    res.json({ success: true });
  });

  // Delete user
  router.delete('/:id', requireAuth as any, requireAdmin as any, async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    if (Number(id) === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    // Call hook so the app can clean up its own tables
    await hooks?.onBeforeUserDelete?.(Number(id));

    await db.deleteUser(Number(id));
    res.json({ success: true });
  });

  return router;
}
