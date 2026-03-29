import { useState, useEffect, useCallback } from 'react';
import { Employee } from '@/types/hr';
import { fetchEmployees } from '@/lib/employeeService';
import {
  fetchLeaveRequests,
  fetchPayrollRecords,
  fetchAttendanceRecords,
  fetchGeneratedDocuments,
  patchLeaveRequest,
} from '@/lib/hrApi';
import type { LeaveRequest, PayrollRecord, AttendanceRecord, GeneratedDocument } from '@/types/hr';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import { Users, CalendarOff, CalendarCheck, DollarSign, FileText, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

function isSelfServiceRole(role: string) {
  return role === 'employee' || role === 'freelancer_intern';
}

function parseFlexibleDate(value: string): { day: number; month: number; year?: number } | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;

  // New date input format: yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    if (!d || !m) return null;
    return { day: d, month: m, year: y };
  }

  // Legacy formats: dd/mm/yyyy or dd-mm-yyyy
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(v)) {
    const [d, m, y] = v.split(/[/-]/).map(Number);
    if (!d || !m) return null;
    return { day: d, month: m, year: y };
  }

  return null;
}

function daysUntilMonthDay(day: number, month: number, from: Date): number {
  const target = new Date(from.getFullYear(), month - 1, day);
  target.setHours(0, 0, 0, 0);
  const base = new Date(from);
  base.setHours(0, 0, 0, 0);
  if (target < base) target.setFullYear(target.getFullYear() + 1);
  return Math.round((target.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, hasAccess } = useAuth();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayRef, setTodayRef] = useState(() => new Date());

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, leaves, payroll, att, docs] = await Promise.all([
      fetchEmployees(),
      fetchLeaveRequests(),
      fetchPayrollRecords(),
      fetchAttendanceRecords(),
      fetchGeneratedDocuments(),
    ]);
    setEmployees(emps);
    setLeaveRequests(leaves);
    setPayrollRecords(payroll);
    setAttendanceRecords(att);
    setDocuments(docs);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const msUntilMidnight = nextMidnight.getTime() - now.getTime();
    let daily: number | undefined;

    const timeout = window.setTimeout(() => {
      setTodayRef(new Date());
      void load();

      daily = window.setInterval(() => {
        setTodayRef(new Date());
        void load();
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);

    return () => {
      window.clearTimeout(timeout);
      if (daily) window.clearInterval(daily);
    };
  }, [load]);

  const canApprove = hasAccess(['super_admin', 'hr_manager', 'reporting_manager']);

  const activeEmployees = employees.filter((e) => e.status === 'Active').length;
  const pendingLeaves = leaveRequests.filter((l) => l.status === 'Pending');
  const unpaidPayroll = payrollRecords.filter((p) => p.status === 'Unpaid');
  const totalPayrollDue = unpaidPayroll.reduce((sum, p) => sum + p.netPayable, 0);

  const today = todayRef;
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const todayAttendance = attendanceRecords.filter((a) => a.date === todayStr);
  const presentToday = todayAttendance.filter((a) => a.status === 'P' || a.status === 'WFH').length;
  const attendancePct = activeEmployees > 0 ? Math.round((presentToday / activeEmployees) * 100) : 0;

  const nowMonth = today.getMonth() + 1;
  const docsThisMonth = documents.filter((d) => {
    const p = d.date.split('/').map(Number);
    return p.length === 3 && p[1] === nowMonth && p[2] === today.getFullYear();
  }).length;

  const birthdaysNext7Days = employees
    .map((e) => {
      const dob = parseFlexibleDate(e.dateOfBirth);
      if (!dob) return null;
      const inDays = daysUntilMonthDay(dob.day, dob.month, today);
      if (inDays < 0 || inDays > 7) return null;
      return { employee: e, inDays };
    })
    .filter((x): x is { employee: Employee; inDays: number } => x !== null)
    .sort((a, b) => a.inDays - b.inDays);

  const upcomingJoiners = employees
    .map((e) => {
      const jd = parseFlexibleDate(e.joiningDate);
      if (!jd || !jd.year) return null;
      const joinDate = new Date(jd.year, jd.month - 1, jd.day);
      const base = new Date(today);
      joinDate.setHours(0, 0, 0, 0);
      base.setHours(0, 0, 0, 0);
      const inDays = Math.round((joinDate.getTime() - base.getTime()) / (24 * 60 * 60 * 1000));
      // Include recent joiners (last 3 days) and upcoming joiners (next 7 days)
      if (inDays < -3 || inDays > 7) return null;
      return { employee: e, inDays, joiningDateLabel: `${String(jd.day).padStart(2, '0')}/${String(jd.month).padStart(2, '0')}/${jd.year}` };
    })
    .filter((x): x is { employee: Employee; inDays: number; joiningDateLabel: string } => x !== null)
    .sort((a, b) => a.inDays - b.inDays);

  const handleApproveLeave = async (leave: LeaveRequest, status: 'Approved' | 'Rejected') => {
    const updated = await patchLeaveRequest(leave.id, {
      status,
      approvedBy: user.id,
      approvedByName: `${user.name} (${user.role})`,
    });
    if (updated) {
      setLeaveRequests((prev) => prev.map((l) => (l.id === leave.id ? updated : l)));
      toast({ title: status === 'Approved' ? 'Leave approved' : 'Leave rejected' });
    } else {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading dashboard…
      </div>
    );
  }

  if (isSelfServiceRole(user.role)) {
    const me = employees[0];
    const today = new Date();
    const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    const nowMonth = today.getMonth() + 1;
    const y = today.getFullYear();
    const myMonthAttendance = attendanceRecords.filter((a) => {
      const p = a.date.split('/').map(Number);
      return p.length === 3 && p[1] === nowMonth && p[2] === y;
    });
    const presentDaysThisMonth = myMonthAttendance.filter((a) => a.status === 'P' || a.status === 'WFH').length;
    const myToday = attendanceRecords.find((a) => a.date === todayStr);
    let todayLabel = 'Not marked';
    if (myToday) {
      if (myToday.status === 'L') todayLabel = 'On leave';
      else if (myToday.status === 'WFH') todayLabel = 'Working from home';
      else if (myToday.status === 'HD') todayLabel = 'Half day';
      else if (myToday.status === 'P') todayLabel = myToday.clockOut ? 'Present' : 'Clocked in';
      else todayLabel = myToday.status;
    }
    const pendingMine = leaveRequests.filter((l) => l.status === 'Pending');
    const latestPayslip = payrollRecords[0];

    return (
      <div className="space-y-6 animate-fade-in">
        <PageHeader
          title={`Hi, ${user.name.split(' ')[0] || user.name}`}
          description="Your personal workspace — attendance, leave, and payslips."
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Today"
            value={todayLabel}
            icon={<CalendarCheck className="w-5 h-5" />}
            subtitle={todayStr}
            gradient="bg-gradient-to-br from-success to-info"
            href="/my-attendance"
          />
          <StatCard
            title="Present (this month)"
            value={presentDaysThisMonth}
            icon={<CalendarCheck className="w-5 h-5" />}
            subtitle="Working days recorded"
            gradient="bg-gradient-to-br from-primary to-info"
            href="/my-attendance"
          />
          <StatCard
            title="Pending leave"
            value={pendingMine.length}
            icon={<Clock className="w-5 h-5" />}
            gradient="bg-gradient-to-br from-warning to-accent"
            href="/leaves"
          />
          <StatCard
            title="Latest payslip"
            value={latestPayslip ? `${latestPayslip.month} ${latestPayslip.year}` : '—'}
            icon={<DollarSign className="w-5 h-5" />}
            subtitle={latestPayslip ? `LKR ${latestPayslip.netPayable.toLocaleString()}` : 'None yet'}
            gradient="bg-gradient-to-br from-accent to-warning"
            href={latestPayslip ? `/payroll/payslip/${latestPayslip.id}` : '/payroll'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-sm">My leave requests</h3>
              <Button variant="ghost" size="sm" onClick={() => navigate('/leaves')} className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                View all <ArrowRight className="w-3 h-3" />
              </Button>
            </div>
            {leaveRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No leave requests yet</p>
            ) : (
              <div className="space-y-1">
                {leaveRequests.slice(0, 6).map((leave) => (
                  <div key={leave.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors -mx-1">
                    <div>
                      <p className="text-sm font-semibold">{leave.leaveType}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {leave.fromDate} – {leave.toDate}
                      </p>
                    </div>
                    <StatusBadge status={leave.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-sm">Quick actions</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-xl h-11 text-xs font-semibold" onClick={() => navigate('/my-attendance')}>
                My attendance
              </Button>
              <Button variant="outline" className="rounded-xl h-11 text-xs font-semibold" onClick={() => navigate('/leaves/new')}>
                Request leave
              </Button>
            </div>
            {me && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Profile</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-bold">
                    {me.fullName
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{me.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {me.jobTitle} · {me.department}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Dashboard" description="Welcome back! Here's your HR overview." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard index={0} title="Active Employees" value={activeEmployees} icon={<Users className="w-5 h-5" />} gradient="bg-gradient-to-br from-primary to-info" glowColor="hsl(210 65% 55% / 0.25)" href="/employees" />
        <StatCard index={1} title="On Leave Today" value={todayAttendance.filter(a => a.status === 'L').length} icon={<CalendarOff className="w-5 h-5" />} gradient="bg-gradient-to-br from-destructive to-warning" glowColor="hsl(0 84% 60% / 0.25)" href="/leaves" />
        <StatCard index={2} title="Attendance %" value={`${attendancePct}%`} icon={<CalendarCheck className="w-5 h-5" />} subtitle="This month" gradient="bg-gradient-to-br from-success to-info" glowColor="hsl(152 69% 40% / 0.25)" href="/attendance" />
        <StatCard index={3} title="Payroll Due" value={`LKR ${totalPayrollDue.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} gradient="bg-gradient-to-br from-accent to-warning" glowColor="hsl(38 92% 55% / 0.25)" href="/payroll" />
        <StatCard index={4} title="Pending Leaves" value={pendingLeaves.length} icon={<Clock className="w-5 h-5" />} gradient="bg-gradient-to-br from-warning to-accent" glowColor="hsl(38 92% 50% / 0.25)" href="/leaves" />
        <StatCard index={5} title="Documents" value={3} icon={<FileText className="w-5 h-5" />} subtitle="This month" gradient="bg-gradient-to-br from-info to-primary" glowColor="hsl(199 89% 48% / 0.25)" href="/documents" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-sm">Recent Leave Requests</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/leaves')} className="text-xs gap-1 text-muted-foreground hover:text-foreground">
              View All <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-1">
            {leaveRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No leave requests yet</p>
            ) : (
              leaveRequests.slice(0, 5).map((leave) => {
                const emp = employees.find((e) => e.id === leave.employeeId);
                return (
                  <div key={leave.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors -mx-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold">
                        {emp?.fullName.split(' ').map((n) => n[0]).join('') || '?'}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{emp?.fullName || 'Unknown'}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {leave.leaveType} • {leave.fromDate} - {leave.toDate}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={leave.status} />
                      {leave.status === 'Pending' && canApprove && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg text-success border-success/20 hover:bg-success/10" onClick={() => handleApproveLeave(leave, 'Approved')}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => handleApproveLeave(leave, 'Rejected')}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-sm mb-4">🎂 Birthdays (Next 7 Days)</h3>
            {birthdaysNext7Days.length > 0 ? (
              birthdaysNext7Days.map(({ employee, inDays }) => (
                <div key={`birthday-${employee.id}`} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-accent-foreground text-xs font-bold">
                      {employee.fullName.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{employee.fullName}</p>
                      <p className="text-xs text-muted-foreground">{employee.department}</p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-accent">
                    {inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `In ${inDays} days`}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No birthdays in the next 7 days 🎈</p>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-sm mb-4">📅 Upcoming Joiners</h3>
            {upcomingJoiners.length > 0 ? (
              upcomingJoiners.map(({ employee, inDays, joiningDateLabel }) => (
                <div key={`joiner-${employee.id}`} className="flex items-center justify-between py-2">
                  <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-accent-foreground text-xs font-bold">
                    {employee.fullName.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div className="flex-1 ml-3">
                    <p className="text-sm font-semibold">{employee.fullName}</p>
                    <p className="text-xs text-muted-foreground">{employee.department} · Joining: {joiningDateLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-primary">
                      {inDays < 0 ? `${Math.abs(inDays)} day${Math.abs(inDays) > 1 ? 's' : ''} ago` : inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `In ${inDays} days`}
                    </p>
                    {inDays <= 0 && (
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success font-semibold">
                        New Comer
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No joiners in last 3 days or next 7 days</p>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-sm mb-4">⚡ Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/employees/new')} className="rounded-xl h-10 text-xs font-semibold">
                Add Employee
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/attendance/daily')} className="rounded-xl h-10 text-xs font-semibold">
                Mark Attendance
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/leaves/new')} className="rounded-xl h-10 text-xs font-semibold">
                New Leave Request
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/documents/generate')} className="rounded-xl h-10 text-xs font-semibold">
                Generate Document
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
