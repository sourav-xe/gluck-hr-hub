import { useState } from 'react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/hr';
import {
  LayoutDashboard, Users, CalendarCheck, CalendarOff, DollarSign,
  FileText, Zap, Settings, ChevronLeft, ChevronRight, Menu, X
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, roles: ['super_admin', 'hr_manager', 'reporting_manager', 'employee', 'freelancer_intern'] as UserRole[] },
  { title: 'Employees', url: '/employees', icon: Users, roles: ['super_admin', 'hr_manager', 'reporting_manager'] as UserRole[] },
  { title: 'Attendance', url: '/attendance', icon: CalendarCheck, roles: ['super_admin', 'hr_manager', 'reporting_manager'] as UserRole[] },
  { title: 'My Attendance', url: '/my-attendance', icon: CalendarCheck, roles: ['employee', 'freelancer_intern'] as UserRole[] },
  { title: 'Leave Management', url: '/leaves', icon: CalendarOff, roles: ['super_admin', 'hr_manager', 'reporting_manager', 'employee'] as UserRole[] },
  { title: 'Payroll', url: '/payroll', icon: DollarSign, roles: ['super_admin', 'hr_manager'] as UserRole[] },
  { title: 'Documents', url: '/documents', icon: FileText, roles: ['super_admin', 'hr_manager'] as UserRole[] },
  { title: 'Automations', url: '/automations', icon: Zap, roles: ['super_admin', 'hr_manager'] as UserRole[] },
  { title: 'Settings', url: '/settings', icon: Settings, roles: ['super_admin'] as UserRole[] },
];

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  hr_manager: 'HR Manager',
  reporting_manager: 'Reporting Manager',
  employee: 'Employee',
  freelancer_intern: 'Freelancer/Intern',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, setRole, hasAccess } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = navItems.filter(item => hasAccess(item.roles));

  return (
    <div className="min-h-screen flex w-full">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-foreground/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen bg-sidebar flex flex-col transition-all duration-300
        ${collapsed ? 'w-16' : 'w-64'}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className={`flex items-center h-16 border-b border-sidebar-border px-4 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm">
              GG
            </div>
            {!collapsed && (
              <div className="animate-fade-in">
                <p className="font-semibold text-sidebar-foreground text-sm">Gluck Global</p>
                <p className="text-[10px] text-sidebar-muted">HR Management</p>
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <ul className="space-y-1 px-2">
            {visibleItems.map(item => (
              <li key={item.url}>
                <NavLink
                  to={item.url}
                  end={item.url === '/'}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors ${collapsed ? 'justify-center' : ''}`}
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!collapsed && <span className="animate-fade-in">{item.title}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Role switcher */}
        {!collapsed && (
          <div className="p-3 border-t border-sidebar-border animate-fade-in">
            <p className="text-[10px] uppercase tracking-wider text-sidebar-muted mb-2 px-1">Demo Role</p>
            <Select value={user.role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(roleLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex items-center justify-center h-10 border-t border-sidebar-border text-sidebar-muted hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between border-b bg-card px-4 lg:px-6 sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 hover:bg-muted rounded-md">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{roleLabels[user.role]}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
