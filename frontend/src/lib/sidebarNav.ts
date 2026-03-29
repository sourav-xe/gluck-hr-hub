import type { UserRole } from '@/types/hr';

/** Stable keys for sidebar items — must match backend `ALLOWED_SIDEBAR_NAV_KEYS`. */
export type SidebarNavKey =
  | 'dashboard'
  | 'employees'
  | 'my-profile'
  | 'attendance'
  | 'my-attendance'
  | 'leaves'
  | 'regularization'
  | 'my-documents'
  | 'payroll'
  | 'documents'
  | 'auto-docs'
  | 'automations'
  | 'announcements'
  | 'settings';

export interface SidebarNavDefinition {
  navKey: SidebarNavKey;
  title: string;
  url: string;
  roles: UserRole[];
}

/** Single source of truth for routes + role access (icons are mapped in AppLayout). */
export const SIDEBAR_NAV_DEFINITIONS: SidebarNavDefinition[] = [
  { navKey: 'dashboard', title: 'Dashboard', url: '/', roles: ['super_admin', 'hr_manager', 'reporting_manager', 'employee', 'freelancer_intern'] },
  { navKey: 'employees', title: 'Employees', url: '/employees', roles: ['super_admin', 'hr_manager', 'reporting_manager'] },
  { navKey: 'my-profile', title: 'My Profile', url: '/my-profile', roles: ['reporting_manager', 'employee', 'freelancer_intern'] },
  { navKey: 'attendance', title: 'Attendance', url: '/attendance', roles: ['super_admin', 'hr_manager', 'reporting_manager'] },
  { navKey: 'my-attendance', title: 'My Attendance', url: '/my-attendance', roles: ['employee', 'freelancer_intern'] },
  { navKey: 'leaves', title: 'Leave Mgmt', url: '/leaves', roles: ['super_admin', 'hr_manager', 'reporting_manager', 'employee'] },
  { navKey: 'regularization', title: 'Regularization', url: '/regularization', roles: ['super_admin', 'hr_manager', 'reporting_manager', 'employee', 'freelancer_intern'] },
  { navKey: 'my-documents', title: 'My Documents', url: '/my-documents', roles: ['reporting_manager', 'employee', 'freelancer_intern'] },
  { navKey: 'payroll', title: 'Payroll', url: '/payroll', roles: ['super_admin', 'hr_manager'] },
  { navKey: 'documents', title: 'Documents', url: '/documents', roles: ['super_admin', 'hr_manager'] },
  { navKey: 'auto-docs', title: 'Auto-Docs', url: '/documents/templates', roles: ['super_admin', 'hr_manager'] },
  { navKey: 'automations', title: 'Automations', url: '/automations', roles: ['super_admin', 'hr_manager'] },
  { navKey: 'announcements', title: 'Announcements', url: '/announcements', roles: ['super_admin'] },
  { navKey: 'settings', title: 'Settings', url: '/settings', roles: ['super_admin'] },
];

export function navKeysAllowedForRole(role: UserRole): SidebarNavKey[] {
  return SIDEBAR_NAV_DEFINITIONS.filter((d) => d.roles.includes(role)).map((d) => d.navKey);
}
