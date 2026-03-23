import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employees, payrollRecords as initialPayroll, attendanceRecords, leaveRequests } from '@/data/mockData';
import { PayrollRecord } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Play, DollarSign, Eye, FileText } from 'lucide-react';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const monthToIndex: Record<string, number> = {};
months.forEach((m, i) => monthToIndex[m] = i);

export default function PayrollPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [month, setMonth] = useState('March');
  const [year] = useState(2025);
  const [records, setRecords] = useState<PayrollRecord[]>(initialPayroll);
  const [breakdownId, setBreakdownId] = useState<string | null>(null);
  const [freelancerSessions, setFreelancerSessions] = useState<Record<string, number>>({ '3': 12 });
  const [freelancerStatuses, setFreelancerStatuses] = useState<Record<string, 'Unpaid' | 'Paid'>>({});

  const filtered = records.filter(p => p.month === month && p.year === year);
  const freelancers = employees.filter(e => e.type === 'Freelancer');
  const breakdownRecord = breakdownId ? records.find(p => p.id === breakdownId) : null;
  const breakdownEmp = breakdownRecord ? employees.find(e => e.id === breakdownRecord.employeeId) : null;

  const totalPayable = filtered.reduce((s, p) => s + p.netPayable, 0);
  const totalPaid = filtered.filter(p => p.status === 'Paid').reduce((s, p) => s + p.netPayable, 0);

  const handleMarkPaid = (id: string) => {
    setRecords(prev => prev.map(p =>
      p.id === id ? { ...p, status: 'Paid' as const } : p
    ));
    const record = records.find(p => p.id === id);
    const emp = record ? employees.find(e => e.id === record.employeeId) : null;
    toast({ title: '✅ Salary marked as paid', description: `Payment notification sent to ${emp?.fullName}` });
  };

  const handleRunPayroll = useCallback(() => {
    const monthIdx = monthToIndex[month];
    const fullTimeEmps = employees.filter(e => e.type !== 'Freelancer' && e.status === 'Active');

    const existingIds = records.filter(p => p.month === month && p.year === year).map(p => p.employeeId);
    const newRecords: PayrollRecord[] = [];

    fullTimeEmps.forEach(emp => {
      // Count unpaid leaves for this employee in this month
      const empLeaves = leaveRequests.filter(l => {
        if (l.employeeId !== emp.id || l.status !== 'Approved') return false;
        if (l.leaveType !== 'Unpaid') return false;
        const [fd, fm] = l.fromDate.split('/').map(Number);
        return fm - 1 === monthIdx;
      });
      const unpaidLeaveDays = empLeaves.reduce((sum, l) => sum + l.days, 0);

      // Count absent days from attendance
      const empAttendance = attendanceRecords.filter(a => {
        if (a.employeeId !== emp.id) return false;
        const [, am] = a.date.split('/').map(Number);
        return am - 1 === monthIdx;
      });
      const absentDays = empAttendance.filter(a => a.status === 'A').length;
      const halfDays = empAttendance.filter(a => a.status === 'HD').length;

      // Working days in month (approx 22)
      const workingDays = 22;
      const dailyRate = emp.salaryAmount / workingDays;
      const leaveDeductions = Math.round((unpaidLeaveDays + absentDays + halfDays * 0.5) * dailyRate);
      const bonus = emp.id === '1' && month === 'March' ? 5000 : 0;
      const netPayable = emp.salaryAmount - leaveDeductions + bonus;

      if (existingIds.includes(emp.id)) {
        // Update existing record
        const idx = records.findIndex(p => p.employeeId === emp.id && p.month === month && p.year === year);
        if (idx >= 0) {
          newRecords.push({ ...records[idx], baseSalary: emp.salaryAmount, leaveDeductions, bonus, netPayable });
        }
      } else {
        // Create new record
        newRecords.push({
          id: `P-${month}-${emp.id}`,
          employeeId: emp.id,
          month,
          year,
          baseSalary: emp.salaryAmount,
          leaveDeductions,
          bonus,
          netPayable,
          status: 'Unpaid',
        });
      }
    });

    setRecords(prev => {
      const others = prev.filter(p => !(p.month === month && p.year === year));
      return [...others, ...newRecords];
    });

    toast({ title: '🧮 Payroll calculated', description: `Payroll for ${month} ${year} has been calculated for ${fullTimeEmps.length} employees.` });
  }, [month, year, records, toast]);

  const handleExport = () => {
    const csv = [
      'Employee,Base Salary,Deductions,Bonus,Net Payable,Status',
      ...filtered.map(p => {
        const emp = employees.find(e => e.id === p.employeeId);
        return `${emp?.fullName},${p.baseSalary},${p.leaveDeductions},${p.bonus},${p.netPayable},${p.status}`;
      })
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${month}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: '📥 Exported', description: 'Payroll CSV downloaded.' });
  };

  const handleMarkFreelancerPaid = (empId: string) => {
    setFreelancerStatuses(prev => ({ ...prev, [empId]: 'Paid' }));
    const emp = employees.find(e => e.id === empId);
    toast({ title: '✅ Payment marked', description: `Payment notification sent to ${emp?.fullName}` });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Payroll"
        description="Manage monthly salary payments"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={handleExport}><Download className="w-4 h-4" /> Export</Button>
            <Button onClick={handleRunPayroll} className="gap-2 rounded-xl shadow-md shadow-primary/20"><Play className="w-4 h-4" /> Run Payroll</Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary"><DollarSign className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Payable</p>
            <p className="text-lg font-bold">LKR {totalPayable.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success"><DollarSign className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Paid</p>
            <p className="text-lg font-bold text-success">LKR {totalPaid.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning"><DollarSign className="w-5 h-5" /></div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Pending</p>
            <p className="text-lg font-bold text-warning">LKR {(totalPayable - totalPaid).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-5">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40 rounded-xl h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center text-sm text-muted-foreground font-mono">{year}</div>
      </div>

      <Tabs defaultValue="employees">
        <TabsList className="rounded-xl bg-muted/50 p-1 mb-4">
          <TabsTrigger value="employees" className="rounded-lg text-xs font-semibold">Employees</TabsTrigger>
          <TabsTrigger value="freelancers" className="rounded-lg text-xs font-semibold">Freelancers</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <div className="glass-card rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Employee</TableHead>
                  <TableHead className="hidden sm:table-cell">Base Salary</TableHead>
                  <TableHead className="hidden md:table-cell">Deductions</TableHead>
                  <TableHead className="hidden md:table-cell">Bonus</TableHead>
                  <TableHead>Net Payable</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No payroll records for {month}. Click <strong>"Run Payroll"</strong> to calculate.
                  </TableCell></TableRow>
                ) : filtered.map(p => {
                  const emp = employees.find(e => e.id === p.employeeId);
                  return (
                    <TableRow key={p.id} className="border-border/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold">
                            {emp?.fullName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-semibold text-sm">{emp?.fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm hidden sm:table-cell font-mono">LKR {p.baseSalary.toLocaleString()}</TableCell>
                      <TableCell className="text-sm hidden md:table-cell font-mono text-destructive">
                        {p.leaveDeductions > 0 ? `- LKR ${p.leaveDeductions.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-sm hidden md:table-cell font-mono text-success">
                        {p.bonus > 0 ? `+ LKR ${p.bonus.toLocaleString()}` : '-'}
                      </TableCell>
                      <TableCell className="text-sm font-bold font-mono">LKR {p.netPayable.toLocaleString()}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => setBreakdownId(p.id)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" onClick={() => navigate(`/payroll/payslip/${p.id}`)}>
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                          {p.status === 'Unpaid' && (
                            <Button size="sm" variant="outline" className="h-8 text-xs gap-1 rounded-lg" onClick={() => handleMarkPaid(p.id)}>
                              <DollarSign className="w-3 h-3" /> Pay
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="freelancers">
          <div className="glass-card rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead>Sessions/Hours</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {freelancers.map(f => {
                  const sessions = freelancerSessions[f.id] || 0;
                  const amount = f.salaryAmount * sessions;
                  const status = freelancerStatuses[f.id] || 'Unpaid';
                  return (
                    <TableRow key={f.id} className="border-border/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center text-info text-[11px] font-bold">
                            {f.fullName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-semibold text-sm">{f.fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{f.salaryType}</TableCell>
                      <TableCell className="text-sm font-mono">{sessions}</TableCell>
                      <TableCell className="text-sm font-bold font-mono">LKR {amount.toLocaleString()}</TableCell>
                      <TableCell><StatusBadge status={status} /></TableCell>
                      <TableCell>
                        {status === 'Unpaid' ? (
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1 rounded-lg" onClick={() => handleMarkFreelancerPaid(f.id)}>
                            <DollarSign className="w-3 h-3" /> Mark Paid
                          </Button>
                        ) : (
                          <span className="text-xs text-success font-semibold">✓ Paid</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Breakdown Modal */}
      <Dialog open={!!breakdownId} onOpenChange={() => setBreakdownId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="text-lg font-bold">Salary Breakdown</DialogTitle></DialogHeader>
          {breakdownRecord && breakdownEmp && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {breakdownEmp.fullName.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="font-semibold">{breakdownEmp.fullName}</p>
                  <p className="text-xs text-muted-foreground">{breakdownRecord.month} {breakdownRecord.year}</p>
                </div>
              </div>
              <div className="glass-card rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Base Salary</span><span className="font-mono font-semibold">LKR {breakdownRecord.baseSalary.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Leave Deductions</span><span className="font-mono text-destructive">- LKR {breakdownRecord.leaveDeductions.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Bonus</span><span className="font-mono text-success">+ LKR {breakdownRecord.bonus.toLocaleString()}</span></div>
                <hr className="border-border/50" />
                <div className="flex justify-between font-bold"><span>Net Payable</span><span className="font-mono">LKR {breakdownRecord.netPayable.toLocaleString()}</span></div>
              </div>
              <div className="text-xs text-muted-foreground pt-2">
                <span className="font-medium">Bank:</span> {breakdownEmp.bankName} • A/C: {breakdownEmp.accountNumber}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate(`/payroll/payslip/${breakdownId}`)} className="rounded-xl">View Payslip</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
