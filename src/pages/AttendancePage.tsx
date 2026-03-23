import { useState } from 'react';
import { employees, attendanceRecords } from '@/data/mockData';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AttendanceStatus } from '@/types/hr';
import { Download } from 'lucide-react';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AttendancePage() {
  const [month, setMonth] = useState(2); // March (0-indexed)
  const [year] = useState(2025);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const activeEmployees = employees.filter(e => e.status === 'Active');

  const getStatus = (empId: string, day: number): AttendanceStatus | undefined => {
    const dateStr = `${String(day).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}/${year}`;
    const record = attendanceRecords.find(a => a.employeeId === empId && a.date === dateStr);
    return record?.status;
  };

  const isWeekend = (day: number) => {
    const d = new Date(year, month, day);
    return d.getDay() === 0 || d.getDay() === 6;
  };

  const statusColors: Record<AttendanceStatus, string> = {
    P: 'bg-emerald-100 text-emerald-700',
    L: 'bg-red-100 text-red-700',
    WFH: 'bg-blue-100 text-blue-700',
    HD: 'bg-amber-100 text-amber-700',
    A: 'bg-gray-200 text-gray-500',
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Attendance"
        description="Monthly attendance overview"
        action={
          <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Export CSV</Button>
        }
      />

      <div className="flex gap-3 mb-4">
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2 sticky left-0 bg-card min-w-[140px] font-medium">Employee</th>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
                <th key={day} className={`p-1.5 text-center min-w-[32px] font-medium ${isWeekend(day) ? 'bg-muted/50' : ''}`}>
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map(emp => (
              <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-2 sticky left-0 bg-card font-medium">{emp.fullName}</td>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const status = getStatus(emp.id, day);
                  const weekend = isWeekend(day);
                  return (
                    <td key={day} className={`p-1 text-center ${weekend ? 'bg-muted/50' : ''}`}>
                      {weekend ? (
                        <span className="text-muted-foreground">-</span>
                      ) : status ? (
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-semibold ${statusColors[status]}`}>
                          {status}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-semibold">P</span> Present</div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-red-100 text-red-700 flex items-center justify-center text-[10px] font-semibold">L</span> Leave</div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-semibold">WFH</span> WFH</div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] font-semibold">HD</span> Half Day</div>
        <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded bg-gray-200 text-gray-500 flex items-center justify-center text-[10px] font-semibold">A</span> Absent</div>
      </div>
    </div>
  );
}
