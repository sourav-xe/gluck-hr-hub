import { employees, leaveRequests, payrollRecords, attendanceRecords } from '@/data/mockData';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import { Users, CalendarOff, CalendarCheck, DollarSign, FileText, Clock, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const pendingLeaves = leaveRequests.filter(l => l.status === 'Pending');
  const unpaidPayroll = payrollRecords.filter(p => p.status === 'Unpaid');
  const totalPayrollDue = unpaidPayroll.reduce((sum, p) => sum + p.netPayable, 0);

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const todayAttendance = attendanceRecords.filter(a => a.date === todayStr);
  const presentToday = todayAttendance.filter(a => a.status === 'P' || a.status === 'WFH').length;
  const attendancePct = activeEmployees > 0 ? Math.round((presentToday / activeEmployees) * 100) : 0;

  const todayBirthdays = employees.filter(e => {
    const [d, m] = e.dateOfBirth.split('/');
    return parseInt(d) === today.getDate() && parseInt(m) === today.getMonth() + 1;
  });

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
        {/* Recent Leave Requests */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-sm">Recent Leave Requests</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/leaves')} className="text-xs gap-1 text-muted-foreground hover:text-foreground">
              View All <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-1">
            {leaveRequests.slice(0, 5).map(leave => {
              const emp = employees.find(e => e.id === leave.employeeId);
              return (
                <div key={leave.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-muted/50 transition-colors -mx-1">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold">
                      {emp?.fullName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{emp?.fullName}</p>
                      <p className="text-[11px] text-muted-foreground">{leave.leaveType} • {leave.fromDate} - {leave.toDate}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={leave.status} />
                    {leave.status === 'Pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg text-success border-success/20 hover:bg-success/10">Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg text-destructive border-destructive/20 hover:bg-destructive/10">Reject</Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-sm mb-4">🎂 Today's Birthdays</h3>
            {todayBirthdays.length > 0 ? (
              todayBirthdays.map(e => (
                <div key={e.id} className="flex items-center gap-3 py-2">
                  <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center text-accent-foreground text-xs font-bold">
                    {e.fullName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{e.fullName}</p>
                    <p className="text-xs text-muted-foreground">{e.department}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No birthdays today 🎈</p>
            )}
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-sm mb-4">📅 Upcoming Joiners</h3>
            <p className="text-sm text-muted-foreground">No upcoming joiners in the next 7 days</p>
          </div>

          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-sm mb-4">⚡ Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/employees/new')} className="rounded-xl h-10 text-xs font-semibold">Add Employee</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/attendance/daily')} className="rounded-xl h-10 text-xs font-semibold">Mark Attendance</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/leaves/new')} className="rounded-xl h-10 text-xs font-semibold">New Leave Request</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/documents/generate')} className="rounded-xl h-10 text-xs font-semibold">Generate Document</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
