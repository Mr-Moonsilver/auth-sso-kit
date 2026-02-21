import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api.js';
import type { User, AuthMethod, AuthConfig } from '../types.js';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  authMethod: AuthMethod | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithOIDC: () => void;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);

  useEffect(() => {
    Promise.all([
      authApi.getAuthConfig().catch(() => ({ method: 'password' as AuthMethod })),
      authApi.getMe().catch(() => null),
    ]).then(([config, me]) => {
      setAuthMethod((config as AuthConfig).method);
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

  return (
    <AuthContext.Provider value={{
      user, loading, authMethod, login, loginWithOIDC, logout,
      isAdmin: user?.isAdmin ?? false,
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
