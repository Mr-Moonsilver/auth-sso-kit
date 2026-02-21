# auth-sso-kit

Pluggable authentication and user management for Bun + Express + React apps. Supports dual-mode auth: OIDC (SSO) and password-based login with an admin-managed email allowlist.

## Features

- **Dual auth modes**: OIDC (via openid-client v6 with PKCE) or email/password
- **Email allowlist**: Admin-managed list controls who can log in
- **User management**: CRUD, toggle admin, password reset
- **Session-based**: express-session with configurable options
- **React components**: AuthProvider, LoginPage, UserManagementPanel
- **DB adapter**: Ships with SQLite (bun:sqlite), swappable to Postgres

## Quick Start

### 1. Add to your project as a git submodule

```bash
git submodule add <repo-url> lib/auth-sso-kit
```

### 2. Server integration

```ts
import express from 'express';
import { Database } from 'bun:sqlite';
import { setupAuth, SqliteAuthDB } from './lib/auth-sso-kit/src/server/index.js';

const app = express();
app.use(express.json());

const db = new Database('data/app.db');
const auth = setupAuth(app, {
  db: new SqliteAuthDB(db),
  session: { secret: process.env.SESSION_SECRET || 'change-me' },
  seedEmails: [{ email: 'admin@example.com', isAdmin: true }],

  // Optional: OIDC (auto-detected from env vars)
  oidc: process.env.OIDC_ISSUER_URL ? {
    issuerUrl: process.env.OIDC_ISSUER_URL,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    appUrl: process.env.APP_URL || 'http://localhost:3000',
  } : undefined,

  // Optional: hook for cleaning app data when a user is deleted
  hooks: {
    onBeforeUserDelete: (userId) => {
      db.prepare('DELETE FROM my_app_data WHERE user_id = ?').run(userId);
    },
  },
});

// Mount auth routes
app.use('/api/auth', auth.authRouter);
app.use('/api/users', auth.usersRouter);
app.use('/api/admin', auth.adminAuthRouter);

// Use middleware on your own routes
app.get('/api/stuff', auth.requireAuth, (req, res) => {
  res.json({ userId: req.user.id });
});

app.get('/api/admin-stuff', auth.requireAuth, auth.requireAdmin, (req, res) => {
  res.json({ admin: true });
});
```

### 3. Client integration

```tsx
import { AuthProvider, useAuth, LoginPage, UserManagementPanel } from './lib/auth-sso-kit/src/client/index.js';

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, loading, logout, isAdmin } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <LoginPage title="My App" subtitle="Internal Tool" />;

  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={logout}>Logout</button>
      {isAdmin && <UserManagementPanel />}
    </div>
  );
}
```

### 4. Add path mappings

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "paths": {
      "auth-sso-kit/*": ["./lib/auth-sso-kit/src/*"]
    }
  }
}
```

**esbuild.config.js:**
```js
alias: {
  'auth-sso-kit': './lib/auth-sso-kit/src',
}
```

## API Reference

### `setupAuth(app, config)`

| Config | Type | Required | Description |
|--------|------|----------|-------------|
| `db` | `AuthDB` | Yes | Database adapter instance |
| `session.secret` | `string` | Yes | Session secret |
| `session.maxAge` | `number` | No | Session duration in ms (default: 24h) |
| `session.secure` | `boolean` | No | Secure cookie flag (default: false) |
| `oidc` | `OIDCConfig` | No | OIDC configuration (omit for password-only) |
| `hooks.onBeforeUserDelete` | `(userId) => void` | No | Called before user deletion |
| `hooks.onUserCreated` | `(user) => void` | No | Called after user creation |
| `seedEmails` | `Array<{email, isAdmin?}>` | No | Initial allowlist emails |
| `middleware` | `{requireAuth, requireAdmin}` | No | Reuse existing middleware |

**Returns:** `{ requireAuth, requireAdmin, authRouter, usersRouter, adminAuthRouter }`

### LoginPage Props

| Prop | Default | Description |
|------|---------|-------------|
| `title` | `"Login"` | Main heading |
| `subtitle` | `""` | Subheading |
| `oidcButtonLabel` | `"Log in with SSO"` | OIDC button text |
| `emailPlaceholder` | `"your@email.com"` | Email input placeholder |
| `footerText` | `"Only pre-approved..."` | Footer message |

### UserManagementPanel Props

| Prop | Type | Description |
|------|------|-------------|
| `extraColumns` | `Array<{header, render}>` | Add app-specific columns to user table |

## DB Adapter

The kit ships with `SqliteAuthDB` for bun:sqlite. To use Postgres or another database, implement the `AuthDB` interface:

```ts
import type { AuthDB } from './lib/auth-sso-kit/src/server/db/interface.js';

class PostgresAuthDB implements AuthDB {
  findUserByEmail(email: string) { /* ... */ }
  findUserById(id: number) { /* ... */ }
  createUser(data) { /* ... */ }
  // ... implement all methods
}
```

## OIDC Environment Variables

When using OIDC mode:

| Variable | Description |
|----------|-------------|
| `OIDC_ISSUER_URL` | Identity provider URL (e.g., Authentik, Keycloak) |
| `OIDC_CLIENT_ID` | OAuth2 client ID |
| `OIDC_CLIENT_SECRET` | OAuth2 client secret |
| `APP_URL` | Your app's public URL (for callback) |
| `SESSION_SECRET` | Session encryption secret |

## Updating the Kit

```bash
cd your-app/
git submodule update --remote lib/auth-sso-kit
bun run dev  # test
git add lib/auth-sso-kit
git commit -m "update auth-sso-kit"
```

## Routes Mounted

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/config` | GET | Returns auth method (oidc/password) |
| `/api/auth/login` | POST | Password login |
| `/api/auth/oidc/login` | GET | Initiates OIDC flow |
| `/api/auth/oidc/callback` | GET | OIDC callback handler |
| `/api/auth/me` | GET | Current user |
| `/api/auth/logout` | POST | Destroy session |
| `/api/users` | GET | List all users |
| `/api/users/:id/admin` | PUT | Toggle admin status |
| `/api/users/:id` | DELETE | Delete user |
| `/api/admin/allowed-emails` | GET | List allowlist |
| `/api/admin/allowed-emails` | POST | Add to allowlist |
| `/api/admin/allowed-emails/:id` | DELETE | Remove from allowlist |
| `/api/admin/users/:id/reset-password` | PUT | Admin password reset |

## License

MIT
