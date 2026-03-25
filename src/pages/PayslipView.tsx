import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { fetchAttendanceRecords, fetchLeaveRequests, fetchPayrollRecordById, patchPayrollRecord } from '@/lib/hrApi';
import { apiFetch } from '@/lib/api';
import { fetchEmployeeById } from '@/lib/employeeService';
import type { Employee, PayrollRecord } from '@/types/hr';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  computePayslipDaysForEmployee,
  downloadBlob,
  generatePayslipFromTemplate,
} from '@/lib/payslipDocx';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const monthToIndex = months.reduce((acc, m, i) => {
  acc[m] = i;
  return acc;
}, {} as Record<string, number>);

export default function PayslipView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [record, setRecord] = useState<PayrollRecord | null>(null);
  const [emp, setEmp] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const autoState = (location.state || {}) as { autoDownload?: boolean; templateId?: string; startInEdit?: boolean } | undefined;
  const autoDownload = Boolean(autoState?.autoDownload);
  const selectedTemplateId = autoState?.templateId;
  const startInEdit = Boolean(autoState?.startInEdit);

  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<PayrollRecord>>({});

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const rec = await fetchPayrollRecordById(id);
      if (cancelled) return;
      setRecord(rec);
      setDraft(rec || {});
      setEditOpen(startInEdit);
      if (rec?.employeeId) {
        const e = await fetchEmployeeById(rec.employeeId);
        if (!cancelled) setEmp(e);
      } else {
        setEmp(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const effectiveRecord = (draft?.id ? (draft as PayrollRecord) : record) as PayrollRecord | null;
  const canGenerate = Boolean(effectiveRecord && emp);
  const computedNetPayable = useMemo(() => {
    const base = Number(draft.baseSalary ?? record?.baseSalary ?? 0);
    const bonus = Number(draft.bonus ?? record?.bonus ?? 0);
    const deductions = Number(draft.leaveDeductions ?? record?.leaveDeductions ?? 0);
    const raw = base + bonus - deductions;
    return Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  }, [draft.baseSalary, draft.bonus, draft.leaveDeductions, record?.baseSalary, record?.bonus, record?.leaveDeductions]);

  const effectiveRecordComputed = useMemo(() => {
    if (!effectiveRecord) return null;
    return { ...effectiveRecord, netPayable: computedNetPayable } as PayrollRecord;
  }, [effectiveRecord, computedNetPayable]);
  const monthIndex = useMemo(() => {
    if (!effectiveRecord) return 0;
    return monthToIndex[effectiveRecord.month] ?? 0;
  }, [effectiveRecord?.month]);

  const startProgress = () => {
    setProgress(40);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev === null) return prev;
        const next = Math.min(95, prev + Math.random() * 4 + 2);
        return Math.round(next);
      });
    }, 180);
  };

  const stopProgress = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setProgress(null);
  };

  const generateAndDownload = async (templateIdOverride?: string) => {
    if (!effectiveRecordComputed || !emp) return;
    setGenerating(true);
    try {
      startProgress();

      const templateIdToUse = templateIdOverride || selectedTemplateId;

      // Load template file (use latest uploaded if none specified)
      let templateWithFile: { original_file_url?: string } | null = null;
      if (templateIdToUse) {
        const res = await apiFetch(`/api/doc-simple-templates/${encodeURIComponent(templateIdToUse)}`);
        if (!res.ok) throw new Error('Template not found');
        templateWithFile = await res.json();
      } else {
        const listRes = await apiFetch('/api/doc-simple-templates');
        if (!listRes.ok) throw new Error('Failed to load templates');
        const list = (await listRes.json()) as Array<{ id: string; name: string }>;
        const first = list?.[0];
        if (!first?.id) throw new Error('No payslip template uploaded. Go to Payroll → upload template first.');
        const fileRes = await apiFetch(`/api/doc-simple-templates/${encodeURIComponent(first.id)}`);
        if (!fileRes.ok) throw new Error('Template file not found');
        templateWithFile = await fileRes.json();
      }

      if (!templateWithFile?.original_file_url) throw new Error('Template has no file. Please re-upload it.');

      const [attendance, leaves] = await Promise.all([fetchAttendanceRecords(), fetchLeaveRequests()]);

      const days = computePayslipDaysForEmployee({
        employeeId: emp.id,
        monthIndex,
        attendanceRecords: attendance,
        leaveRequests: leaves,
      });

      const filename = `${emp.fullName.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}_Payslip_${effectiveRecordComputed.month}_${effectiveRecordComputed.year}.docx`;

      const { blobUrl } = await generatePayslipFromTemplate({
        templateUrl: templateWithFile.original_file_url,
        filename,
        emp,
        record: effectiveRecordComputed,
        days,
      });

      setProgress(100);
      stopProgress();
      downloadBlob(blobUrl, filename);
      toast({ title: 'Payslip downloaded', description: filename });
    } catch (e: unknown) {
      toast({ title: 'Payslip generation failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setGenerating(false);
      stopProgress();
    }
  };

  useEffect(() => {
    if (!autoDownload) return;
    if (!canGenerate) return;
    void generateAndDownload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDownload, canGenerate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading payslip…
      </div>
    );
  }

  if (!record || !emp) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Payslip not found</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => navigate('/payroll')}>
          Back
        </Button>
      </div>
    );
  }

  const years = Array.from({ length: 7 }, (_, i) => (record.year - 3) + i);

  const handleSave = async () => {
    if (!record?.id) return;
    setSaving(true);
    try {
      const updated = await patchPayrollRecord(record.id, {
        month: draft.month,
        year: draft.year,
        baseSalary: Number(draft.baseSalary ?? record.baseSalary),
        bonus: Number(draft.bonus ?? record.bonus),
        leaveDeductions: Number(draft.leaveDeductions ?? record.leaveDeductions),
        netPayable: computedNetPayable,
        status: draft.status ?? record.status,
      } as Partial<PayrollRecord>);

      if (!updated) throw new Error('Save failed');
      setRecord(updated);
      setDraft(updated);
      setEditOpen(false);
      toast({ title: 'Payroll updated', description: `Saved for ${emp.fullName}` });
    } catch (e: unknown) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      {progress !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border/50 bg-background shadow-lg glass-card p-5">
            <div className="flex items-start gap-3">
              <div className="mt-1 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Generating payslip...</p>
                <p className="text-xs text-muted-foreground mt-1">Please wait. Download will start automatically.</p>
              </div>
              <div className="text-sm font-mono text-muted-foreground">{progress}%</div>
            </div>
            <div className="mt-4 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={() => navigate('/payroll')} className="gap-2 rounded-xl">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setEditOpen((v) => !v)}
            disabled={generating || saving}
          >
            {editOpen ? 'Close Edit' : 'Edit'}
          </Button>
          <Button
            variant="outline"
            className="gap-2 rounded-xl"
            onClick={() => void generateAndDownload()}
            disabled={generating || saving}
          >
            <Download className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate & Download'}
          </Button>
        </div>
      </div>

      {editOpen && effectiveRecord && (
        <div className="glass-card rounded-2xl p-5 mb-5 border border-border/50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">Edit payroll details</p>
              <p className="text-xs text-muted-foreground mt-0.5">Update month/year and amounts before generating the payslip.</p>
            </div>
            <Button onClick={() => void handleSave()} disabled={saving} className="rounded-xl">
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div>
              <Label className="text-xs text-muted-foreground">Month</Label>
              <Select
                value={String(draft.month ?? effectiveRecord.month)}
                onValueChange={(v) => setDraft((p) => ({ ...p, month: v }))}
              >
                <SelectTrigger className="mt-1 rounded-xl h-10">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Year</Label>
              <Select
                value={String(draft.year ?? effectiveRecord.year)}
                onValueChange={(v) => setDraft((p) => ({ ...p, year: Number(v) }))}
              >
                <SelectTrigger className="mt-1 rounded-xl h-10">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Base Salary (LKR)</Label>
              <Input
                type="number"
                className="mt-1 rounded-xl h-10 font-mono"
                value={String(draft.baseSalary ?? effectiveRecord.baseSalary)}
                onChange={(e) => setDraft((p) => ({ ...p, baseSalary: Number(e.target.value) }))}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Bonus (LKR)</Label>
              <Input
                type="number"
                className="mt-1 rounded-xl h-10 font-mono"
                value={String(draft.bonus ?? effectiveRecord.bonus)}
                onChange={(e) => setDraft((p) => ({ ...p, bonus: Number(e.target.value) }))}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Leave Deductions (LKR)</Label>
              <Input
                type="number"
                className="mt-1 rounded-xl h-10 font-mono"
                value={String(draft.leaveDeductions ?? effectiveRecord.leaveDeductions)}
                onChange={(e) => setDraft((p) => ({ ...p, leaveDeductions: Number(e.target.value) }))}
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Net Payable (auto-calculated)</Label>
              <Input
                type="number"
                className="mt-1 rounded-xl h-10 font-mono"
                value={String(computedNetPayable)}
                readOnly
              />
            </div>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl p-8 print:shadow-none">
        <div className="flex items-start justify-between border-b border-border/50 pb-6 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground font-bold text-sm shadow-md">
                GG
              </div>
              <div>
                <h2 className="text-lg font-bold">Gluck Global</h2>
                <p className="text-xs text-muted-foreground">International Staffing & Training</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Srimavo Bandaranayaka Mawatha, Peradeniya Road, Kandy</p>
            <p className="text-xs text-muted-foreground">info@gluckglobal.com | www.gluckglobal.com</p>
          </div>
          <div className="text-right">
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider">Payslip</h3>
            <p className="text-sm text-muted-foreground font-mono">
              {(effectiveRecordComputed?.month ?? record.month)} {(effectiveRecordComputed?.year ?? record.year)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-6 glass-card rounded-xl p-4">
          <div>
            <span className="text-muted-foreground text-xs">Employee:</span> <strong>{emp.fullName}</strong>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Department:</span> {emp.department}
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Job Title:</span> {emp.jobTitle}
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Employee ID:</span>{' '}
            <span className="font-mono">{emp.id}</span>
          </div>
        </div>

        <div className="border border-border/50 rounded-xl overflow-hidden mb-6">
          <div className="bg-muted/30 px-4 py-2.5 font-bold text-xs uppercase tracking-wider text-muted-foreground">Earnings & Deductions</div>
          <div className="divide-y divide-border/50">
            <div className="flex justify-between px-4 py-3 text-sm">
              <span>Basic Salary</span>
              <span className="font-mono font-semibold">LKR {(effectiveRecordComputed?.baseSalary ?? record.baseSalary).toLocaleString()}</span>
            </div>
            <div className="flex justify-between px-4 py-3 text-sm">
              <span>Bonus</span>
              <span className="font-mono text-success">+ LKR {(effectiveRecordComputed?.bonus ?? record.bonus).toLocaleString()}</span>
            </div>
            <div className="flex justify-between px-4 py-3 text-sm">
              <span>Leave Deductions</span>
              <span className="font-mono text-destructive">- LKR {(effectiveRecordComputed?.leaveDeductions ?? record.leaveDeductions).toLocaleString()}</span>
            </div>
          </div>
          <div className="flex justify-between px-4 py-3 bg-primary/5 font-bold">
            <span>Net Payable</span>
            <span className="font-mono">LKR {(effectiveRecordComputed?.netPayable ?? record.netPayable).toLocaleString()}</span>
          </div>
        </div>

        <div className="text-sm space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bank Details</p>
          <p className="font-mono text-muted-foreground">
            {emp.bankName} | A/C: {emp.accountNumber} | {emp.accountHolderName}
          </p>
        </div>
      </div>
    </div>
  );
}
