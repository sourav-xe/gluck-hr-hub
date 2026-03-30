import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/hr';
import { SIDEBAR_NAV_DEFINITIONS, type SidebarNavKey } from '@/lib/sidebarNav';
import ThemeToggle from '@/components/ThemeToggle';
import {
  LayoutDashboard, Users, CalendarCheck, CalendarOff, DollarSign,
  FileText, Zap, Settings, Megaphone, ChevronLeft, ChevronRight, Menu, X, LogOut, UserRound, FolderOpen, ClipboardCheck, LayoutTemplate, Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationDropdown from '@/components/shared/NotificationDropdown';

const SIDEBAR_ICONS: Record<SidebarNavKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  employees: Users,
  'my-profile': UserRound,
  attendance: CalendarCheck,
  'my-attendance': CalendarCheck,
  leaves: CalendarOff,
  regularization: ClipboardCheck,
  'my-documents': FolderOpen,
  payroll: DollarSign,
  documents: FileText,
  'auto-docs': LayoutTemplate,
  automations: Zap,
  announcements: Megaphone,
  settings: Settings,
};

const navItems = SIDEBAR_NAV_DEFINITIONS.map((d) => ({
  ...d,
  icon: SIDEBAR_ICONS[d.navKey],
}));

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  hr_manager: 'HR Manager',
  reporting_manager: 'Reporting Manager',
  employee: 'Employee',
  freelancer_intern: 'Freelancer/Intern',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, hasAccess, signOut, navItemVisible } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const visibleItems = navItems.filter((item) => hasAccess(item.roles) && navItemVisible(item.navKey));

  const sidebarWidth = collapsed ? 'lg:w-[76px]' : 'lg:w-[260px]';

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-50 h-screen flex flex-col transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
        bg-sidebar w-[260px] ${sidebarWidth}
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="flex items-center h-16 px-4 border-b border-sidebar-border/50 shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-extrabold text-xs shrink-0 shadow-lg shadow-primary/20">
              GG
            </div>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="min-w-0 overflow-hidden"
              >
                <p className="font-bold text-sidebar-foreground text-sm tracking-tight truncate">Gluck Global</p>
                <p className="text-[10px] text-sidebar-muted">HR Platform</p>
              </motion.div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 1024) setMobileOpen(false);
              else setCollapsed(!collapsed);
            }}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors ml-auto"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <ChevronLeft className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto min-h-0">
          <ul className="space-y-0.5 px-3">
            {visibleItems.map((item) => (
              <li key={item.navKey}>
                <NavLink
                  to={item.url}
                  end={item.url === '/'}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-all duration-200 group ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}
                  activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold"
                  onClick={() => setMobileOpen(false)}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0 group-hover:scale-110 transition-transform" />
                  <span className={collapsed ? 'lg:hidden' : ''}>{item.title}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="shrink-0 p-3 border-t border-sidebar-border/50">
          <Button
            variant="ghost"
            className={`w-full h-10 rounded-xl text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive justify-start gap-3 text-[13px] ${collapsed ? 'lg:justify-center lg:gap-0 lg:px-0' : ''}`}
            onClick={() => { setMobileOpen(false); signOut(); }}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>Log out</span>
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 hover:bg-muted rounded-xl transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden lg:flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 text-muted-foreground text-sm w-64 cursor-pointer hover:bg-muted transition-colors">
              <Search className="w-4 h-4" />
              <span className="text-xs">Search...</span>
              <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-background border border-border font-mono">⌘K</kbd>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationDropdown />
            <div className="h-6 w-px bg-border/50 mx-1" />
            <div className="flex items-center gap-3 pl-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-3 pl-1 cursor-pointer">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold leading-tight">{user.name}</p>
                      <p className="text-[10px] text-muted-foreground">{roleLabels[user.role]}</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-md shadow-primary/20">
                      {user.name?.trim().split(/\s+/).filter(Boolean).map((n) => n[0]).join('')}
                    </div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      navigate('/my-profile');
                    }}
                  >
                    <UserRound className="w-4 h-4 mr-2" />
                    My Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => {
                      e.preventDefault();
                      void signOut();
                      // No need to navigate manually; routes react to auth state.
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
