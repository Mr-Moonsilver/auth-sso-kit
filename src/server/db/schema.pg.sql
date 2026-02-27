-- Users (email-based authentication)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT,
    initials TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email allowlist (admin-managed, controls who can log in)
CREATE TABLE IF NOT EXISTS allowed_emails (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    added_by INTEGER REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (key-value store for runtime configuration)
CREATE TABLE IF NOT EXISTS auth_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_allowed_emails_email_lower ON allowed_emails (LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
