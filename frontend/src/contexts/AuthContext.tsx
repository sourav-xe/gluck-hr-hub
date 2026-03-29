import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserRole } from '@/types/hr';
import type { SidebarNavKey } from '@/lib/sidebarNav';
import { apiFetch, clearStoredAuth, loadStoredAuth, saveStoredAuth, type StoredAuth } from '@/lib/api';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  employeeCode?: string;
  onboardingComplete?: boolean | null;
  needsOnboarding?: boolean;
  /** Super Admin–defined subset; when set, sidebar only shows these keys (plus role rules). */
  sidebarNavAllow?: string[];
}

interface AuthContextType {
  user: AuthUser;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsOnboarding: boolean;
  hasAccess: (allowedRoles: UserRole[]) => boolean;
  navItemVisible: (navKey: SidebarNavKey) => boolean;
  signOut: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapApiUser(u: StoredAuth['user']): AuthUser {
  const raw = u as Record<string, unknown>;
  const sn = raw.sidebarNavAllow;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (u.role as UserRole) || 'employee',
    employeeId: u.employeeId,
    employeeCode: typeof raw.employeeCode === 'string' ? raw.employeeCode : undefined,
    onboardingComplete: raw.onboardingComplete as boolean | null | undefined,
    needsOnboarding: raw.needsOnboarding as boolean | undefined,
    sidebarNavAllow: Array.isArray(sn) ? (sn as string[]) : undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authUserData, setAuthUserData] = useState<AuthUser | null>(null);

  const fetchAndSetMe = async (storedToken: string) => {
    const res = await apiFetch('/api/auth/me');
    if (res.status === 401) {
      clearStoredAuth();
      setToken(null);
      setAuthUserData(null);
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    const u = data.user as StoredAuth['user'];
    if (u) {
      const next = { token: storedToken, user: u };
      saveStoredAuth(next);
      setAuthUserData(mapApiUser(u));
    }
  };

  useEffect(() => {
    const stored = loadStoredAuth();
    if (!stored?.token) {
      setToken(null);
      setAuthUserData(null);
      setIsLoading(false);
      return;
    }

    setToken(stored.token);
    setAuthUserData(mapApiUser(stored.user));

    fetchAndSetMe(stored.token)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const isAuthenticated = !!token && !!authUserData;

  const user = authUserData ?? {
    id: '',
    name: '',
    email: '',
    role: 'employee' as UserRole,
  };

  // Prefer server flag, but keep a strict fallback for self-service roles.
  const role = String(user.role || '').toLowerCase();
  const selfServiceRole = role === 'employee' || role === 'freelancer_intern' || role === 'reporting_manager';
  const needsOnboarding =
    isAuthenticated &&
    (Boolean((user as AuthUser).needsOnboarding) || (selfServiceRole && user.onboardingComplete !== true));

  const hasAccess = (allowedRoles: UserRole[]) =>
    isAuthenticated && allowedRoles.includes(user.role);

  const navItemVisible = useCallback(
    (navKey: SidebarNavKey) => {
      if (!isAuthenticated) return false;
      if (user.role === 'super_admin') return true;
      const allow = user.sidebarNavAllow;
      if (!allow?.length) return true;
      return allow.includes(navKey);
    },
    [isAuthenticated, user.role, user.sidebarNavAllow]
  );

  const signOut = async () => {
    clearStoredAuth();
    setToken(null);
    setAuthUserData(null);
  };

  const refreshAuth = async () => {
    const stored = loadStoredAuth();
    if (stored?.token) {
      await fetchAndSetMe(stored.token).catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, needsOnboarding, hasAccess, navItemVisible, signOut, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
