import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEmployees } from '@/lib/employeeService';
import { apiFetch } from '@/lib/api';
import {
  fetchLeaveRequests,
  fetchAttendanceRecords,
  fetchPayrollRecords,
  postPayrollBulkUpsert,
  patchPayrollRecord,
  markAllPayrollPaidForMonth,
} from '@/lib/hrApi';
import { Employee, PayrollRecord } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Download, Play, DollarSign, Eye, FileText, CheckCircle2, Loader2, Pencil } from 'lucide-react';
import type { LeaveRequest, AttendanceRecord } from '@/types/hr';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthToIndex: Record<string, number> = {};
months.forEach((m, i) => {
  monthToIndex[m] = i;
});

export default function PayrollPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [month, setMonth] = useState('March');
  const [year, setYear] = useState(2025);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [breakdownId, setBreakdownId] = useState<string | null>(null);
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null);
  const [freelancerSessions, setFreelancerSessions] = useState<Record<string, number>>({});
  const [freelancerStatuses, setFreelancerStatuses] = useState<Record<string, 'Unpaid' | 'Paid'>>({});

  // Payslip DOCX template (same storage as Auto-Docs: /api/doc-simple-templates)
  const [payslipTemplatesLoading, setPayslipTemplatesLoading] = useState(false);
  const [payslipTemplates, setPayslipTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPayslipTemplateId, setSelectedPayslipTemplateId] = useState<string>('');
  const [payslipTemplateFile, setPayslipTemplateFile] = useState<File | null>(null);
  const [payslipTemplateUploading, setPayslipTemplateUploading] = useState(false);
  const [payslipTemplateName, setPayslipTemplateName] = useState('Payslip Template');
  const [payslipDownloadFormat, setPayslipDownloadFormat] = useState<'docx' | 'pdf'>('docx');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPayslipTemplatesLoading(true);
      try {
        const res = await apiFetch('/api/doc-simple-templates');
        if (!res.ok) return;
        const data = (await res.json()) as Array<{ id: string; name: string }>;
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setPayslipTemplates(list);
        setSelectedPayslipTemplateId((prev) => prev || list[0]?.id || '');
      } catch {
        if (!cancelled) setPayslipTemplates([]);
      } finally {
        if (!cancelled) setPayslipTemplatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPayslipTemplates = async () => {
    setPayslipTemplatesLoading(true);
    try {
      const res = await apiFetch('/api/doc-simple-templates');
      if (!res.ok) return;
      const data = (await res.json()) as Array<{ id: string; name: string }>;
      const list = Array.isArray(data) ? data : [];
      setPayslipTemplates(list);
      setSelectedPayslipTemplateId(list[0]?.id || '');
    } finally {
      setPayslipTemplatesLoading(false);
    }
  };

  const handleUploadPayslipTemplate = async () => {
    if (!payslipTemplateFile) {
      toast({ title: 'Select a DOCX file', description: 'Upload a payslip template DOCX first.', variant: 'destructive' });
      return;
    }
    setPayslipTemplateUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', payslipTemplateFile);
      fd.append('templateName', (payslipTemplateName || 'Payslip Template').trim());
      const res = await apiFetch('/api/doc-simple-templates', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast({ title: 'Upload failed', description: data?.error || 'Server rejected upload.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Payslip template uploaded', description: 'Template saved. Use the doc icon to generate slips.' });
      setPayslipTemplateFile(null);
      await refreshPayslipTemplates();
    } catch (e: unknown) {
      toast({ title: 'Upload failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setPayslipTemplateUploading(false);
    }
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [emps, leaves, att, pay] = await Promise.all([
        fetchEmployees(),
        fetchLeaveRequests(),
        fetchAttendanceRecords(),
        fetchPayrollRecords(month, year),
      ]);
      if (cancel) return;
      setEmployees(emps);
      setLeaveRequests(leaves);
      setAttendanceRecords(att);
      setRecords(pay);
      setLoading(false);
    })();
    return () => {
      cancel = true;
    };
  }, [month, year]);

  const filtered = records.filter((p) => p.month === month && p.year === year);
  const freelancers = employees.filter((e) => e.type === 'Freelancer');
  const breakdownRecord = breakdownId ? records.find((p) => p.id === breakdownId) : null;
  const breakdownEmp = breakdownRecord ? employees.find((e) => e.id === breakdownRecord.employeeId) : null;

  const totalPayable = filtered.reduce((s, p) => s + p.netPayable, 0);
  const totalPaid = filtered.filter((p) => p.status === 'Paid').reduce((s, p) => s + p.netPayable, 0);
  const paidCount = filtered.filter((p) => p.status === 'Paid').length;

  const handleMarkPaid = async (id: string) => {
    const updated = await patchPayrollRecord(id, { status: 'Paid' });
    if (updated) {
      setRecords((prev) => prev.map((p) => (p.id === id ? updated : p)));
      const record = records.find((p) => p.id === id);
      const emp = record ? employees.find((e) => e.id === record.employeeId) : null;
      toast({ title: 'Salary marked as paid', description: emp ? `Recorded for ${emp.fullName}` : 'Saved' });
    } else {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
    setConfirmPayId(null);
  };

  const handleRunPayroll = useCallback(async () => {
    const monthIdx = monthToIndex[month];
    const fullTimeEmps = employees.filter((e) => e.type !== 'Freelancer' && e.status === 'Active');
    const existingForMonth = records.filter((p) => p.month === month && p.year === year);
    const payload: Omit<PayrollRecord, 'id'>[] = [];

    fullTimeEmps.forEach((emp) => {
      const empLeaves = leaveRequests.filter((l) => {
        if (l.employeeId !== emp.id || l.status !== 'Approved') return false;
        if (l.leaveType !== 'Unpaid') return false;
        const parts = l.fromDate.split('/').map(Number);
        return parts[1] - 1 === monthIdx;
      });
      const unpaidLeaveDays = empLeaves.reduce((sum, l) => sum + l.days, 0);

      const empAttendance = attendanceRecords.filter((a) => {
        if (a.employeeId !== emp.id) return false;
        const parts = a.date.split('/').map(Number);
        return parts[1] - 1 === monthIdx;
      });
      const absentDays = empAttendance.filter((a) => a.status === 'A').length;
      const halfDays = empAttendance.filter((a) => a.status === 'HD').length;

      const workingDays = 22;
      const dailyRate = emp.salaryAmount / workingDays;
      const leaveDeductions = Math.round((unpaidLeaveDays + absentDays + halfDays * 0.5) * dailyRate);
      const bonus = month === 'March' ? 0 : 0;
      const netPayable = Math.max(0, emp.salaryAmount - leaveDeductions + bonus);

      const existingRecord = existingForMonth.find((p) => p.employeeId === emp.id);

      payload.push({
        employeeId: emp.id,
        month,
        year,
        baseSalary: emp.salaryAmount,
        leaveDeductions,
        bonus,
        netPayable,
        status: existingRecord?.status || 'Unpaid',
      });
    });

    const saved = await postPayrollBulkUpsert(payload as unknown as PayrollRecord[]);
    if (saved.length) {
      setRecords((prev) => {
        const others = prev.filter((p) => !(p.month === month && p.year === year));
        return [...others, ...saved];
      });
      toast({ title: 'Payroll calculated', description: `Saved ${saved.length} rows for ${month} ${year}.` });
    } else {
      toast({ title: 'Could not save payroll', variant: 'destructive' });
    }
  }, [month, year, employees, leaveRequests, attendanceRecords, records, toast]);

  const handleExport = () => {
    const csv = [
      'Employee,Base Salary,Deductions,Bonus,Net Payable,Status',
      ...filtered.map((p) => {
        const emp = employees.find((e) => e.id === p.employeeId);
        return `${emp?.fullName},${p.baseSalary},${p.leaveDeductions},${p.bonus},${p.netPayable},${p.status}`;
      }),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${month}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Payroll CSV downloaded.' });
  };

  const handleMarkFreelancerPaid = (empId: string) => {
    setFreelancerStatuses((prev) => ({ ...prev, [empId]: 'Paid' }));
    const emp = employees.find((e) => e.id === empId);
    toast({ title: 'Payment marked', description: emp ? `Local note for ${emp.fullName}` : '' });
  };

  const handleMarkAllPaid = async () => {
    const unpaid = filtered.filter((p) => p.status === 'Unpaid');
    if (unpaid.length === 0) {
      toast({ title: 'No pending payments', description: 'All salaries already paid for this month.', variant: 'destructive' });
      return;
    }
    const ok = await markAllPayrollPaidForMonth(month, year);
    if (ok) {
      setRecords((prev) => prev.map((p) => (p.month === month && p.year === year && p.status === 'Unpaid' ? { ...p, status: 'Paid' as const } : p)));
      toast({ title: 'All salaries paid', description: `${unpaid.length} payments updated.` });
    } else {
      toast({ title: 'Bulk update failed', variant: 'destructive' });
    }
  };

  if (loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading payroll…
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Payroll"
        description="Manage monthly salary payments (data from MongoDB)"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2 rounded-xl" onClick={handleExport}>
              <Download className="w-4 h-4" /> Export
            </Button>
            <Button variant="outline" className="gap-2 rounded-xl" onClick={handleMarkAllPaid}>
              <CheckCircle2 className="w-4 h-4" /> Pay All
            </Button>
            <Button onClick={() => void handleRunPayroll()} className="gap-2 rounded-xl shadow-md shadow-primary/20">
              <Play className="w-4 h-4" /> Run Payroll
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Payable</p>
            <p className="text-lg font-bold">LKR {totalPayable.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center text-success">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Paid ({paidCount})</p>
            <p className="text-lg font-bold text-success">LKR {totalPaid.toLocaleString()}</p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center text-warning">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Pending ({filtered.length - paidCount})</p>
            <p className="text-lg font-bold text-warning">LKR {(totalPayable - totalPaid).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-5">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40 rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28 rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2024, 2025, 2026].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-2xl p-4 mb-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payslip DOCX Template</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload template once, then the row icon downloads payslips (DOCX or PDF — choose below).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Selected template</p>
            <Select
              value={selectedPayslipTemplateId}
              onValueChange={setSelectedPayslipTemplateId}
              disabled={payslipTemplatesLoading || payslipTemplates.length === 0 || payslipTemplateUploading}
            >
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder={payslipTemplatesLoading ? 'Loading...' : 'No template'} />
              </SelectTrigger>
              <SelectContent>
                {payslipTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Payslip download format</p>
            <Select value={payslipDownloadFormat} onValueChange={(v) => setPayslipDownloadFormat(v as 'docx' | 'pdf')}>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="docx">Word (.docx)</SelectItem>
                <SelectItem value="pdf">PDF (.pdf)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Template name (optional)</p>
            <Input
              value={payslipTemplateName}
              onChange={(e) => setPayslipTemplateName(e.target.value)}
              disabled={payslipTemplateUploading}
              className="rounded-xl h-10"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Upload DOCX</p>
            <Input
              type="file"
              accept=".docx"
              onChange={(e) => setPayslipTemplateFile(e.target.files?.[0] || null)}
              disabled={payslipTemplateUploading}
              className="rounded-xl"
            />
            <Button
              variant="outline"
              onClick={() => void handleUploadPayslipTemplate()}
              disabled={payslipTemplateUploading || !payslipTemplateFile}
              className="rounded-xl w-full gap-2"
            >
              {payslipTemplateUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {payslipTemplateUploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="employees">
        <TabsList className="rounded-xl bg-muted/50 p-1 mb-4">
          <TabsTrigger value="employees" className="rounded-lg text-xs font-semibold">
            Employees
          </TabsTrigger>
          <TabsTrigger value="freelancers" className="rounded-lg text-xs font-semibold">
            Freelancers
          </TabsTrigger>
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
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No payroll records for {month} {year}. Click <strong>&quot;Run Payroll&quot;</strong> to calculate.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const emp = employees.find((e) => e.id === p.employeeId);
                    return (
                      <TableRow
                        key={p.id}
                        className="border-border/50 cursor-pointer hover:bg-muted/20 transition-colors"
                        onClick={() => navigate(`/payroll/payslip/${p.id}`, { state: { startInEdit: true, templateId: selectedPayslipTemplateId } })}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold">
                              {emp?.fullName.split(' ').map((n) => n[0]).join('')}
                            </div>
                            <span className="font-semibold text-sm">{emp?.fullName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm hidden sm:table-cell font-mono">LKR {p.baseSalary.toLocaleString()}</TableCell>
                        <TableCell className="text-sm hidden md:table-cell font-mono text-destructive">
                          {p.leaveDeductions > 0 ? `- LKR ${p.leaveDeductions.toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell className="text-sm hidden md:table-cell font-mono text-success">
                          {p.bonus > 0 ? `+ LKR ${p.bonus.toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell className="text-sm font-bold font-mono">LKR {p.netPayable.toLocaleString()}</TableCell>
                        <TableCell>
                          <StatusBadge status={p.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBreakdownId(p.id);
                              }}
                              title="Quick view"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 rounded-lg"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/payroll/payslip/${p.id}`, { state: { startInEdit: true, templateId: selectedPayslipTemplateId } });
                              }}
                              title="Edit payroll row"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 rounded-lg"
                              disabled={!selectedPayslipTemplateId || payslipTemplateUploading}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/payroll/payslip/${p.id}`, {
                                  state: {
                                    autoDownload: true,
                                    templateId: selectedPayslipTemplateId,
                                    downloadFormat: payslipDownloadFormat,
                                  },
                                });
                              }}
                              title={
                                !selectedPayslipTemplateId
                                  ? 'Upload/select payslip template first'
                                  : `Download payslip (${payslipDownloadFormat.toUpperCase()})`
                              }
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            {p.status === 'Unpaid' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1 rounded-lg"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConfirmPayId(p.id);
                                }}
                              >
                                <DollarSign className="w-3 h-3" /> Pay
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
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
                  <TableHead>Sessions</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {freelancers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No freelancers in directory
                    </TableCell>
                  </TableRow>
                ) : (
                  freelancers.map((f) => {
                    const sessions = freelancerSessions[f.id] || 0;
                    const amount = f.salaryAmount * sessions;
                    const status = freelancerStatuses[f.id] || 'Unpaid';
                    return (
                      <TableRow key={f.id} className="border-border/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center text-info text-[11px] font-bold">
                              {f.fullName.split(' ').map((n) => n[0]).join('')}
                            </div>
                            <span className="font-semibold text-sm">{f.fullName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{f.salaryType}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={sessions}
                            onChange={(e) => setFreelancerSessions((p) => ({ ...p, [f.id]: Number(e.target.value) }))}
                            className="w-20 h-8 rounded-lg text-sm font-mono"
                          />
                        </TableCell>
                        <TableCell className="text-sm font-bold font-mono">LKR {amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <StatusBadge status={status} />
                        </TableCell>
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
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={!!breakdownId} onOpenChange={() => setBreakdownId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Salary Breakdown</DialogTitle>
          </DialogHeader>
          {breakdownRecord && breakdownEmp && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {breakdownEmp.fullName.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="font-semibold">{breakdownEmp.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {breakdownRecord.month} {breakdownRecord.year}
                  </p>
                </div>
              </div>
              <div className="glass-card rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Salary</span>
                  <span className="font-mono font-semibold">LKR {breakdownRecord.baseSalary.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Leave Deductions</span>
                  <span className="font-mono text-destructive">- LKR {breakdownRecord.leaveDeductions.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bonus</span>
                  <span className="font-mono text-success">+ LKR {breakdownRecord.bonus.toLocaleString()}</span>
                </div>
                <hr className="border-border/50" />
                <div className="flex justify-between font-bold">
                  <span>Net Payable</span>
                  <span className="font-mono">LKR {breakdownRecord.netPayable.toLocaleString()}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground pt-2">
                <span className="font-medium">Bank:</span> {breakdownEmp.bankName} • A/C: {breakdownEmp.accountNumber}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => navigate(`/payroll/payslip/${breakdownId}`)} className="rounded-xl">
              View Payslip
            </Button>
            {breakdownRecord?.status === 'Unpaid' && (
              <Button
                onClick={() => {
                  setBreakdownId(null);
                  setConfirmPayId(breakdownRecord.id);
                }}
                className="rounded-xl gap-1"
              >
                <DollarSign className="w-3 h-3" /> Mark Paid
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmPayId} onOpenChange={() => setConfirmPayId(null)}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Confirm Payment</DialogTitle>
          </DialogHeader>
          {confirmPayId &&
            (() => {
              const rec = records.find((p) => p.id === confirmPayId);
              const emp = rec ? employees.find((e) => e.id === rec.employeeId) : null;
              return (
                <div className="space-y-3 py-2">
                  <p className="text-sm">
                    Mark salary as paid for <strong>{emp?.fullName}</strong>?
                  </p>
                  <div className="glass-card rounded-xl p-3 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Net Payable</span>
                      <span className="font-mono font-bold">LKR {rec?.netPayable.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Bank</span>
                      <span className="font-mono">{emp?.bankName}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPayId(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button
              onClick={() => confirmPayId && void handleMarkPaid(confirmPayId)}
              className="rounded-xl gap-1 shadow-md shadow-success/20 bg-success hover:bg-success/90 text-success-foreground"
            >
              <CheckCircle2 className="w-4 h-4" /> Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
