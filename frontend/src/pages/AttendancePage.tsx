import { useState, useEffect, useCallback } from 'react';
import { fetchEmployees } from '@/lib/employeeService';
import { fetchAttendanceRecords } from '@/lib/hrApi';
import { Employee, AttendanceRecord, AttendanceStatus } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Download, Clock, Loader2 } from 'lucide-react';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AttendancePage() {
  const { toast } = useToast();
  const [month, setMonth] = useState(2);
  const [year] = useState(new Date().getFullYear());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, att] = await Promise.all([fetchEmployees(), fetchAttendanceRecords()]);
    setEmployees(emps);
    setAttendanceRecords(att);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const activeEmployees = employees.filter((e) => e.status === 'Active');

  const getRecord = (empId: string, day: number) => {
    const dateStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
    return attendanceRecords.find((a) => a.employeeId === empId && a.date === dateStr);
  };

  const isWeekend = (day: number) => {
    const d = new Date(year, month, day);
    return d.getDay() === 0 || d.getDay() === 6;
  };

  const statusColors: Record<AttendanceStatus, string> = {
    P: 'bg-success/15 text-success',
    L: 'bg-destructive/15 text-destructive',
    WFH: 'bg-info/15 text-info',
    HD: 'bg-warning/15 text-warning',
    A: 'bg-muted text-muted-foreground',
  };

  const handleExport = () => {
    const header = ['Employee', ...Array.from({ length: daysInMonth }, (_, i) => String(i + 1))];
    const rows = activeEmployees.map((emp) => {
      const days = Array.from({ length: daysInMonth }, (_, i) => {
        const rec = getRecord(emp.id, i + 1);
        return rec?.status || (isWeekend(i + 1) ? 'WE' : '-');
      });
      return [emp.fullName, ...days];
    });
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${months[month]}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Attendance CSV downloaded.' });
  };

  const allMonthRecords = attendanceRecords.filter((a) => {
    const parts = a.date.split('/').map(Number);
    return parts[1] - 1 === month && parts[2] === year;
  });
  const totalPresent = allMonthRecords.filter((a) => a.status === 'P' || a.status === 'WFH').length;
  const totalRecords = allMonthRecords.length;
  const attendancePct = totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading attendance…
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Attendance"
        description="Monthly attendance overview (MongoDB)"
        action={
          <Button variant="outline" className="gap-2 rounded-xl" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-success">{attendancePct}%</p>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Attendance Rate</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{totalPresent}</p>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Present Days</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-destructive">{allMonthRecords.filter((a) => a.status === 'L').length}</p>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Leave Days</p>
        </div>
        <div className="glass-card rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-warning">{allMonthRecords.filter((a) => a.status === 'A').length}</p>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Absent Days</p>
        </div>
      </div>

      <div className="flex gap-3 mb-5">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-40 rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m, i) => (
              <SelectItem key={i} value={String(i)}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-2xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left p-3 sticky left-0 bg-card dark:bg-card min-w-[140px] font-semibold text-muted-foreground text-[11px] uppercase tracking-wider z-10">
                Employee
              </th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => (
                <th key={day} className={`p-1.5 text-center min-w-[32px] font-medium ${isWeekend(day) ? 'bg-muted/30' : ''}`}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map((emp) => (
              <tr key={emp.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="p-3 sticky left-0 bg-card dark:bg-card z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-[9px] font-bold">
                      {emp.fullName.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <span className="font-semibold text-[11px]">{emp.fullName}</span>
                  </div>
                </td>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const record = getRecord(emp.id, day);
                  const weekend = isWeekend(day);
                  return (
                    <td key={day} className={`p-1 text-center ${weekend ? 'bg-muted/30' : ''}`}>
                      {weekend ? (
                        <span className="text-muted-foreground/40">·</span>
                      ) : record ? (
                        <div className="group relative">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[9px] font-bold cursor-default ${statusColors[record.status as AttendanceStatus]}`}
                          >
                            {record.status}
                          </span>
                          {(record.clockIn || record.clockOut) && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20">
                              <div className="glass-card rounded-lg p-2 text-[9px] whitespace-nowrap shadow-lg">
                                {record.clockIn && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" /> In: {record.clockIn}
                                  </div>
                                )}
                                {record.clockOut && (
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5" /> Out: {record.clockOut}
                                  </div>
                                )}
                                {record.totalHours != null && <div className="font-semibold mt-0.5">{record.totalHours}h total</div>}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 mt-5 text-xs">
        {(
          [
            { status: 'P' as const, label: 'Present' },
            { status: 'L' as const, label: 'Leave' },
            { status: 'WFH' as const, label: 'WFH' },
            { status: 'HD' as const, label: 'Half Day' },
            { status: 'A' as const, label: 'Absent' },
          ] as const
        ).map(({ status, label }) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold ${statusColors[status]}`}>{status}</span>
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
