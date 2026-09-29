import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DemoSession, UserRole } from '../types/index.ts';

const DEMO_SESSION_STORAGE_KEY = 'setuone_demo_session_v2';

interface LoginParams {
  role: UserRole;
  identifier: string;
  otp: string;
}

interface AuthContextValue {
  session: DemoSession | null;
  loading: boolean;
  accessDeniedNotice: string | null;
  setAccessDeniedNotice: (msg: string | null) => void;
  loginWithSimulatedCredentials: (params: LoginParams) => Promise<DemoSession>;
  activatePresenterScenario: (endpoint: string) => Promise<{ session: DemoSession; redirectTo: string; scenario: string }>;
  logout: () => Promise<void>;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<DemoSession | null>(() => {
    try {
      const raw = window.sessionStorage.getItem(DEMO_SESSION_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as DemoSession;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [accessDeniedNotice, setAccessDeniedNotice] = useState<string | null>(null);

  const persistSession = useCallback((nextSession: DemoSession | null) => {
    setSession(nextSession);
    try {
      if (nextSession) {
        window.sessionStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      } else {
        window.sessionStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors in restricted environments
    }
  }, []);

  useEffect(() => {
    // Sync across storage changes if needed
    const handleStorage = () => {
      try {
        const raw = window.sessionStorage.getItem(DEMO_SESSION_STORAGE_KEY);
        setSession(raw ? (JSON.parse(raw) as DemoSession) : null);
      } catch {
        setSession(null);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (!session) return { 'Content-Type': 'application/json' };
    return {
      'Content-Type': 'application/json',
      'x-demo-user-id': session.userId,
      'x-demo-role': session.role,
    };
  }, [session]);

  const loginWithSimulatedCredentials = useCallback(
    async ({ role, identifier, otp }: LoginParams): Promise<DemoSession> => {
      setLoading(true);
      setAccessDeniedNotice(null);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, identifier, otp }),
        });
        const data = await res.json();
        if (!res.ok || !data.session) {
          throw new Error(data.error || 'Simulated login failed');
        }
        persistSession(data.session);
        return data.session as DemoSession;
      } finally {
        setLoading(false);
      }
    },
    [persistSession]
  );

  const activatePresenterScenario = useCallback(
    async (endpoint: string): Promise<{ session: DemoSession; redirectTo: string; scenario: string }> => {
      setLoading(true);
      setAccessDeniedNotice(null);
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (!res.ok || !data.session) {
          throw new Error(data.error || 'Failed to activate presenter scenario');
        }
        persistSession(data.session);
        return data as { session: DemoSession; redirectTo: string; scenario: string };
      } finally {
        setLoading(false);
      }
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    setAccessDeniedNotice(null);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network error on logout
    }
    persistSession(null);
  }, [persistSession]);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        accessDeniedNotice,
        setAccessDeniedNotice,
        loginWithSimulatedCredentials,
        activatePresenterScenario,
        logout,
        getAuthHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}
