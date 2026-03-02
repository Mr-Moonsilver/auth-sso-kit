import type { RequestHandler, Router } from 'express';
import type { AuthDB, AuthUser, RoleSeed } from './db/interface.js';

export interface RolesConfig {
  definitions: string[];
  permissions: string[];
  seed?: RoleSeed[];
}

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
  /** Default registration mode for fresh databases. Defaults to 'open'. */
  defaultRegistrationMode?: 'open' | 'allowlist';
  /** Pass existing middleware to reuse instead of creating new instances */
  middleware?: {
    requireAuth: RequestHandler;
    requireAdmin: RequestHandler;
  };
  /** Optional roles and permissions configuration */
  roles?: RolesConfig;
}

export interface SetupAuthResult {
  requireAuth: RequestHandler;
  requireAdmin: RequestHandler;
  requireRole: (role: string) => RequestHandler;
  requireAnyRole: (roles: string[]) => RequestHandler;
  requirePermission: (permission: string) => RequestHandler;
  authRouter: Router;
  usersRouter: Router;
  adminAuthRouter: Router;
}

export type { AuthDB, AuthUser } from './db/interface.js';
export type { CreateUserData, AllowedEmailRecord, AllowedEmailWithStatus } from './db/interface.js';
export type { Role, Permission, RoleSeed } from './db/interface.js';
