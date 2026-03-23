import React, { createContext, useContext, useState, ReactNode } from 'react';
import { UserRole } from '@/types/hr';

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  employeeId?: string;
}

interface AuthContextType {
  user: AuthUser;
  setRole: (role: UserRole) => void;
  hasAccess: (allowedRoles: UserRole[]) => boolean;
}

const roleUsers: Record<UserRole, AuthUser> = {
  super_admin: { id: 'u1', name: 'Admin User', email: 'admin@gluckglobal.com', role: 'super_admin' },
  hr_manager: { id: 'u2', name: 'Ashan Perera', email: 'ashan@gluckglobal.com', role: 'hr_manager', employeeId: '1' },
  reporting_manager: { id: 'u3', name: 'Ashan Perera', email: 'ashan@gluckglobal.com', role: 'reporting_manager', employeeId: '1' },
  employee: { id: 'u4', name: 'Dilini Fernando', email: 'dilini@gluckglobal.com', role: 'employee', employeeId: '2' },
  freelancer_intern: { id: 'u5', name: 'Rajan Nair', email: 'rajan@gluckglobal.com', role: 'freelancer_intern', employeeId: '3' },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('super_admin');

  const user = roleUsers[role];
  const setRole = (r: UserRole) => setRoleState(r);
  const hasAccess = (allowedRoles: UserRole[]) => allowedRoles.includes(role);

  return (
    <AuthContext.Provider value={{ user, setRole, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
