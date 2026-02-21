import express from 'express';
import cors from 'cors';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { setupAuth, SqliteAuthDB } from 'auth-sso-kit/server/index.js';

// Ensure data directory
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const db = new Database(join(dataDir, 'example.db'));
db.exec('PRAGMA foreign_keys = ON');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Setup auth — one call does everything
const auth = setupAuth(app, {
  db: new SqliteAuthDB(db),
  session: {
    secret: process.env.SESSION_SECRET || 'example-secret-change-in-production',
  },
  oidc: process.env.OIDC_ISSUER_URL ? {
    issuerUrl: process.env.OIDC_ISSUER_URL,
    clientId: process.env.OIDC_CLIENT_ID!,
    clientSecret: process.env.OIDC_CLIENT_SECRET!,
    appUrl: process.env.APP_URL || `http://localhost:${PORT}`,
  } : undefined,
  seedEmails: [
    { email: 'admin@example.com', isAdmin: true },
  ],
});

// Mount auth routes
app.use('/api/auth', auth.authRouter);
app.use('/api/users', auth.usersRouter);
app.use('/api/admin', auth.adminAuthRouter);

// Example protected route
app.get('/api/hello', auth.requireAuth, (req: any, res) => {
  res.json({ message: `Hello ${req.user.name}!` });
});

// Serve static files
const publicPath = join(process.cwd(), 'public');
app.use(express.static(publicPath));

app.get('*', (req, res) => {
  res.sendFile(join(publicPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Example app running at http://localhost:${PORT}`);
  console.log('Seed email: admin@example.com (set any password on first login)');
});
