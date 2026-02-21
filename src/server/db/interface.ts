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
}
