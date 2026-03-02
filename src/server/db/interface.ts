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
  findUserByEmail(email: string): AuthUser | null;
  findUserById(id: number): AuthUser | null;
  createUser(data: CreateUserData): AuthUser;
  listUsers(): AuthUser[];
  updateUserAdmin(id: number, isAdmin: boolean): void;
  deleteUser(id: number): void;
  updateUserPassword(id: number, hash: string): void;

  // Allowlist operations
  findAllowedEmail(email: string): AllowedEmailRecord | null;
  listAllowedEmails(): AllowedEmailWithStatus[];
  addAllowedEmail(email: string, addedBy: number): { id: number; email: string };
  removeAllowedEmail(id: number): { email: string } | null;

  // Settings
  getSetting(key: string): string | null;
  setSetting(key: string, value: string): void;

  // Schema
  initSchema(): void;

  // Roles
  createRole(name: string, description: string): Role;
  listRoles(): Role[];
  getRole(id: number): Role | null;
  updateRole(id: number, name: string, description: string): void;
  deleteRole(id: number): void;
  getUserRoles(userId: number): string[];
  setUserRoles(userId: number, roleIds: number[]): void;
  getRolePermissions(roleId: number): Permission[];
  setRolePermissions(roleId: number, permissions: { key: string; enabled: boolean }[]): void;
  getUserPermissions(userId: number): string[];
  seedRoles(definitions: string[], seeds: RoleSeed[]): void;
}
