import { useState, useEffect } from 'react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/hr';
import ThemeToggle from '@/components/ThemeToggle';
import {
  LayoutDashboard, Users, CalendarCheck, CalendarOff, DollarSign,
  FileText, Zap, Settings, Megaphone, ChevronLeft, ChevronRight, Menu, X, Bell, LogOut, UserRound, FolderOpen, ClipboardCheck, LayoutTemplate
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard, roles: ['super_admin', 'hr_manager', 'reporting_manager', 'employee', 'freelancer_intern'] as UserRole[] },
  { title: 'Employees', url: '/employees', icon: Users, roles: ['super_admin', 'hr_manager', 'reporting_manager'] as UserRole[] },
  { title: 'My Profile', url: '/my-profile', icon: UserRound, roles: ['reporting_manager', 'employee', 'freelancer_intern'] as UserRole[] },
  { title: 'Attendance', url: '/attendance', icon: CalendarCheck, roles: ['super_admin', 'hr_manager', 'reporting_manager'] as UserRole[] },
  { title: 'My Attendance', url: '/my-attendance', icon: CalendarCheck, roles: ['employee', 'freelancer_intern'] as UserRole[] },
  { title: 'Leave Mgmt', url: '/leaves', icon: CalendarOff, roles: ['super_admin', 'hr_manager', 'reporting_manager', 'employee'] as UserRole[] },
  { title: 'Regularization', url: '/regularization', icon: ClipboardCheck, roles: ['super_admin', 'hr_manager', 'reporting_manager', 'employee', 'freelancer_intern'] as UserRole[] },
  { title: 'My Documents', url: '/my-documents', icon: FolderOpen, roles: ['reporting_manager', 'employee', 'freelancer_intern'] as UserRole[] },
  { title: 'Payroll', url: '/payroll', icon: DollarSign, roles: ['super_admin', 'hr_manager'] as UserRole[] },
  { title: 'Documents', url: '/documents', icon: FileText, roles: ['super_admin', 'hr_manager'] as UserRole[] },
  { title: 'Auto-Docs', url: '/documents/templates', icon: LayoutTemplate, roles: ['super_admin', 'hr_manager'] as UserRole[] },
  { title: 'Automations', url: '/automations', icon: Zap, roles: ['super_admin', 'hr_manager'] as UserRole[] },
  { title: 'Announcements', url: '/announcements', icon: Megaphone, roles: ['super_admin'] as UserRole[] },
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
  const { user, hasAccess, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const visibleItems = navItems.filter(item => hasAccess(item.roles));

  return (
    <div className="min-h-screen flex w-full bg-background">
      {mobileOpen && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col transition-all duration-300
        bg-sidebar w-[260px]
        ${collapsed ? 'lg:w-[72px]' : ''}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="lg:hidden relative flex items-center h-[4.25rem] px-3 border-b border-sidebar-border/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1 pr-10">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sidebar-primary to-accent/80 flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shadow-lg shadow-accent/20 shrink-0">
              GG
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sidebar-foreground text-sm tracking-tight truncate">Gluck Global</p>
              <p className="text-[10px] text-sidebar-muted font-medium">HR Management</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-xl text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/70 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {collapsed ? (
          <div className="hidden lg:flex flex-col items-center gap-2 py-3 px-2 border-b border-sidebar-border/70 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sidebar-primary to-accent/80 flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shadow-lg shadow-accent/20">
              GG
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              className="h-8 w-8 flex items-center justify-center rounded-xl text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/70 border border-sidebar-border/50 transition-all"
              title="Expand sidebar"
              aria-expanded={false}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="hidden lg:flex relative items-center h-[4.25rem] px-3 border-b border-sidebar-border/70 shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1 pr-10">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sidebar-primary to-accent/80 flex items-center justify-center text-sidebar-primary-foreground font-bold text-sm shadow-lg shadow-accent/20 shrink-0">
                GG
              </div>
              <div className="animate-fade-in min-w-0">
                <p className="font-bold text-sidebar-foreground text-sm tracking-tight truncate">Gluck Global</p>
                <p className="text-[10px] text-sidebar-muted font-medium">HR Management</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center rounded-xl text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/70 border border-transparent hover:border-sidebar-border/80 transition-all"
              title="Collapse sidebar"
              aria-expanded
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        <nav className="flex-1 py-3 overflow-y-auto min-h-0">
          <ul className="space-y-1 px-3">
            {visibleItems.map(item => (
              <li key={item.url}>
                <NavLink
                  to={item.url}
                  end={item.url === '/'}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60 transition-all duration-200 ${collapsed ? 'justify-center' : ''}`}
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-sm"
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span className={collapsed ? 'animate-fade-in lg:hidden' : 'animate-fade-in'}>{item.title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="shrink-0 p-3 border-t border-sidebar-border/70 bg-sidebar/95 backdrop-blur-sm">
          <Button
            variant="ghost"
            className={`w-full h-11 rounded-xl text-sidebar-foreground/90 hover:text-sidebar-foreground hover:bg-sidebar-accent/70 border border-sidebar-border/40 justify-start gap-3 ${collapsed ? 'lg:justify-center lg:gap-0 lg:px-0' : ''}`}
            onClick={() => {
              setMobileOpen(false);
              signOut();
            }}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className={`text-[13px] font-medium ${collapsed ? 'lg:hidden' : ''}`}>Log out</span>
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 glass-card border-b border-border/50">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 hover:bg-muted rounded-xl transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-accent rounded-full" />
            </Button>
            <div className="h-8 w-px bg-border/50 mx-1" />
            <div className="text-right">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-[11px] text-muted-foreground">{roleLabels[user.role]}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground text-xs font-bold shadow-md shadow-primary/20">
              {user.name.split(' ').map(n => n[0]).join('')}
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
