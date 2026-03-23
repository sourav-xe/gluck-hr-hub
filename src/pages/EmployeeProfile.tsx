import { useParams, useNavigate } from 'react-router-dom';
import { employees, attendanceRecords, leaveRequests, payrollRecords, generatedDocuments, leaveBalances } from '@/data/mockData';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, Mail, Phone, MapPin, Building } from 'lucide-react';

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const emp = employees.find(e => e.id === id);

  if (!emp) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Employee not found</p>
      <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate('/employees')}>Back to Employees</Button>
    </div>
  );

  const empAttendance = attendanceRecords.filter(a => a.employeeId === id).slice(0, 20);
  const empLeaves = leaveRequests.filter(l => l.employeeId === id);
  const empPayroll = payrollRecords.filter(p => p.employeeId === id);
  const empDocs = generatedDocuments.filter(d => d.linkedTo === emp.fullName);
  const balance = leaveBalances.find(b => b.employeeId === id);
  const manager = emp.reportingManagerId ? employees.find(e => e.id === emp.reportingManagerId) : undefined;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={emp.fullName}
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2 rounded-xl"><ArrowLeft className="w-4 h-4" /> Back</Button>
            <Button onClick={() => navigate(`/employees/${id}/edit`)} className="gap-2 rounded-xl shadow-md shadow-primary/20"><Edit className="w-4 h-4" /> Edit</Button>
          </div>
        }
      />

      {/* Profile Card */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary text-2xl font-bold">
            {emp.fullName.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /> {emp.email}</div>
            <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {emp.phone}</div>
            <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" /> {emp.address}</div>
            <div className="flex items-center gap-2 text-sm"><Building className="w-4 h-4 text-muted-foreground" /> {emp.department} • {emp.jobTitle}</div>
            <div className="text-sm flex items-center gap-2"><span className="text-muted-foreground">Type:</span> <StatusBadge status={emp.type} /></div>
            <div className="text-sm flex items-center gap-2"><span className="text-muted-foreground">Status:</span> <StatusBadge status={emp.status} /></div>
            <div className="text-sm"><span className="text-muted-foreground">Joined:</span> <span className="font-mono">{emp.joiningDate}</span></div>
            <div className="text-sm"><span className="text-muted-foreground">Salary:</span> <span className="font-semibold">LKR {emp.salaryAmount.toLocaleString()}</span> / {emp.salaryType === 'Per Session' ? 'session' : 'month'}</div>
            {manager && <div className="text-sm"><span className="text-muted-foreground">Reports to:</span> {manager.fullName}</div>}
          </div>
        </div>
      </div>

      {/* Leave Balance */}
      {balance && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Annual Leave', value: balance.annual, color: 'from-primary/15 to-primary/5' },
            { label: 'Sick Leave', value: balance.sick, color: 'from-info/15 to-info/5' },
            { label: 'Casual Leave', value: balance.casual, color: 'from-accent/15 to-accent/5' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`glass-card rounded-2xl p-4 text-center bg-gradient-to-br ${color}`}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <Tabs defaultValue="attendance">
          <TabsList className="w-full justify-start border-b border-border/50 rounded-none h-auto p-0 bg-transparent">
            {['Attendance', 'Leave History', 'Payslips', 'Documents'].map(t => (
              <TabsTrigger key={t} value={t.toLowerCase().replace(' ', '-')} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent text-xs font-semibold py-3 px-4">{t}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="attendance" className="p-4">
            <Table>
              <TableHeader><TableRow className="border-border/50"><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {empAttendance.length === 0 ? (
                  <TableRow><TableCell colSpan={2} className="text-center py-12 text-muted-foreground">No attendance records</TableCell></TableRow>
                ) : empAttendance.map((a, i) => (
                  <TableRow key={i} className="border-border/30"><TableCell className="text-sm font-mono">{a.date}</TableCell><TableCell><StatusBadge status={a.status} /></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="leave-history" className="p-4">
            <Table>
              <TableHeader><TableRow className="border-border/50"><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {empLeaves.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">No leave history</TableCell></TableRow>
                ) : empLeaves.map(l => (
                  <TableRow key={l.id} className="border-border/30"><TableCell className="text-sm">{l.leaveType}</TableCell><TableCell className="text-sm font-mono">{l.fromDate} - {l.toDate}</TableCell><TableCell className="text-sm font-bold">{l.days}</TableCell><TableCell><StatusBadge status={l.status} /></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="payslips" className="p-4">
            <Table>
              <TableHeader><TableRow className="border-border/50"><TableHead>Month</TableHead><TableHead>Base</TableHead><TableHead>Deductions</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {empPayroll.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No payslips</TableCell></TableRow>
                ) : empPayroll.map(p => (
                  <TableRow key={p.id} className="border-border/30"><TableCell className="text-sm">{p.month} {p.year}</TableCell><TableCell className="text-sm font-mono">LKR {p.baseSalary.toLocaleString()}</TableCell><TableCell className="text-sm font-mono text-destructive">LKR {p.leaveDeductions.toLocaleString()}</TableCell><TableCell className="text-sm font-mono font-bold">LKR {p.netPayable.toLocaleString()}</TableCell><TableCell><StatusBadge status={p.status} /></TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="documents" className="p-4">
            <Table>
              <TableHeader><TableRow className="border-border/50"><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
              <TableBody>
                {empDocs.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">No documents</TableCell></TableRow>
                ) : empDocs.map(d => (
                  <TableRow key={d.id} className="border-border/30"><TableCell className="text-sm font-semibold">{d.name}</TableCell><TableCell className="text-sm">{d.type}</TableCell><TableCell className="text-sm font-mono">{d.date}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
