import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/auth';
import { setUnauthorizedHandler } from '../api/http';
import type { AuthResponse, RegisterInput, User } from '../types';
import { tokenStorage } from './tokenStorage';

interface AuthContextValue {
  user: User | null;
  /** True while a stored token is being checked on page load. */
  initializing: boolean;
  login: (identifier: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(() => tokenStorage.get() !== null);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
  }, []);

  // Restore the session from a stored token.
  useEffect(() => {
    if (!tokenStorage.get()) return;
    authApi
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => tokenStorage.clear())
      .finally(() => setInitializing(false));
  }, []);

  // Any 401 on an authenticated request means the session is over.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const startSession = useCallback((res: AuthResponse) => {
    tokenStorage.set(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const login = useCallback(
    async (identifier: string, password: string) =>
      startSession(await authApi.login(identifier, password)),
    [startSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => startSession(await authApi.register(input)),
    [startSession],
  );

  const value = useMemo(
    () => ({ user, initializing, login, register, logout }),
    [user, initializing, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
