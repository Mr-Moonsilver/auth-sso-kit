export interface User {
  id: number;
  name: string;
  email: string;
  initials: string;
  isAdmin: boolean;
  roles?: string[];
  permissions?: string[];
  impersonatedBy?: {
    id: number;
    name: string;
    email: string;
  };
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
  registrationMode: 'open' | 'allowlist';
}
