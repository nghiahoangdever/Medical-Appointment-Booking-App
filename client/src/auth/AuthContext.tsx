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
  /**
   * Error code explaining why the session ended on its own (INVALID_TOKEN when it expired,
   * ACCOUNT_DISABLED when the account was deactivated), shown on the login page. Null after a
   * normal logout or a new login.
   */
  sessionEndedReason: string | null;
  login: (identifier: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(() => tokenStorage.get() !== null);
  const [sessionEndedReason, setSessionEndedReason] = useState<string | null>(null);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    setSessionEndedReason(null);
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

  // A 401 or ACCOUNT_DISABLED on an authenticated request means the session is over.
  useEffect(() => {
    setUnauthorizedHandler((code) => {
      tokenStorage.clear();
      setUser(null);
      setSessionEndedReason(code);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const startSession = useCallback((res: AuthResponse) => {
    tokenStorage.set(res.token);
    setUser(res.user);
    setSessionEndedReason(null);
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
    () => ({ user, initializing, sessionEndedReason, login, register, logout }),
    [user, initializing, sessionEndedReason, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
