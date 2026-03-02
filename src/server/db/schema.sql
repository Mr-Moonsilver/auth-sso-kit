-- Users (email-based authentication)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT,
    initials TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Email allowlist (admin-managed, controls who can log in)
CREATE TABLE IF NOT EXISTS allowed_emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    is_admin INTEGER DEFAULT 0,
    added_by INTEGER REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Settings (key-value store for runtime configuration)
CREATE TABLE IF NOT EXISTS auth_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_allowed_emails_email ON allowed_emails(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT
);

-- User-Role assignments
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- Role permissions
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_key TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    UNIQUE(role_id, permission_key)
);
