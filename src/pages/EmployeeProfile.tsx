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
      <Button variant="outline" className="mt-4" onClick={() => navigate('/employees')}>Back to Employees</Button>
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
            <Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2"><ArrowLeft className="w-4 h-4" /> Back</Button>
            <Button onClick={() => navigate(`/employees/${id}/edit`)} className="gap-2"><Edit className="w-4 h-4" /> Edit</Button>
          </div>
        }
      />

      {/* Profile Card */}
      <div className="bg-card rounded-lg border p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
            {emp.fullName.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /> {emp.email}</div>
            <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /> {emp.phone}</div>
            <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" /> {emp.address}</div>
            <div className="flex items-center gap-2 text-sm"><Building className="w-4 h-4 text-muted-foreground" /> {emp.department} • {emp.jobTitle}</div>
            <div className="text-sm"><span className="text-muted-foreground">Type:</span> <StatusBadge status={emp.type} /></div>
            <div className="text-sm"><span className="text-muted-foreground">Status:</span> <StatusBadge status={emp.status} /></div>
            <div className="text-sm"><span className="text-muted-foreground">Joined:</span> {emp.joiningDate}</div>
            <div className="text-sm"><span className="text-muted-foreground">Salary:</span> LKR {emp.salaryAmount.toLocaleString()} / {emp.salaryType === 'Per Session' ? 'session' : 'month'}</div>
            {manager && <div className="text-sm"><span className="text-muted-foreground">Reports to:</span> {manager.fullName}</div>}
          </div>
        </div>
      </div>

      {/* Leave Balance */}
      {balance && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{balance.annual}</p>
            <p className="text-xs text-muted-foreground">Annual Leave</p>
          </div>
          <div className="bg-card rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{balance.sick}</p>
            <p className="text-xs text-muted-foreground">Sick Leave</p>
          </div>
          <div className="bg-card rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold text-primary">{balance.casual}</p>
            <p className="text-xs text-muted-foreground">Casual Leave</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="attendance" className="bg-card rounded-lg border">
        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0">
          {['Attendance', 'Leave History', 'Payslips', 'Documents'].map(t => (
            <TabsTrigger key={t} value={t.toLowerCase().replace(' ', '-')} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">{t}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="attendance" className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {empAttendance.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No attendance records</TableCell></TableRow>
              ) : empAttendance.map((a, i) => (
                <TableRow key={i}><TableCell className="text-sm">{a.date}</TableCell><TableCell><StatusBadge status={a.status} /></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="leave-history" className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Dates</TableHead><TableHead>Days</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {empLeaves.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No leave history</TableCell></TableRow>
              ) : empLeaves.map(l => (
                <TableRow key={l.id}><TableCell className="text-sm">{l.leaveType}</TableCell><TableCell className="text-sm">{l.fromDate} - {l.toDate}</TableCell><TableCell className="text-sm">{l.days}</TableCell><TableCell><StatusBadge status={l.status} /></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="payslips" className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Base</TableHead><TableHead>Deductions</TableHead><TableHead>Net</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {empPayroll.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payslips</TableCell></TableRow>
              ) : empPayroll.map(p => (
                <TableRow key={p.id}><TableCell className="text-sm">{p.month} {p.year}</TableCell><TableCell className="text-sm">LKR {p.baseSalary.toLocaleString()}</TableCell><TableCell className="text-sm">LKR {p.leaveDeductions.toLocaleString()}</TableCell><TableCell className="text-sm font-medium">LKR {p.netPayable.toLocaleString()}</TableCell><TableCell><StatusBadge status={p.status} /></TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="documents" className="p-4">
          <Table>
            <TableHeader><TableRow><TableHead>Document</TableHead><TableHead>Type</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
            <TableBody>
              {empDocs.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No documents</TableCell></TableRow>
              ) : empDocs.map(d => (
                <TableRow key={d.id}><TableCell className="text-sm font-medium">{d.name}</TableCell><TableCell className="text-sm">{d.type}</TableCell><TableCell className="text-sm">{d.date}</TableCell></TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
