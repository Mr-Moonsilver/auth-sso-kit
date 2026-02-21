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
  impersonatedBy?: {
    id: number;
    name: string;
    email: string;
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

    // Handle impersonation
    if (req.session.impersonateUserId) {
      if (user.isAdmin) {
        const impersonated = db.findUserById(req.session.impersonateUserId);
        if (impersonated) {
          req.user = {
            id: impersonated.id,
            name: impersonated.name,
            email: impersonated.email,
            initials: impersonated.initials,
            isAdmin: impersonated.isAdmin,
          };
          req.impersonatedBy = {
            id: user.id,
            name: user.name,
            email: user.email,
          };
          return next();
        }
        // Impersonated user was deleted — clear and fall through
        delete req.session.impersonateUserId;
      } else {
        // Real user lost admin status — clear impersonation
        delete req.session.impersonateUserId;
      }
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
