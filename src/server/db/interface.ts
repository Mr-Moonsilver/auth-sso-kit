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
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: number): Promise<AuthUser | null>;
  createUser(data: CreateUserData): Promise<AuthUser>;
  listUsers(): Promise<AuthUser[]>;
  updateUserAdmin(id: number, isAdmin: boolean): Promise<void>;
  deleteUser(id: number): Promise<void>;
  updateUserPassword(id: number, hash: string): Promise<void>;

  // Allowlist operations
  findAllowedEmail(email: string): Promise<AllowedEmailRecord | null>;
  listAllowedEmails(): Promise<AllowedEmailWithStatus[]>;
  addAllowedEmail(email: string, addedBy: number): Promise<{ id: number; email: string }>;
  removeAllowedEmail(id: number): Promise<{ email: string } | null>;

  // Settings
  getSetting(key: string): Promise<string | null>;
  setSetting(key: string, value: string): Promise<void>;

  // Schema
  initSchema(): Promise<void>;
}
