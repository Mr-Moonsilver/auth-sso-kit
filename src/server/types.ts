import type { RequestHandler, Router } from 'express';
import type { AuthDB, AuthUser } from './db/interface.js';

export interface AuthKitConfig {
  db: AuthDB;
  session: {
    secret: string;
    maxAge?: number;
    secure?: boolean;
  };
  oidc?: {
    issuerUrl: string;
    clientId: string;
    clientSecret: string;
    appUrl: string;
  };
  hooks?: {
    onBeforeUserDelete?: (userId: number) => void;
    onUserCreated?: (user: AuthUser) => void;
  };
  seedEmails?: Array<{ email: string; isAdmin?: boolean }>;
  /** Pass existing middleware to reuse instead of creating new instances */
  middleware?: {
    requireAuth: RequestHandler;
    requireAdmin: RequestHandler;
  };
}

export interface SetupAuthResult {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  authRouter: Router;
  usersRouter: Router;
  adminAuthRouter: Router;
}

export type { AuthDB, AuthUser } from './db/interface.js';
export type { CreateUserData, AllowedEmailRecord, AllowedEmailWithStatus } from './db/interface.js';
