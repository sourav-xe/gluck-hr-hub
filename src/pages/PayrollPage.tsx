import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employees, payrollRecords } from '@/data/mockData';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Play, DollarSign } from 'lucide-react';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function PayrollPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [month, setMonth] = useState('March');
  const [year] = useState(2025);
  const [breakdownId, setBreakdownId] = useState<string | null>(null);

  const filtered = payrollRecords.filter(p => p.month === month && p.year === year);
  const freelancers = employees.filter(e => e.type === 'Freelancer');
  const breakdownRecord = breakdownId ? payrollRecords.find(p => p.id === breakdownId) : null;
  const breakdownEmp = breakdownRecord ? employees.find(e => e.id === breakdownRecord.employeeId) : null;

  const handleMarkPaid = (id: string) => {
    const record = payrollRecords.find(p => p.id === id);
    const emp = record ? employees.find(e => e.id === record.employeeId) : null;
    toast({ title: 'Salary marked as paid', description: `Salary email sent to ${emp?.fullName}` });
  };

  const handleRunPayroll = () => {
    toast({ title: 'Payroll calculated', description: `Payroll for ${month} ${year} has been calculated for all employees.` });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Payroll"
        description="Manage monthly salary payments"
        action={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2"><Download className="w-4 h-4" /> Export</Button>
            <Button onClick={handleRunPayroll} className="gap-2"><Play className="w-4 h-4" /> Run Payroll</Button>
          </div>
        }
      />

      <div className="flex gap-3 mb-4">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="freelancers">Freelancers</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <div className="bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
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
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No payroll records for this month. Click "Run Payroll" to calculate.</TableCell></TableRow>
                ) : filtered.map(p => {
                  const emp = employees.find(e => e.id === p.employeeId);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-sm">{emp?.fullName}</TableCell>
                      <TableCell className="text-sm hidden sm:table-cell">LKR {p.baseSalary.toLocaleString()}</TableCell>
                      <TableCell className="text-sm hidden md:table-cell">LKR {p.leaveDeductions.toLocaleString()}</TableCell>
                      <TableCell className="text-sm hidden md:table-cell">LKR {p.bonus.toLocaleString()}</TableCell>
                      <TableCell className="text-sm font-semibold">LKR {p.netPayable.toLocaleString()}</TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setBreakdownId(p.id)}>View</Button>
                          {p.status === 'Unpaid' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleMarkPaid(p.id)}>
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
          <div className="bg-card rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rate Type</TableHead>
                  <TableHead>Sessions/Hours</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {freelancers.map(f => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium text-sm">{f.fullName}</TableCell>
                    <TableCell className="text-sm">{f.salaryType}</TableCell>
                    <TableCell className="text-sm">12</TableCell>
                    <TableCell className="text-sm font-semibold">LKR {(f.salaryAmount * 12).toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status="Unpaid" /></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toast({ title: 'Payment marked', description: `Payment sent to ${f.fullName}` })}>
                        <DollarSign className="w-3 h-3" /> Mark Paid
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Breakdown Modal */}
      <Dialog open={!!breakdownId} onOpenChange={() => setBreakdownId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salary Breakdown</DialogTitle></DialogHeader>
          {breakdownRecord && breakdownEmp && (
            <div className="space-y-3">
              <div className="flex justify-between text-sm"><span>Employee</span><span className="font-medium">{breakdownEmp.fullName}</span></div>
              <div className="flex justify-between text-sm"><span>Month</span><span>{breakdownRecord.month} {breakdownRecord.year}</span></div>
              <hr />
              <div className="flex justify-between text-sm"><span>Base Salary</span><span>LKR {breakdownRecord.baseSalary.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span>Leave Deductions</span><span className="text-destructive">- LKR {breakdownRecord.leaveDeductions.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span>Bonus</span><span className="text-emerald-600">+ LKR {breakdownRecord.bonus.toLocaleString()}</span></div>
              <hr />
              <div className="flex justify-between font-semibold"><span>Net Payable</span><span>LKR {breakdownRecord.netPayable.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm text-muted-foreground"><span>Bank</span><span>{breakdownEmp.bankName} - {breakdownEmp.accountNumber}</span></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => navigate(`/payroll/payslip/${breakdownId}`)}>View Payslip</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
