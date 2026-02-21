import type { Express } from 'express';
import session from 'express-session';
import type { AuthKitConfig, SetupAuthResult } from './types.js';
import { setOIDCConfig } from './oidc.js';
import { createAuthMiddleware } from './middleware.js';
import { createAuthRouter } from './routes/auth.js';
import { createUsersRouter } from './routes/users.js';
import { createAdminAuthRouter } from './routes/admin-auth.js';

// Extend express-session types for auth kit
declare module 'express-session' {
  interface SessionData {
    userId: number;
    impersonateUserId?: number;
    oidcState?: string;
    oidcCodeVerifier?: string;
  }
}

export function setupAuth(app: Express, config: AuthKitConfig): SetupAuthResult {
  // Initialize DB schema
  config.db.initSchema();

  // Seed default registration mode if not already set
  if (!config.db.getSetting('registration_mode')) {
    config.db.setSetting('registration_mode', config.defaultRegistrationMode ?? 'open');
  }

  // Seed allowlist emails if provided
  if (config.seedEmails) {
    for (const seed of config.seedEmails) {
      config.db.addAllowedEmail(seed.email, 0);
      // If seed specifies admin, update the allowed_emails record
      // (addAllowedEmail is idempotent — returns existing if already present)
    }
  }

  // Configure OIDC if provided
  if (config.oidc) {
    setOIDCConfig(config.oidc);
  }

  // Setup session middleware
  app.use(
    session({
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: config.session.secure ?? false,
        httpOnly: true,
        maxAge: config.session.maxAge ?? 24 * 60 * 60 * 1000,
      },
    })
  );

  // Create or reuse middleware
  const { requireAuth, requireAdmin } = config.middleware
    ? config.middleware
    : createAuthMiddleware(config.db);

  // Create routers
  const authRouter = createAuthRouter(config.db, requireAuth, {
    onUserCreated: config.hooks?.onUserCreated,
  });

  const usersRouter = createUsersRouter(config.db, requireAuth, requireAdmin, {
    onBeforeUserDelete: config.hooks?.onBeforeUserDelete,
  });

  const adminAuthRouter = createAdminAuthRouter(config.db, requireAuth, requireAdmin, {
    onUserCreated: config.hooks?.onUserCreated,
  });

  return {
    requireAuth,
    requireAdmin,
    authRouter,
    usersRouter,
    adminAuthRouter,
  };
}

// Re-export everything consumers need
export { createAuthMiddleware } from './middleware.js';
export type { AuthRequest } from './middleware.js';
export type { AuthKitConfig, SetupAuthResult, AuthDB, AuthUser, CreateUserData, AllowedEmailRecord, AllowedEmailWithStatus } from './types.js';
export { SqliteAuthDB } from './db/sqlite.js';
