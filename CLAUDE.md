# auth-sso-kit

This is a reusable authentication and user management library. Apps import it as a submodule. Read `README.md` for full integration details.

## Rules for AI agents

1. **Don't reimplement auth flows in app code.** This kit handles login, registration, sessions, OIDC, and user management.
2. **Don't modify this submodule** unless the change is genuinely reusable across multiple apps.
3. **Use the kit's exports** — don't write custom auth middleware, login pages, or user management UI.
4. **App-specific cleanup goes in hooks**, not in the kit. Use `onBeforeUserDelete` to clean app tables.

## Server exports (`auth-sso-kit/server`)

- `setupAuth(app, config)` — one-call setup, returns auth routers + middleware
- `createAuthMiddleware(db)` — creates `requireAuth` and `requireAdmin` middleware
- `SqliteAuthDB` — SQLite adapter implementing the `AuthDB` interface

## Client exports (`auth-sso-kit/client`)

- `AuthProvider` / `useAuth()` — React context for auth state (`user`, `isAdmin`, `logout`, `impersonatedBy`)
- `LoginPage` — configurable login component (title, subtitle, OIDC button label)
- `UserManagementPanel` — admin user table with invite, delete, impersonate
- `authApi` — typed API client for auth endpoints

## Integration pattern

```
// Server: delegate to kit
const auth = setupAuth(app, { db, session, seedEmails, oidc, hooks });
app.use('/api/auth', auth.authRouter);
app.use('/api/users', auth.usersRouter);
app.use('/api/admin', auth.adminAuthRouter);

// Client: wrap in provider
<AuthProvider><App /></AuthProvider>

// Middleware: import from local wrapper
import { requireAuth, requireAdmin } from './middleware/auth.js';
```
