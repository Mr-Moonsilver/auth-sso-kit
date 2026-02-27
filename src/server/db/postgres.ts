import type { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AuthDB, AuthUser, CreateUserData, AllowedEmailRecord, AllowedEmailWithStatus } from './interface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class PostgresAuthDB implements AuthDB {
  private defaultRegistrationMode: string = 'open';

  constructor(private pool: Pool, options?: { defaultRegistrationMode?: 'open' | 'allowlist' }) {
    if (options?.defaultRegistrationMode) {
      this.defaultRegistrationMode = options.defaultRegistrationMode;
    }
  }

  async initSchema(): Promise<void> {
    const schemaPath = join(__dirname, 'schema.pg.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    await this.pool.query(schema);

    // Seed default registration mode
    await this.pool.query(
      'INSERT INTO auth_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      ['registration_mode', this.defaultRegistrationMode]
    );
  }

  async getSetting(key: string): Promise<string | null> {
    const { rows } = await this.pool.query(
      'SELECT value FROM auth_settings WHERE key = $1',
      [key]
    );
    return rows[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO auth_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, value]
    );
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const { rows } = await this.pool.query(
      'SELECT id, name, email, password_hash, initials, is_admin FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (rows.length === 0) return null;
    const row = rows[0];
    return { id: row.id, name: row.name, email: row.email, initials: row.initials, isAdmin: row.is_admin, passwordHash: row.password_hash };
  }

  async findUserById(id: number): Promise<AuthUser | null> {
    const { rows } = await this.pool.query(
      'SELECT id, name, email, initials, is_admin FROM users WHERE id = $1',
      [id]
    );

    if (rows.length === 0) return null;
    const row = rows[0];
    return { id: row.id, name: row.name, email: row.email, initials: row.initials, isAdmin: row.is_admin };
  }

  async createUser(data: CreateUserData): Promise<AuthUser> {
    const { rows } = await this.pool.query(
      'INSERT INTO users (name, email, password_hash, initials, is_admin) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [data.name, data.email, data.passwordHash ?? null, data.initials, data.isAdmin]
    );

    return {
      id: rows[0].id,
      name: data.name,
      email: data.email,
      initials: data.initials,
      isAdmin: data.isAdmin,
    };
  }

  async listUsers(): Promise<AuthUser[]> {
    const { rows } = await this.pool.query(
      'SELECT id, name, email, initials, is_admin, created_at FROM users ORDER BY name'
    );

    return rows.map((u) => ({ id: u.id, name: u.name, email: u.email, initials: u.initials, isAdmin: u.is_admin, createdAt: u.created_at }));
  }

  async updateUserAdmin(id: number, isAdmin: boolean): Promise<void> {
    await this.pool.query('UPDATE users SET is_admin = $1 WHERE id = $2', [isAdmin, id]);
  }

  async deleteUser(id: number): Promise<void> {
    await this.pool.query('DELETE FROM users WHERE id = $1', [id]);
  }

  async updateUserPassword(id: number, hash: string): Promise<void> {
    await this.pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
  }

  async findAllowedEmail(email: string): Promise<AllowedEmailRecord | null> {
    const { rows } = await this.pool.query(
      'SELECT id, email, is_admin FROM allowed_emails WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (rows.length === 0) return null;
    const row = rows[0];
    return { id: row.id, email: row.email, isAdmin: row.is_admin };
  }

  async listAllowedEmails(): Promise<AllowedEmailWithStatus[]> {
    const { rows } = await this.pool.query(`
      SELECT ae.id, ae.email, ae.is_admin, ae.created_at,
             u.id as user_id, u.name as user_name
      FROM allowed_emails ae
      LEFT JOIN users u ON LOWER(u.email) = LOWER(ae.email)
      ORDER BY ae.email
    `);

    return rows.map((e) => ({
      id: e.id,
      email: e.email,
      isAdmin: e.is_admin,
      createdAt: e.created_at,
      userId: e.user_id,
      userName: e.user_name,
    }));
  }

  async addAllowedEmail(email: string, addedBy: number): Promise<{ id: number; email: string }> {
    const normalized = email.trim().toLowerCase();

    const { rows: existing } = await this.pool.query(
      'SELECT id FROM allowed_emails WHERE LOWER(email) = LOWER($1)',
      [normalized]
    );

    if (existing.length > 0) return { id: existing[0].id, email: normalized };

    const { rows } = await this.pool.query(
      'INSERT INTO allowed_emails (email, added_by) VALUES ($1, $2) RETURNING id',
      [normalized, addedBy || null]
    );

    return { id: rows[0].id, email: normalized };
  }

  async removeAllowedEmail(id: number): Promise<{ email: string } | null> {
    const { rows } = await this.pool.query(
      'DELETE FROM allowed_emails WHERE id = $1 RETURNING email',
      [id]
    );

    if (rows.length === 0) return null;
    return { email: rows[0].email };
  }
}
