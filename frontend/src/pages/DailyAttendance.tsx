import { useState, useEffect, useCallback } from 'react';
import { fetchEmployees } from '@/lib/employeeService';
import { postAttendanceBulk } from '@/lib/hrApi';
import { Employee, AttendanceRecord, AttendanceStatus } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Save, Loader2 } from 'lucide-react';

export default function DailyAttendance() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<Record<string, AttendanceStatus>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchEmployees();
    const active = list.filter((e) => e.status === 'Active');
    setEmployees(active);
    setEntries(Object.fromEntries(active.map((e) => [e.id, 'P' as AttendanceStatus])));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

  const handleSave = async () => {
    setSaving(true);
    const records: AttendanceRecord[] = employees.map((emp) => ({
      employeeId: emp.id,
      date: todayStr,
      status: entries[emp.id] || 'P',
    }));
    const ok = await postAttendanceBulk(records);
    setSaving(false);
    if (ok) {
      toast({ title: 'Attendance saved', description: `Stored in database for ${todayStr}.` });
    } else {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Daily Attendance" description={`Mark attendance for ${todayStr}`} />

      <div className="glass-card rounded-2xl p-3.5 mb-5 flex items-center gap-3 border-warning/30">
        <div className="w-8 h-8 rounded-lg bg-warning/15 flex items-center justify-center">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <span className="text-sm">Mark each employee and save — data is written to MongoDB.</span>
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
            {employees.map((emp) => (
              <TableRow key={emp.id} className="border-border/30">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {emp.fullName.split(' ').map((n) => n[0]).join('')}
                    </div>
                    <span className="font-semibold text-sm">{emp.fullName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{emp.department}</TableCell>
                <TableCell>
                  <Select
                    value={entries[emp.id] || 'P'}
                    onValueChange={(v) => setEntries((prev) => ({ ...prev, [emp.id]: v as AttendanceStatus }))}
                  >
                    <SelectTrigger className="w-36 rounded-xl h-9">
                      <SelectValue />
                    </SelectTrigger>
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
          <Button onClick={() => void handleSave()} disabled={saving} className="rounded-xl gap-2 shadow-md shadow-primary/20">
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save All'}
          </Button>
        </div>
      </div>
    </div>
  );
}
