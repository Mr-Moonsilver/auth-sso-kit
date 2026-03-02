import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api.js';
import type { User, AuthMethod, AuthConfig } from '../types.js';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authMethod: AuthMethod | null;
  registrationMode: 'open' | 'allowlist' | null;
  impersonatedBy: { id: number; name: string; email: string } | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithOIDC: () => void;
  logout: () => Promise<void>;
  stopImpersonating: () => Promise<void>;
  isAdmin: boolean;
  roles: string[];
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);
  const [registrationMode, setRegistrationMode] = useState<'open' | 'allowlist' | null>(null);

  useEffect(() => {
    Promise.all([
      authApi.getAuthConfig().catch(() => ({ method: 'password' as AuthMethod, registrationMode: 'open' as const })),
      authApi.getMe().catch(() => null),
    ]).then(([config, me]) => {
      const authConfig = config as AuthConfig;
      setAuthMethod(authConfig.method);
      setRegistrationMode(authConfig.registrationMode ?? null);
      setUser(me as User | null);
    }).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authApi.login(email, password) as User;
    setUser(data);
  };

  const loginWithOIDC = () => {
    window.location.href = '/api/auth/oidc/login';
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const stopImpersonating = async () => {
    await authApi.stopImpersonating();
    const me = await authApi.getMe().catch(() => null) as User | null;
    setUser(me);
  };

  const impersonatedBy = user?.impersonatedBy ?? null;
  const roles = user?.roles ?? [];
  const hasRole = (role: string) => roles.includes(role);
  const hasPermission = (permission: string) => (user?.permissions ?? []).includes(permission);

  return (
    <AuthContext.Provider value={{
      user, loading, authMethod, registrationMode, impersonatedBy, login, loginWithOIDC, logout, stopImpersonating,
      isAdmin: user?.isAdmin ?? false,
      roles,
      hasRole,
      hasPermission,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
