import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/hr';
import type { User, Session } from '@supabase/supabase-js';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  authUser?: User;
}

interface AuthContextType {
  user: AuthUser;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setRole: (role: UserRole) => void;
  hasAccess: (allowedRoles: UserRole[]) => boolean;
  signOut: () => Promise<void>;
}

// Demo role users for when no real auth
const roleUsers: Record<UserRole, AuthUser> = {
  super_admin: { id: 'u1', name: 'Admin User', email: 'admin@gluckglobal.com', role: 'super_admin' },
  hr_manager: { id: 'u2', name: 'Ashan Perera', email: 'ashan@gluckglobal.com', role: 'hr_manager', employeeId: '1' },
  reporting_manager: { id: 'u3', name: 'Ashan Perera', email: 'ashan@gluckglobal.com', role: 'reporting_manager', employeeId: '1' },
  employee: { id: 'u4', name: 'Dilini Fernando', email: 'dilini@gluckglobal.com', role: 'employee', employeeId: '2' },
  freelancer_intern: { id: 'u5', name: 'Rajan Nair', email: 'rajan@gluckglobal.com', role: 'freelancer_intern', employeeId: '3' },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRoleState] = useState<UserRole>('super_admin');
  const [authUserData, setAuthUserData] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        // Use user metadata for profile info
        const meta = session.user.user_metadata;
        setAuthUserData({
          id: session.user.id,
          name: meta?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: (meta?.app_role as UserRole) || 'employee',
          employeeId: meta?.employee_id,
          authUser: session.user,
        });
      } else {
        setAuthUserData(null);
      }
      setIsLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const meta = session.user.user_metadata;
        setAuthUserData({
          id: session.user.id,
          name: meta?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          role: (meta?.app_role as UserRole) || 'employee',
          employeeId: meta?.employee_id,
          authUser: session.user,
        });
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const isAuthenticated = !!session;

  // If authenticated, use real user data; otherwise use demo role
  const user = authUserData || roleUsers[role];

  const setRole = (r: UserRole) => {
    setRoleState(r);
    // If authenticated, also update user_metadata role for demo switching
    if (authUserData) {
      setAuthUserData(prev => prev ? { ...prev, role: r } : prev);
    }
  };

  const hasAccess = (allowedRoles: UserRole[]) => allowedRoles.includes(user.role);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthUserData(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, isAuthenticated, isLoading, setRole, hasAccess, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
