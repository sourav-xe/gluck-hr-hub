import { useState } from 'react';
import { employees, attendanceRecords } from '@/data/mockData';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AttendanceStatus } from '@/types/hr';
import { Download } from 'lucide-react';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AttendancePage() {
  const [month, setMonth] = useState(2);
  const [year] = useState(2025);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const activeEmployees = employees.filter(e => e.status === 'Active');

  const getStatus = (empId: string, day: number): AttendanceStatus | undefined => {
    const dateStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
    return attendanceRecords.find(a => a.employeeId === empId && a.date === dateStr)?.status;
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

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Attendance"
        description="Monthly attendance overview"
        action={<Button variant="outline" className="gap-2 rounded-xl"><Download className="w-4 h-4" /> Export CSV</Button>}
      />

      <div className="flex gap-3 mb-5">
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-40 rounded-xl h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-2xl overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left p-3 sticky left-0 bg-card dark:bg-card min-w-[140px] font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">Employee</th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                <th key={day} className={`p-1.5 text-center min-w-[32px] font-medium ${isWeekend(day) ? 'bg-muted/30' : ''}`}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map(emp => (
              <tr key={emp.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="p-3 sticky left-0 bg-card dark:bg-card">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary text-[9px] font-bold">
                      {emp.fullName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="font-semibold text-[11px]">{emp.fullName}</span>
                  </div>
                </td>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const status = getStatus(emp.id, day);
                  const weekend = isWeekend(day);
                  return (
                    <td key={day} className={`p-1 text-center ${weekend ? 'bg-muted/30' : ''}`}>
                      {weekend ? (
                        <span className="text-muted-foreground/40">·</span>
                      ) : status ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[9px] font-bold ${statusColors[status]}`}>
                          {status}
                        </span>
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
        {[
          { status: 'P', label: 'Present', color: statusColors.P },
          { status: 'L', label: 'Leave', color: statusColors.L },
          { status: 'WFH', label: 'WFH', color: statusColors.WFH },
          { status: 'HD', label: 'Half Day', color: statusColors.HD },
          { status: 'A', label: 'Absent', color: statusColors.A },
        ].map(({ status, label, color }) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold ${color}`}>{status}</span>
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
