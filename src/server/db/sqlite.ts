import { Database } from 'bun:sqlite';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AuthDB, AuthUser, CreateUserData, AllowedEmailRecord, AllowedEmailWithStatus, Role, Permission, RoleSeed } from './interface.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class SqliteAuthDB implements AuthDB {
  private defaultRegistrationMode: string = 'open';

  constructor(private db: Database, options?: { defaultRegistrationMode?: 'open' | 'allowlist' }) {
    if (options?.defaultRegistrationMode) {
      this.defaultRegistrationMode = options.defaultRegistrationMode;
    }
  }

  initSchema(): void {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);

    // Migrations for existing databases
    try { this.db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch { /* column exists */ }
    try { this.db.exec('ALTER TABLE users ADD COLUMN password_hash TEXT'); } catch { /* column exists */ }
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');

    // Seed default registration mode
    this.db.prepare(
      'INSERT OR IGNORE INTO auth_settings (key, value) VALUES (?, ?)'
    ).run('registration_mode', this.defaultRegistrationMode);
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare(
      'SELECT value FROM auth_settings WHERE key = ?'
    ).get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare(
      'INSERT OR REPLACE INTO auth_settings (key, value) VALUES (?, ?)'
    ).run(key, value);
  }

  findUserByEmail(email: string): AuthUser | null {
    const row = this.db.prepare(
      'SELECT id, name, email, password_hash, initials, is_admin as isAdmin FROM users WHERE email = ? COLLATE NOCASE'
    ).get(email) as any | undefined;

    if (!row) return null;
    return { ...row, isAdmin: Boolean(row.isAdmin), passwordHash: row.password_hash };
  }

  findUserById(id: number): AuthUser | null {
    const row = this.db.prepare(
      'SELECT id, name, email, initials, is_admin as isAdmin FROM users WHERE id = ?'
    ).get(id) as any | undefined;

    if (!row) return null;
    return { ...row, isAdmin: Boolean(row.isAdmin) };
  }

  createUser(data: CreateUserData): AuthUser {
    const result = this.db.prepare(
      'INSERT INTO users (name, email, password_hash, initials, is_admin) VALUES (?, ?, ?, ?, ?)'
    ).run(data.name, data.email, data.passwordHash ?? null, data.initials, data.isAdmin ? 1 : 0);

    return {
      id: result.lastInsertRowid as number,
      name: data.name,
      email: data.email,
      initials: data.initials,
      isAdmin: data.isAdmin,
    };
  }

  listUsers(): AuthUser[] {
    const rows = this.db.prepare(
      'SELECT id, name, email, initials, is_admin as isAdmin, created_at as createdAt FROM users ORDER BY name'
    ).all() as any[];

    return rows.map((u) => ({ ...u, isAdmin: Boolean(u.isAdmin) }));
  }

  updateUserAdmin(id: number, isAdmin: boolean): void {
    this.db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(isAdmin ? 1 : 0, id);
  }

  deleteUser(id: number): void {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
  }

  updateUserPassword(id: number, hash: string): void {
    this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
  }

  findAllowedEmail(email: string): AllowedEmailRecord | null {
    const row = this.db.prepare(
      'SELECT id, email, is_admin as isAdmin FROM allowed_emails WHERE email = ? COLLATE NOCASE'
    ).get(email) as any | undefined;

    if (!row) return null;
    return { ...row, isAdmin: Boolean(row.isAdmin) };
  }

  listAllowedEmails(): AllowedEmailWithStatus[] {
    const rows = this.db.prepare(`
      SELECT ae.id, ae.email, ae.is_admin as isAdmin, ae.created_at as createdAt,
             u.id as userId, u.name as userName
      FROM allowed_emails ae
      LEFT JOIN users u ON LOWER(u.email) = LOWER(ae.email)
      ORDER BY ae.email
    `).all() as any[];

    return rows.map((e) => ({ ...e, isAdmin: Boolean(e.isAdmin) }));
  }

  addAllowedEmail(email: string, addedBy: number): { id: number; email: string } {
    const normalized = email.trim().toLowerCase();

    const existing = this.db.prepare(
      'SELECT id FROM allowed_emails WHERE email = ? COLLATE NOCASE'
    ).get(normalized);

    if (existing) return { id: (existing as any).id, email: normalized };

    const result = this.db.prepare(
      'INSERT INTO allowed_emails (email, added_by) VALUES (?, ?)'
    ).run(normalized, addedBy || null);

    return { id: result.lastInsertRowid as number, email: normalized };
  }

  removeAllowedEmail(id: number): { email: string } | null {
    const entry = this.db.prepare(
      'SELECT email FROM allowed_emails WHERE id = ?'
    ).get(id) as { email: string } | undefined;

    if (!entry) return null;

    this.db.prepare('DELETE FROM allowed_emails WHERE id = ?').run(id);
    return entry;
  }

  createRole(name: string, description: string): Role {
    const result = this.db.prepare(
      'INSERT INTO roles (name, description) VALUES (?, ?)'
    ).run(name, description);
    return { id: result.lastInsertRowid as number, name, description };
  }

  listRoles(): Role[] {
    return this.db.prepare('SELECT id, name, description FROM roles ORDER BY name').all() as Role[];
  }

  getRole(id: number): Role | null {
    const row = this.db.prepare('SELECT id, name, description FROM roles WHERE id = ?').get(id) as Role | undefined;
    return row ?? null;
  }

  updateRole(id: number, name: string, description: string): void {
    this.db.prepare('UPDATE roles SET name = ?, description = ? WHERE id = ?').run(name, description, id);
  }

  deleteRole(id: number): void {
    this.db.prepare('DELETE FROM roles WHERE id = ?').run(id);
  }

  getUserRoles(userId: number): string[] {
    const rows = this.db.prepare(
      'SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ?'
    ).all(userId) as { name: string }[];
    return rows.map((r) => r.name);
  }

  setUserRoles(userId: number, roleIds: number[]): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(userId);
      const insert = this.db.prepare('INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)');
      for (const roleId of roleIds) {
        insert.run(userId, roleId);
      }
    });
    tx();
  }

  getRolePermissions(roleId: number): Permission[] {
    const rows = this.db.prepare(
      'SELECT id, permission_key, enabled FROM permissions WHERE role_id = ?'
    ).all(roleId) as any[];
    return rows.map((r) => ({ ...r, enabled: Boolean(r.enabled) }));
  }

  setRolePermissions(roleId: number, permissions: { key: string; enabled: boolean }[]): void {
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM permissions WHERE role_id = ?').run(roleId);
      const insert = this.db.prepare(
        'INSERT INTO permissions (role_id, permission_key, enabled) VALUES (?, ?, ?)'
      );
      for (const p of permissions) {
        insert.run(roleId, p.key, p.enabled ? 1 : 0);
      }
    });
    tx();
  }

  getUserPermissions(userId: number): string[] {
    const rows = this.db.prepare(`
      SELECT DISTINCT p.permission_key
      FROM user_roles ur
      JOIN permissions p ON p.role_id = ur.role_id
      WHERE ur.user_id = ? AND p.enabled = 1
    `).all(userId) as { permission_key: string }[];
    return rows.map((r) => r.permission_key);
  }

  seedRoles(definitions: string[], seeds: RoleSeed[]): void {
    const tx = this.db.transaction(() => {
      const insertRole = this.db.prepare('INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)');
      for (const def of definitions) {
        insertRole.run(def, '');
      }

      for (const seed of seeds) {
        const role = this.db.prepare('SELECT id FROM roles WHERE name = ?').get(seed.role) as { id: number } | undefined;
        if (!role) continue;

        const insertPerm = this.db.prepare(
          'INSERT OR REPLACE INTO permissions (role_id, permission_key, enabled) VALUES (?, ?, 1)'
        );
        for (const perm of seed.permissions) {
          insertPerm.run(role.id, perm);
        }
      }
    });
    tx();
  }
}
