import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchEmployeeById } from '@/lib/employeeService';
import {
  fetchAttendanceRecords,
  fetchLeaveRequests,
  fetchPayrollRecords,
  fetchGeneratedDocuments,
  fetchLeaveBalances,
} from '@/lib/hrApi';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Employee, AttendanceRecord, LeaveRequest, PayrollRecord, GeneratedDocument, LeaveBalance } from '@/types/hr';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Edit, FileDown, Mail, Phone, MapPin, Building, Calendar, Briefcase, CreditCard, User, Globe, Shield, Loader2, ClipboardList, CheckCircle2, RotateCcw, Download } from 'lucide-react';

/** Default annual caps (align with Settings leave policy defaults) */
const LEAVE_CAP = { annual: 14, sick: 7, casual: 5 };

type OnboardingDoc = {
  id?: string;
  docType: string;
  label: string;
  fileName: string;
  uploadedAt?: string;
};

function calcTenure(joiningDate: string) {
  const v = String(joiningDate || '').trim();
  if (!v) return 'N/A';
  let joined: Date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    joined = new Date(v);
  } else {
    const parts = v.split('/');
    if (parts.length !== 3) return 'N/A';
    joined = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  }
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
  const { hasAccess } = useAuth();
  const { toast } = useToast();
  const canManage = hasAccess(['super_admin', 'hr_manager']);

  const [emp, setEmp] = useState<Employee | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [managerName, setManagerName] = useState<string>('—');
  const [empAttendance, setEmpAttendance] = useState<AttendanceRecord[]>([]);
  const [empLeaves, setEmpLeaves] = useState<LeaveRequest[]>([]);
  const [empPayroll, setEmpPayroll] = useState<PayrollRecord[]>([]);
  const [allGeneratedDocs, setAllGeneratedDocs] = useState<GeneratedDocument[]>([]);
  const [balance, setBalance] = useState<LeaveBalance | undefined>(undefined);
  const [onboardingResetting, setOnboardingResetting] = useState(false);
  const [onboardingDocs, setOnboardingDocs] = useState<OnboardingDoc[]>([]);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setEmp(null);
      return;
    }
    setLoading(true);
    fetchEmployeeById(id).then((dbEmp) => {
      setEmp(dbEmp);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!id || !canManage) {
      setOnboardingDocs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/onboarding/documents?employeeId=${encodeURIComponent(id)}`);
        if (!res.ok) return;
        const docs = await res.json();
        if (!cancelled) setOnboardingDocs(Array.isArray(docs) ? docs : []);
      } catch {
        if (!cancelled) setOnboardingDocs([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, canManage]);

  useEffect(() => {
    if (!emp?.reportingManagerId) {
      setManagerName('—');
      return;
    }
    const mid = emp.reportingManagerId;
    fetchEmployeeById(mid).then((m) => setManagerName(m?.fullName || '—'));
  }, [emp]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const [att, leaves, payroll, docs, balances] = await Promise.all([
        fetchAttendanceRecords(),
        fetchLeaveRequests(),
        fetchPayrollRecords(),
        fetchGeneratedDocuments(),
        fetchLeaveBalances(),
      ]);
      if (cancelled) return;
      setEmpAttendance(att.filter((a) => a.employeeId === id).slice(0, 20));
      setEmpLeaves(leaves.filter((l) => l.employeeId === id));
      setEmpPayroll(payroll.filter((p) => p.employeeId === id));
      setBalance(balances.find((x) => x.employeeId === id));
      setAllGeneratedDocs(docs);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const empDocs = allGeneratedDocs.filter(
    (d) => d.linkedTo === id || (emp != null && d.linkedTo === emp.fullName)
  );

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading employee...
    </div>
  );

  if (!emp) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground">Employee not found</p>
      <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate('/employees')}>Back to Employees</Button>
    </div>
  );

  const tenure = calcTenure(emp.joiningDate);
  const padId = typeof emp.id === 'string' && emp.id.length <= 5 ? emp.id.padStart(3, '0') : emp.id.slice(0, 8);
  const joiningYear = (() => {
    try {
      const raw = String(emp.joiningDate || '').trim();
      if (!raw) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(raw).getFullYear();
      return new Date(raw.split('/').reverse().join('-')).getFullYear();
    } catch {
      return '';
    }
  })();
  const empId = `GG-${joiningYear}-${padId}`;

  const onboardingStatus = (emp as unknown as Record<string, unknown>).onboardingComplete;
  const onboardingDone = onboardingStatus === true;
  const onboardingPending = onboardingStatus === false;

  async function resetOnboarding() {
    if (!id) return;
    setOnboardingResetting(true);
    try {
      const res = await apiFetch(`/api/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ onboardingComplete: false, onboardingStep: 0 }),
      });
      if (!res.ok) {
        toast({ title: 'Failed to reset onboarding', variant: 'destructive' });
        return;
      }
      const updated = await res.json();
      setEmp(updated);
      toast({ title: 'Onboarding reset', description: `${emp.fullName} will be shown the onboarding wizard on next login.` });
    } catch {
      toast({ title: 'Request failed', variant: 'destructive' });
    } finally {
      setOnboardingResetting(false);
    }
  }

  async function markOnboardingComplete() {
    if (!id) return;
    setOnboardingResetting(true);
    try {
      const res = await apiFetch(`/api/employees/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ onboardingComplete: true }),
      });
      if (!res.ok) { toast({ title: 'Failed', variant: 'destructive' }); return; }
      const updated = await res.json();
      setEmp(updated);
      toast({ title: 'Marked as complete', description: `${emp.fullName} can now access the dashboard.` });
    } catch {
      toast({ title: 'Request failed', variant: 'destructive' });
    } finally {
      setOnboardingResetting(false);
    }
  }

  async function downloadOnboardingDoc(docType: string) {
    if (!id) return;
    setDownloadingDoc(docType);
    try {
      const res = await apiFetch(`/api/onboarding/documents/${encodeURIComponent(docType)}/download?employeeId=${encodeURIComponent(id)}`);
      if (!res.ok) {
        toast({ title: 'Download failed', variant: 'destructive' });
        return;
      }
      const payload = await res.json() as { fileName?: string; mimeType?: string; data?: string };
      if (!payload?.data) {
        toast({ title: 'File not found', variant: 'destructive' });
        return;
      }
      const blob = await (await fetch(payload.data)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = payload.fileName || `${docType}.bin`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    } finally {
      setDownloadingDoc(null);
    }
  }

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
              <div className="flex flex-wrap gap-2 shrink-0 items-center">
                {/* Onboarding status badge */}
                {onboardingPending && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
                    <ClipboardList className="w-3 h-3" /> Onboarding Pending
                  </span>
                )}
                {onboardingDone && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    <CheckCircle2 className="w-3 h-3" /> Onboarding Done
                  </span>
                )}

                <Button variant="outline" onClick={() => navigate(`/employees/${id}/edit`)} className="gap-2 rounded-xl text-xs">
                  <Edit className="w-3.5 h-3.5" /> Edit Profile
                </Button>
                <Button className="gap-2 rounded-xl text-xs shadow-md shadow-primary/20">
                  <FileDown className="w-3.5 h-3.5" /> Export CV
                </Button>

                {/* HR onboarding controls */}
                {canManage && onboardingDone && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetOnboarding}
                    disabled={onboardingResetting}
                    className="gap-1.5 rounded-xl text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  >
                    {onboardingResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Require Onboarding
                  </Button>
                )}
                {canManage && onboardingPending && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={markOnboardingComplete}
                    disabled={onboardingResetting}
                    className="gap-1.5 rounded-xl text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  >
                    {onboardingResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Mark Complete
                  </Button>
                )}
                {canManage && onboardingStatus === null && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetOnboarding}
                    disabled={onboardingResetting}
                    className="gap-1.5 rounded-xl text-xs"
                  >
                    {onboardingResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardList className="w-3.5 h-3.5" />}
                    Send Onboarding
                  </Button>
                )}
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
                  <SideItem label="Line Manager" value={managerName} accent={managerName !== '—'} />
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
                    <LeaveBar label="Annual" used={LEAVE_CAP.annual - balance.annual} total={LEAVE_CAP.annual} color="bg-primary" />
                    <LeaveBar label="Sick" used={LEAVE_CAP.sick - balance.sick} total={LEAVE_CAP.sick} color="bg-info" />
                    <LeaveBar label="Casual" used={LEAVE_CAP.casual - balance.casual} total={LEAVE_CAP.casual} color="bg-accent" />
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
                  <TableHead className="text-xs font-semibold uppercase w-24">View</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empPayroll.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No payslips</TableCell></TableRow>
                ) : empPayroll.map(p => (
                  <TableRow key={p.id} className="border-border/30">
                    <TableCell className="text-sm font-medium">{p.month} {p.year}</TableCell>
                    <TableCell className="text-sm font-mono">LKR {p.baseSalary.toLocaleString()}</TableCell>
                    <TableCell className="text-sm font-mono text-destructive">-LKR {p.leaveDeductions.toLocaleString()}</TableCell>
                    <TableCell className="text-sm font-mono font-bold">LKR {p.netPayable.toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-8 text-xs rounded-lg" onClick={() => navigate(`/payroll/payslip/${p.id}`)}>
                        Payslip
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-0">
          <div className="space-y-4">
            {canManage && (
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Onboarding Documents Submitted By Employee
                  </h4>
                  <span className="text-xs text-muted-foreground">{onboardingDocs.length} file(s)</span>
                </div>
                <div className="space-y-2">
                  {onboardingDocs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No onboarding documents uploaded yet.</p>
                  ) : onboardingDocs.map((d) => (
                    <div key={d.id || `${d.docType}-${d.fileName}`} className="rounded-xl border border-border/50 bg-card/50 p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.label || d.docType}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {d.fileName}
                          {d.uploadedAt ? ` · ${new Date(d.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-xs gap-1.5"
                        onClick={() => void downloadOnboardingDoc(d.docType)}
                        disabled={downloadingDoc === d.docType}
                      >
                        {downloadingDoc === d.docType ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Download
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
