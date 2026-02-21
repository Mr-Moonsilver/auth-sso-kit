export interface User {
  id: number;
  name: string;
  email: string;
  initials: string;
  isAdmin: boolean;
}

export interface AllowedEmail {
  id: number;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  userId: number | null;
  userName: string | null;
}

export type AuthMethod = 'oidc' | 'password';

export interface AuthConfig {
  method: AuthMethod;
}
