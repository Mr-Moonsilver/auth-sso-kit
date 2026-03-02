export interface AuthUser {
  id: number;
  name: string;
  email: string;
  initials: string;
  isAdmin: boolean;
  createdAt?: string;
  passwordHash?: string | null;
}

export interface CreateUserData {
  name: string;
  email: string;
  initials: string;
  isAdmin: boolean;
  passwordHash?: string | null;
}

export interface AllowedEmailRecord {
  id: number;
  email: string;
  isAdmin: boolean;
}

export interface AllowedEmailWithStatus {
  id: number;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  userId: number | null;
  userName: string | null;
}

export interface Role {
  id: number;
  name: string;
  description: string | null;
}

export interface Permission {
  id: number;
  permission_key: string;
  enabled: boolean;
}

export interface RoleSeed {
  role: string;
  permissions: string[];
}

export interface AuthDB {
  // User operations
  findUserByEmail(email: string): AuthUser | null | Promise<AuthUser | null>;
  findUserById(id: number): AuthUser | null | Promise<AuthUser | null>;
  createUser(data: CreateUserData): AuthUser | Promise<AuthUser>;
  listUsers(): AuthUser[] | Promise<AuthUser[]>;
  updateUserAdmin(id: number, isAdmin: boolean): void | Promise<void>;
  deleteUser(id: number): void | Promise<void>;
  updateUserPassword(id: number, hash: string): void | Promise<void>;

  // Allowlist operations
  findAllowedEmail(email: string): AllowedEmailRecord | null | Promise<AllowedEmailRecord | null>;
  listAllowedEmails(): AllowedEmailWithStatus[] | Promise<AllowedEmailWithStatus[]>;
  addAllowedEmail(email: string, addedBy: number): { id: number; email: string } | Promise<{ id: number; email: string }>;
  removeAllowedEmail(id: number): { email: string } | null | Promise<{ email: string } | null>;

  // Settings
  getSetting(key: string): string | null | Promise<string | null>;
  setSetting(key: string, value: string): void | Promise<void>;

  // Schema
  initSchema(): void | Promise<void>;

  // Roles
  createRole(name: string, description: string): Role | Promise<Role>;
  listRoles(): Role[] | Promise<Role[]>;
  getRole(id: number): Role | null | Promise<Role | null>;
  updateRole(id: number, name: string, description: string): void | Promise<void>;
  deleteRole(id: number): void | Promise<void>;
  getUserRoles(userId: number): string[] | Promise<string[]>;
  setUserRoles(userId: number, roleIds: number[]): void | Promise<void>;
  getRolePermissions(roleId: number): Permission[] | Promise<Permission[]>;
  setRolePermissions(roleId: number, permissions: { key: string; enabled: boolean }[]): void | Promise<void>;
  getUserPermissions(userId: number): string[] | Promise<string[]>;
  seedRoles(definitions: string[], seeds: RoleSeed[]): void | Promise<void>;
}
