'use client';

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Bell, CalendarDays, Clock3, UserPlus, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEmployees } from '@/lib/employeeService';
import { fetchLeaveRequests, fetchRegularizationRequests } from '@/lib/hrApi';
import type { Employee, LeaveRequest, RegularizationRequest } from '@/types/hr';

type NotificationSeverity = 'info' | 'warning' | 'success' | 'danger';

type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  severity: NotificationSeverity;
  actionLabel?: string;
  actionUrl?: string;
};

function parseEnGbYmdDate(s: string): Date | null {
  // Expected format: dd/mm/yyyy (from backend serializeLeave/serializeRegularization)
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (!day || !month || !year) return null;
  const dt = new Date(year, month - 1, day);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function daysUntilNextBirthday(dateOfBirth: string, now: Date): number | null {
  // dateOfBirth is stored as YYYY-MM-DD via the `type="date"` input
  const parts = String(dateOfBirth || '').split('-').map((p) => Number(p));
  if (parts.length !== 3) return null;
  const month = parts[1];
  const day = parts[2];
  if (!month || !day) return null;

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), month - 1, day);

  // If birthday already happened this year, shift to next year.
  if (next.getTime() < startOfToday.getTime()) {
    next = new Date(now.getFullYear() + 1, month - 1, day);
  }

  const diffMs = next.getTime() - startOfToday.getTime();
  return Math.floor(diffMs / 86400000);
}

function severityClasses(sev: NotificationSeverity) {
  switch (sev) {
    case 'warning':
      return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
    case 'success':
      return 'bg-success/15 text-success border-success/20';
    case 'danger':
      return 'bg-destructive/15 text-destructive border-destructive/20';
    default:
      return 'bg-info/15 text-info border-info/20';
  }
}

function employeeNameById(employees: Employee[]) {
  const map = new Map<string, Employee>();
  for (const e of employees) map.set(e.id, e);
  return map;
}

function pickLatestUpdatedWithin<T extends { createdAt: string }>(rows: T[], days: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return rows.filter((r) => {
    const dt = parseEnGbYmdDate(r.createdAt);
    if (!dt) return false;
    return dt.getTime() >= start.getTime();
  });
}

export default function NotificationDropdown({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const role = String(user.role || '').toLowerCase();
  const isSelfService = role === 'employee' || role === 'freelancer_intern';
  const isReviewer = role === 'super_admin' || role === 'hr_manager' || role === 'reporting_manager';

  const unreadCount = items.length;

  const buildNotifications = async () => {
    const [employees, leaveRequests, regularizations] = await Promise.all([
      fetchEmployees(),
      fetchLeaveRequests(),
      fetchRegularizationRequests(),
    ]);

    const empById = employeeNameById(employees);
    const now = new Date();

    const notifications: NotificationItem[] = [];

    // 1) Onboarding pending (Super Admin / HR / Manager)
    if (role === 'super_admin' || role === 'hr_manager' || role === 'reporting_manager') {
      const pendingOnboarding = employees.filter((e) => e.onboardingComplete === false || e.onboardingComplete === null);
      if (pendingOnboarding.length > 0) {
        notifications.push({
          id: 'onboarding-pending',
          title: 'Onboarding pending',
          description: `${pendingOnboarding.length} employee(s) still need onboarding setup.`,
          severity: 'warning',
          actionLabel: 'Open Employees',
          actionUrl: '/employees',
        });
      }
    }

    // 2) Pending leave requests
    if (isReviewer) {
      const pendingLeave = leaveRequests.filter((l) => l.status === 'Pending');
      if (pendingLeave.length > 0) {
        const top = pendingLeave.slice(0, 3).map((l) => empById.get(l.employeeId)?.fullName || 'Unknown').join(', ');
        notifications.push({
          id: 'leave-pending',
          title: 'Leave requests pending',
          description: pendingLeave.length > 3 ? `${top} (+${pendingLeave.length - 3} more)` : top || undefined,
          severity: 'warning',
          actionLabel: 'Review Leaves',
          actionUrl: '/leaves',
        });
      }

      const recentReviews = pickLatestUpdatedWithin(
        leaveRequests.filter((l) => l.status !== 'Pending'),
        7
      );
      for (const l of recentReviews.slice(0, 2)) {
        notifications.push({
          id: `leave-${l.id}-${l.status}`,
          title: `Leave ${l.status}`,
          description: `${empById.get(l.employeeId)?.fullName || 'Employee'} · ${l.leaveType} (${l.fromDate} - ${l.toDate})`,
          severity: l.status === 'Approved' ? 'success' : l.status === 'Rejected' ? 'danger' : 'info',
          actionLabel: 'View Leaves',
          actionUrl: '/leaves',
        });
      }
    } else {
      // 3) Employee leave updates
      const myPending = leaveRequests.filter((l) => l.status === 'Pending');
      const myUpdated = leaveRequests.filter((l) => l.status !== 'Pending');
      if (myUpdated.length > 0) {
        const recent = pickLatestUpdatedWithin(myUpdated, 14);
        const target = (recent.length ? recent : myUpdated).slice(0, 2);
        for (const l of target) {
          notifications.push({
            id: `my-leave-${l.id}-${l.status}`,
            title: `Your leave is ${l.status}`,
            description: `${l.leaveType} · ${l.fromDate} - ${l.toDate}${l.note ? ` · Note: ${l.note}` : ''}`,
            severity: l.status === 'Approved' ? 'success' : l.status === 'Rejected' ? 'danger' : 'info',
            actionLabel: 'Open My Leaves',
            actionUrl: '/leaves',
          });
        }
      } else if (myPending.length > 0) {
        const l = myPending[0];
        notifications.push({
          id: `my-leave-pending-${l.id}`,
          title: 'Leave request pending review',
          description: `${l.leaveType} · ${l.fromDate} - ${l.toDate}`,
          severity: 'warning',
          actionLabel: 'Open My Leaves',
          actionUrl: '/leaves',
        });
      }
    }

    // 4) Regularization (attendance correction) pending / updates
    if (isReviewer) {
      const pendingReg = regularizations.filter((r) => r.status === 'Pending');
      if (pendingReg.length > 0) {
        const top = pendingReg
          .slice(0, 2)
          .map((r) => empById.get(r.employeeId)?.fullName || 'Unknown')
          .join(', ');
        notifications.push({
          id: 'reg-pending',
          title: 'Regularization requests pending',
          description: pendingReg.length > 2 ? `${top} (+${pendingReg.length - 2} more)` : top || undefined,
          severity: 'warning',
          actionLabel: 'Review Regularization',
          actionUrl: '/regularization',
        });
      }

      const recentReg = pickLatestUpdatedWithin(
        regularizations.filter((r) => r.status !== 'Pending'),
        7
      );
      for (const r of recentReg.slice(0, 2)) {
        notifications.push({
          id: `reg-${r.id}-${r.status}`,
          title: `Regularization ${r.status}`,
          description: `${empById.get(r.employeeId)?.fullName || 'Employee'} · ${r.date}`,
          severity: r.status === 'Approved' ? 'success' : r.status === 'Rejected' ? 'danger' : 'info',
          actionLabel: 'View Regularization',
          actionUrl: '/regularization',
        });
      }
    } else {
      const myPending = regularizations.filter((r) => r.status === 'Pending');
      const myUpdated = regularizations.filter((r) => r.status !== 'Pending');
      if (myUpdated.length > 0) {
        const recent = pickLatestUpdatedWithin(myUpdated, 14);
        const target = (recent.length ? recent : myUpdated).slice(0, 2);
        for (const r of target) {
          notifications.push({
            id: `my-reg-${r.id}-${r.status}`,
            title: `Your regularization is ${r.status}`,
            description: `Date: ${r.date}${r.reason ? ` · ${r.reason}` : ''}`,
            severity: r.status === 'Approved' ? 'success' : r.status === 'Rejected' ? 'danger' : 'info',
            actionLabel: 'Open My Regularization',
            actionUrl: '/regularization',
          });
        }
      } else if (myPending.length > 0) {
        const r = myPending[0];
        notifications.push({
          id: `my-reg-pending-${r.id}`,
          title: 'Regularization request pending review',
          description: `Date: ${r.date}`,
          severity: 'warning',
          actionLabel: 'Open My Regularization',
          actionUrl: '/regularization',
        });
      }
    }

    // 5) Upcoming birthdays
    const birthdayDays = role === 'employee' ? 30 : 7;
    let birthdayCandidates = employees;
    if (isSelfService && user.employeeId) {
      birthdayCandidates = employees.filter((e) => e.id === user.employeeId);
    }
    if (!isSelfService && (role === 'super_admin' || role === 'hr_manager' || role === 'reporting_manager')) {
      // reviewers can see all birthdays
      birthdayCandidates = employees;
    }

    const birthdays = birthdayCandidates
      .map((e) => {
        const diff = daysUntilNextBirthday(e.dateOfBirth, now);
        return diff == null ? null : { emp: e, diff };
      })
      .filter((x): x is { emp: Employee; diff: number } => x != null)
      .filter((x) => x.diff >= 0 && x.diff <= birthdayDays)
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 3);

    for (const b of birthdays) {
      notifications.push({
        id: `bday-${b.emp.id}-${b.diff}`,
        title: 'Upcoming birthday',
        description: `${b.emp.fullName} · ${b.diff === 0 ? 'Today' : `In ${b.diff} day(s)`}`,
        severity: 'info',
        actionLabel: 'Open Employees',
        actionUrl: '/employees',
      });
    }

    return notifications;
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const next = await buildNotifications();
        if (!cancelled) setItems(next);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    // Refresh every minute while logged in; these are small lists.
    const t = window.setInterval(() => {
      if (!cancelled) void run();
    }, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.employeeId, user.role]);

  const content = useMemo(() => {
    if (loading) return <div className="p-3 text-xs text-muted-foreground">Loading...</div>;
    if (items.length === 0) return <div className="p-3 text-xs text-muted-foreground">No notifications</div>;

    return (
      <div className="p-2">
        <ScrollArea className="h-[320px]">
          <div className="space-y-1">
            {items.slice(0, 15).map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="w-full cursor-pointer rounded-xl px-3 py-2 hover:bg-muted/40"
                onSelect={(e) => {
                  // Radix requires preventing default if you handle navigation manually.
                  e.preventDefault();
                  if (n.actionUrl) navigate(n.actionUrl);
                }}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className={`mt-0.5 inline-flex rounded-xl border px-2 py-1 text-[10px] font-bold ${severityClasses(n.severity)}`}>
                    {n.severity === 'warning' ? 'ALERT' : n.severity === 'success' ? 'OK' : n.severity === 'danger' ? 'FAIL' : 'INFO'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{n.title}</div>
                    {n.description ? <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.description}</div> : null}
                    {n.actionUrl ? (
                      <div className="text-[11px] font-semibold text-primary mt-1">{n.actionLabel || 'Open'}</div>
                    ) : null}
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  }, [items, loading, navigate]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 rounded-xl relative ${className ?? ''}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full ring-2 ring-background" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0 rounded-2xl overflow-hidden">
        <div className="px-3 py-3 border-b border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Notifications</span>
          </div>
          <Badge variant="secondary" className="rounded-xl">
            {unreadCount}
          </Badge>
        </div>
        {content}
        <DropdownMenuSeparator />
        <div className="p-3 flex items-center justify-between">
          <Button
            variant="outline"
            className="rounded-xl h-8 text-xs"
            disabled={items.length === 0}
            onClick={() => {
              // quick jump based on role
              if (role === 'employee' || role === 'freelancer_intern') {
                navigate('/leaves');
              } else {
                navigate('/leaves');
              }
            }}
          >
            View
          </Button>
          <Button
            variant="ghost"
            className="rounded-xl h-8 text-xs"
            onClick={() => setItems([])}
          >
            Clear
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

