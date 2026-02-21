import type { Request, Response, NextFunction } from 'express';
import type { AuthDB } from './db/interface.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    name: string;
    email: string;
    initials: string;
    isAdmin: boolean;
  };
}

export function createAuthMiddleware(db: AuthDB) {
  function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = db.findUserById(req.session.userId);

    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      initials: user.initials,
      isAdmin: user.isAdmin,
    };

    next();
  }

  function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    if (!req.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  }

  return { requireAuth, requireAdmin };
}
