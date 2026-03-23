import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employees as mockEmployees, attendanceRecords, leaveRequests, payrollRecords, generatedDocuments, leaveBalances } from '@/data/mockData';
import { fetchEmployeeById } from '@/lib/employeeService';
import { Employee } from '@/types/hr';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Edit, FileDown, Mail, Phone, MapPin, Building, Calendar, Briefcase, CreditCard, User, Globe, Shield, Loader2 } from 'lucide-react';

function calcTenure(joiningDate: string) {
  const parts = joiningDate.split('/');
  if (parts.length !== 3) return 'N/A';
  const joined = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  if (isNaN(joined.getTime())) return 'N/A';
  const now = new Date();
  const months = (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth());
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y > 0 ? `${y} Year${y > 1 ? 's' : ''}, ${m} Month${m !== 1 ? 's' : ''}` : `${m} Month${m !== 1 ? 's' : ''}`;
}

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
  const tenure = calcTenure(emp.joiningDate);
  const empId = `GG-${new Date(emp.joiningDate.split('/').reverse().join('-')).getFullYear()}-${emp.id.padStart(3, '0')}`;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button onClick={() => navigate('/')} className="hover:text-foreground transition-colors">Organization</button>
        <span>›</span>
        <button onClick={() => navigate('/employees')} className="hover:text-foreground transition-colors">Employees</button>
        <span>›</span>
        <span className="text-foreground font-medium">{emp.fullName}</span>
      </div>

      {/* Profile Header Card */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center text-primary text-3xl font-bold border-2 border-border/50">
              {emp.fullName.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="absolute -bottom-1 -left-1">
              <StatusBadge status={emp.status} />
            </div>
          </div>

          {/* Name & Quick Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">{emp.fullName}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                  <Briefcase className="w-3.5 h-3.5" /> {emp.jobTitle}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" onClick={() => navigate(`/employees/${id}/edit`)} className="gap-2 rounded-xl text-xs">
                  <Edit className="w-3.5 h-3.5" /> Edit Profile
                </Button>
                <Button className="gap-2 rounded-xl text-xs shadow-md shadow-primary/20">
                  <FileDown className="w-3.5 h-3.5" /> Export CV
                </Button>
              </div>
            </div>

            {/* Quick stats row */}
            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 text-xs">
              <div>
                <span className="text-muted-foreground uppercase tracking-wider font-semibold">Employee ID</span>
                <p className="font-mono font-semibold text-foreground mt-0.5">{empId}</p>
              </div>
              <div>
                <span className="text-muted-foreground uppercase tracking-wider font-semibold">Date Joined</span>
                <p className="font-mono font-semibold text-foreground mt-0.5">{emp.joiningDate}</p>
              </div>
              <div>
                <span className="text-muted-foreground uppercase tracking-wider font-semibold">Tenure</span>
                <p className="font-semibold text-foreground mt-0.5">{tenure}</p>
              </div>
              <div>
                <span className="text-muted-foreground uppercase tracking-wider font-semibold">Department</span>
                <p className="font-semibold text-foreground mt-0.5">{emp.department}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="glass-card rounded-2xl px-2">
          <TabsList className="w-full justify-start bg-transparent rounded-none h-auto p-0 gap-0">
            {['Overview', 'Attendance', 'Leave History', 'Payslips', 'Documents'].map(t => (
              <TabsTrigger
                key={t}
                value={t.toLowerCase().replace(' ', '-')}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs font-semibold py-3 px-5"
              >
                {t}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Personal + Compensation */}
            <div className="lg:col-span-2 space-y-6">
              {/* Personal Information */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-5">
                  <User className="w-4 h-4 text-primary" /> Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
                  <InfoItem label="Full Name" value={emp.fullName} />
                  <InfoItem label="Email Address" value={emp.email} icon={<Mail className="w-3.5 h-3.5" />} />
                  <InfoItem label="Phone Number" value={emp.phone} icon={<Phone className="w-3.5 h-3.5" />} />
                  <InfoItem label="Nationality" value={emp.nationality} icon={<Globe className="w-3.5 h-3.5" />} />
                  <InfoItem label="Passport / NIC" value={emp.passportNumber || '—'} icon={<Shield className="w-3.5 h-3.5" />} />
                  <InfoItem label="Department" value={emp.department} icon={<Building className="w-3.5 h-3.5" />} />
                  <InfoItem label="Date of Birth" value={emp.dateOfBirth} icon={<Calendar className="w-3.5 h-3.5" />} />
                  <InfoItem label="Address" value={emp.address} icon={<MapPin className="w-3.5 h-3.5" />} />
                </div>
              </div>

              {/* Compensation & Banking */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-5">
                  <CreditCard className="w-4 h-4 text-primary" /> Compensation & Banking
                </h3>
                <div className="flex flex-wrap items-center gap-6 mb-6 p-4 rounded-xl bg-gradient-to-r from-primary/5 to-accent/5 border border-border/30">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Salary Type</p>
                    <p className="text-sm font-bold mt-1">{emp.salaryType}</p>
                  </div>
                  <div className="h-8 w-px bg-border/50" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                      {emp.salaryType === 'Per Session' ? 'Rate Per Session' : 'Monthly Amount'}
                    </p>
                    <p className="text-xl font-bold mt-1 flex items-baseline gap-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-bold">LKR</span>
                      {emp.salaryAmount.toLocaleString()}.00
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-8">
                  <InfoItem label="Bank Name" value={emp.bankName} />
                  <InfoItem label="Account Number" value={emp.accountNumber} />
                  <InfoItem label="Account Holder" value={emp.accountHolderName} />
                </div>
              </div>
            </div>

            {/* Right Column - Employment Status & Leave */}
            <div className="space-y-6">
              {/* Employment Status */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest mb-5">Employment Status</h3>
                <div className="space-y-4">
                  <SideItem label="Contract Type" value={emp.type} accent />
                  <SideItem label="Status" value={emp.status} accent />
                  <SideItem label="Joining Date" value={emp.joiningDate} />
                  <SideItem label="Line Manager" value={manager?.fullName || '—'} accent={!!manager} />
                  <SideItem label="Salary Type" value={emp.salaryType} />
                </div>
              </div>

              {/* Leave Balance */}
              {balance && (
                <div className="glass-card rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Annual Leave</h3>
                    <span className="text-xs text-muted-foreground">
                      Balance: <span className="font-bold text-foreground">{balance.annual + balance.sick + balance.casual} Days</span>
                    </span>
                  </div>
                  <div className="space-y-3">
                    <LeaveBar label="Annual" used={14 - balance.annual} total={14} color="bg-primary" />
                    <LeaveBar label="Sick" used={7 - balance.sick} total={7} color="bg-info" />
                    <LeaveBar label="Casual" used={7 - balance.casual} total={7} color="bg-accent" />
                  </div>
                  <button
                    onClick={() => navigate('/leaves')}
                    className="text-xs text-primary hover:underline mt-4 block font-medium"
                  >
                    View Leave Calendar →
                  </button>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="mt-0">
          <div className="glass-card rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Clock In</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Clock Out</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Hours</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empAttendance.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No attendance records</TableCell></TableRow>
                ) : empAttendance.map((a, i) => (
                  <TableRow key={i} className="border-border/30">
                    <TableCell className="text-sm font-mono">{a.date}</TableCell>
                    <TableCell className="text-sm font-mono">{a.clockIn || '—'}</TableCell>
                    <TableCell className="text-sm font-mono">{a.clockOut || '—'}</TableCell>
                    <TableCell className="text-sm font-mono">{a.totalHours ? `${a.totalHours.toFixed(1)}h` : '—'}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Leave History Tab */}
        <TabsContent value="leave-history" className="mt-0">
          <div className="glass-card rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Dates</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Days</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Approved By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empLeaves.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No leave history</TableCell></TableRow>
                ) : empLeaves.map(l => (
                  <TableRow key={l.id} className="border-border/30">
                    <TableCell className="text-sm font-medium">{l.leaveType}</TableCell>
                    <TableCell className="text-sm font-mono">{l.fromDate} — {l.toDate}</TableCell>
                    <TableCell className="text-sm font-bold">{l.days}</TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{l.approvedByName || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Payslips Tab */}
        <TabsContent value="payslips" className="mt-0">
          <div className="glass-card rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="text-xs font-semibold uppercase">Month</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Base Salary</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Deductions</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Net Pay</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empPayroll.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No payslips</TableCell></TableRow>
                ) : empPayroll.map(p => (
                  <TableRow key={p.id} className="border-border/30">
                    <TableCell className="text-sm font-medium">{p.month} {p.year}</TableCell>
                    <TableCell className="text-sm font-mono">LKR {p.baseSalary.toLocaleString()}</TableCell>
                    <TableCell className="text-sm font-mono text-destructive">-LKR {p.leaveDeductions.toLocaleString()}</TableCell>
                    <TableCell className="text-sm font-mono font-bold">LKR {p.netPayable.toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-0">
          <div className="glass-card rounded-2xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border/50">
                  <TableHead className="text-xs font-semibold uppercase">Document</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empDocs.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground">No documents</TableCell></TableRow>
                ) : empDocs.map(d => (
                  <TableRow key={d.id} className="border-border/30">
                    <TableCell className="text-sm font-semibold">{d.name}</TableCell>
                    <TableCell className="text-sm">{d.type}</TableCell>
                    <TableCell className="text-sm font-mono">{d.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* Helper components */
function InfoItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-medium text-foreground mt-1 flex items-center gap-1.5">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        {value}
      </p>
    </div>
  );
}

function SideItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</span>
    </div>
  );
}

function LeaveBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = Math.min((used / total) * 100, 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-[11px] text-muted-foreground">{used}/{total} used</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
