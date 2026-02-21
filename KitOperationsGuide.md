# auth-sso-kit: Operations Guide

## 1. Push the kit to GitHub

```bash
cd ~/SynologyDrive/Dev\ Git/auth-sso-kit

# Create the repo on GitHub first (via github.com or gh cli)
gh repo create Mr-Moonsilver/auth-sso-kit --private --source=. --push
```

Then update RCAJO's submodule to point to GitHub instead of the local path:

```bash
cd ~/SynologyDrive/Dev\ Git/RCAJO\ App

# Edit .gitmodules — change the url to the GitHub remote
git config --file .gitmodules submodule.lib/auth-sso-kit.url https://github.com/Mr-Moonsilver/auth-sso-kit.git
git submodule sync
git add .gitmodules
git commit -m "point auth-sso-kit submodule to GitHub remote"
```

## 2. Example: Day-to-day git workflow for RCAJO

**Clone RCAJO (fresh machine or colleague):**
```bash
git clone --recurse-submodules https://github.com/Mr-Moonsilver/RCAJO-App.git
cd RCAJO-App
bun install
```

If you forgot `--recurse-submodules`:
```bash
git submodule init
git submodule update
```

**Pull latest RCAJO (includes kit at pinned version):**
```bash
git pull
git submodule update
```

**Update the kit to latest in RCAJO:**
```bash
cd lib/auth-sso-kit
git pull origin main
cd ../..
git add lib/auth-sso-kit
git commit -m "update auth-sso-kit to latest"
```

This is intentional — the kit version is pinned per commit. RCAJO only gets kit updates when you explicitly pull and commit them. No surprises.

## 3. Using the kit in a new app

```bash
# In your new app
git submodule add https://github.com/Mr-Moonsilver/auth-sso-kit.git lib/auth-sso-kit

# Add path mapping to tsconfig.json
# "auth-sso-kit/*": ["./lib/auth-sso-kit/src/*"]

# Add alias to esbuild (or vite/webpack equivalent)
# alias: { 'auth-sso-kit': './lib/auth-sso-kit/src' }

# Install peer deps
bun add express express-session openid-client react react-dom
```

Then follow the kit's README for server and client integration. The RCAJO app serves as a real-world reference implementation.

## 4. What lives in the kit vs. the app

### Kit develops and owns:
- Login flow (OIDC + password, session management)
- Email allowlist (who can register)
- User CRUD (create on first login, delete, toggle admin)
- Password reset (admin-initiated)
- `AuthProvider` / `useAuth()` context
- `LoginPage` component (configurable via props)
- `UserManagementPanel` component (extensible via `extraColumns`)
- `AuthDB` interface + SQLite adapter
- Auth API client (`authApi`)

### Each app develops on its own:
- App-specific user data (RCAJO has linkCount, criticalityCount, vrioCount)
- App-specific admin features (RCAJO has phase toggles)
- Branding/styling (pass title, subtitle, buttonLabel via props)
- Data cleanup hooks (`onBeforeUserDelete` to clean app tables)
- Extra columns in the user management table via `extraColumns` prop
- Role-based visibility (kit gives you `isAdmin`, app decides what that means)
- Any authorization beyond "is logged in" and "is admin"

### Rule of thumb:
If it's about *who you are* and *proving it* — kit.
If it's about *what you can do in this specific app* — app.

## 5. Kit development workflow

When you improve the kit (e.g., add a feature, fix a bug):

```bash
# Work in the kit repo directly
cd ~/SynologyDrive/Dev\ Git/auth-sso-kit
# make changes, test with the example app
bun run --cwd examples/basic-app dev
# commit + push
git add -A && git commit -m "add feature X" && git push

# Then pull into each app that uses it
cd ~/SynologyDrive/Dev\ Git/RCAJO\ App
cd lib/auth-sso-kit && git pull origin main && cd ../..
git add lib/auth-sso-kit
git commit -m "update auth-sso-kit: feature X"
```

You can also develop the kit from within an app (changes in `lib/auth-sso-kit/` are a real git repo), but pushing from the kit's own folder is cleaner.

## 6. Current RCAJO integration points

These are the files in RCAJO that wire into the kit:

| File | Purpose |
|------|---------|
| `src/server/middleware/auth.ts` | Bridge — creates `SqliteAuthDB`, exports `requireAuth`/`requireAdmin` |
| `src/server/index.ts` | Calls `setupAuth()`, mounts kit routers, passes cleanup hook |
| `src/server/routes/admin.ts` | RCAJO-only: toggles + `/user-stats` endpoint |
| `src/client/context/AuthContext.tsx` | Re-exports `AuthProvider`/`useAuth` from kit |
| `src/client/pages/LoginPage.tsx` | Wraps kit's `LoginPage` with RCAJO branding |
| `src/client/pages/AdminPage.tsx` | Phase toggles + kit's `UserManagementPanel` with extra columns |
| `src/client/types/index.ts` | Re-exports `User`, `AllowedEmail`, etc. from kit |
| `tsconfig.json` | Path mapping for `auth-sso-kit/*` |
| `esbuild.config.js` | Alias for client-side bundling |

## 7. Kit documentation for other developers

The kit includes:
- **README.md** — full integration guide (server + client + DB adapter + OIDC setup + route table)
- **examples/basic-app/** — working minimal app (~25 lines server, ~20 lines client) that demonstrates the integration pattern
- **TypeScript types** — all interfaces are typed (`AuthDB`, `AuthKitConfig`, `LoginPageProps`, `UserManagementPanelProps`)

The README covers: submodule setup, server integration, client integration, path mappings, API reference, component props, DB adapter pattern, OIDC env vars, update workflow, and full route table.
