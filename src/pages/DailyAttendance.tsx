import { useState } from 'react';
import { employees } from '@/data/mockData';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Save } from 'lucide-react';
import { AttendanceStatus } from '@/types/hr';

export default function DailyAttendance() {
  const { toast } = useToast();
  const activeEmployees = employees.filter(e => e.status === 'Active');
  const [entries, setEntries] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(activeEmployees.map(e => [e.id, 'P']))
  );

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const handleSave = () => {
    toast({ title: '✅ Attendance saved', description: `Attendance for ${todayStr} has been saved successfully.` });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Daily Attendance" description={`Mark attendance for ${todayStr}`} />

      <div className="glass-card rounded-2xl p-3.5 mb-5 flex items-center gap-3 border-warning/30">
        <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <span className="text-sm">Today's attendance has not been finalized yet. Please mark all employees and save.</span>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Employee</TableHead>
              <TableHead>Department</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeEmployees.map(emp => (
              <TableRow key={emp.id} className="border-border/30">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {emp.fullName.split(' ').map(n => n[0]).join('')}
                    </div>
                    <span className="font-semibold text-sm">{emp.fullName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{emp.department}</TableCell>
                <TableCell>
                  <Select value={entries[emp.id]} onValueChange={v => setEntries(prev => ({ ...prev, [emp.id]: v as AttendanceStatus }))}>
                    <SelectTrigger className="w-36 rounded-xl h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="P">✅ Present</SelectItem>
                      <SelectItem value="L">🔴 Leave</SelectItem>
                      <SelectItem value="WFH">🏠 WFH</SelectItem>
                      <SelectItem value="HD">🟡 Half Day</SelectItem>
                      <SelectItem value="A">⚫ Absent</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="p-4 border-t border-border/50">
          <Button onClick={handleSave} className="rounded-xl gap-2 shadow-md shadow-primary/20">
            <Save className="w-4 h-4" /> Save All
          </Button>
        </div>
      </div>
    </div>
  );
}
