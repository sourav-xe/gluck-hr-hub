import { employees, leaveRequests, payrollRecords, attendanceRecords } from '@/data/mockData';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import PageHeader from '@/components/shared/PageHeader';
import { Users, CalendarOff, CalendarCheck, DollarSign, FileText, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const navigate = useNavigate();
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const pendingLeaves = leaveRequests.filter(l => l.status === 'Pending');
  const unpaidPayroll = payrollRecords.filter(p => p.status === 'Unpaid');
  const totalPayrollDue = unpaidPayroll.reduce((sum, p) => sum + p.netPayable, 0);

  // Today's attendance
  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  const todayAttendance = attendanceRecords.filter(a => a.date === todayStr);
  const presentToday = todayAttendance.filter(a => a.status === 'P' || a.status === 'WFH').length;
  const attendancePct = activeEmployees > 0 ? Math.round((presentToday / activeEmployees) * 100) : 0;

  // Birthdays today (mock - let's show one)
  const todayBirthdays = employees.filter(e => {
    const dob = e.dateOfBirth;
    const [d, m] = dob.split('/');
    return parseInt(d) === today.getDate() && parseInt(m) === today.getMonth() + 1;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Dashboard" description="Welcome back! Here's your HR overview." />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard title="Active Employees" value={activeEmployees} icon={<Users className="w-5 h-5" />} />
        <StatCard title="On Leave Today" value={todayAttendance.filter(a => a.status === 'L').length} icon={<CalendarOff className="w-5 h-5" />} />
        <StatCard title="Attendance %" value={`${attendancePct}%`} icon={<CalendarCheck className="w-5 h-5" />} subtitle="This month" />
        <StatCard title="Payroll Due" value={`LKR ${totalPayrollDue.toLocaleString()}`} icon={<DollarSign className="w-5 h-5" />} />
        <StatCard title="Pending Leaves" value={pendingLeaves.length} icon={<Clock className="w-5 h-5" />} />
        <StatCard title="Documents" value={3} icon={<FileText className="w-5 h-5" />} subtitle="This month" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Leave Requests */}
        <div className="bg-card rounded-lg border p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Recent Leave Requests</h3>
            <Button variant="ghost" size="sm" onClick={() => navigate('/leaves')}>View All</Button>
          </div>
          <div className="space-y-3">
            {leaveRequests.slice(0, 5).map(leave => {
              const emp = employees.find(e => e.id === leave.employeeId);
              return (
                <div key={leave.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{emp?.fullName}</p>
                    <p className="text-xs text-muted-foreground">{leave.leaveType} • {leave.fromDate} - {leave.toDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={leave.status} />
                    {leave.status === 'Pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs text-emerald-600 border-emerald-200 hover:bg-emerald-50">Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50">Reject</Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Today's Birthdays & Upcoming Joiners */}
        <div className="space-y-6">
          <div className="bg-card rounded-lg border p-5">
            <h3 className="font-semibold mb-3">🎂 Today's Birthdays</h3>
            {todayBirthdays.length > 0 ? (
              todayBirthdays.map(e => (
                <div key={e.id} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground text-xs font-semibold">
                    {e.fullName.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{e.fullName}</p>
                    <p className="text-xs text-muted-foreground">{e.department}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No birthdays today</p>
            )}
          </div>

          <div className="bg-card rounded-lg border p-5">
            <h3 className="font-semibold mb-3">📅 Upcoming Joiners (Next 7 Days)</h3>
            <p className="text-sm text-muted-foreground">No upcoming joiners</p>
          </div>

          <div className="bg-card rounded-lg border p-5">
            <h3 className="font-semibold mb-3">📊 Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/employees/new')}>Add Employee</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/attendance/daily')}>Mark Attendance</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/leaves/new')}>New Leave Request</Button>
              <Button variant="outline" size="sm" onClick={() => navigate('/documents/generate')}>Generate Document</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
