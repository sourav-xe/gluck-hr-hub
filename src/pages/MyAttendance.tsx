import { attendanceRecords } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarCheck, CalendarOff, Laptop, Clock } from 'lucide-react';

export default function MyAttendance() {
  const { user } = useAuth();
  const myRecords = attendanceRecords.filter(a => a.employeeId === user.employeeId).slice(0, 30);

  const present = myRecords.filter(a => a.status === 'P').length;
  const leave = myRecords.filter(a => a.status === 'L').length;
  const wfh = myRecords.filter(a => a.status === 'WFH').length;
  const halfDay = myRecords.filter(a => a.status === 'HD').length;

  return (
    <div className="animate-fade-in">
      <PageHeader title="My Attendance" description="Your personal attendance records" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Present" value={present} icon={<CalendarCheck className="w-5 h-5" />} />
        <StatCard title="Leave Days" value={leave} icon={<CalendarOff className="w-5 h-5" />} />
        <StatCard title="WFH Days" value={wfh} icon={<Laptop className="w-5 h-5" />} />
        <StatCard title="Half Days" value={halfDay} icon={<Clock className="w-5 h-5" />} />
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {myRecords.map((a, i) => (
              <TableRow key={i}><TableCell className="text-sm">{a.date}</TableCell><TableCell><StatusBadge status={a.status} /></TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
