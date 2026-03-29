import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEmployees } from '@/lib/employeeService';
import { postLeaveRequest } from '@/lib/hrApi';
import { Employee, LeaveType } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';

const leaveTypes: LeaveType[] = ['Annual', 'Sick', 'Casual', 'Unpaid', 'Maternity', 'Emergency'];

function parseFlexibleDate(value: string): Date | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
    const [d, m, y] = v.split('/').map(Number);
    return new Date(y, m - 1, d);
  }
  return null;
}

export default function LeaveForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isEmployee = user.role === 'employee' || user.role === 'freelancer_intern';
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(!isEmployee);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    employeeId: isEmployee ? user.employeeId || '' : '',
    leaveType: '' as LeaveType | '',
    fromDate: '',
    toDate: '',
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEmployee) return;
    fetchEmployees().then((list) => {
      setEmployees(list);
      setLoadingEmps(false);
    });
  }, [isEmployee]);

  const calcDays = () => {
    if (!form.fromDate || !form.toDate) return 0;
    const from = parseFlexibleDate(form.fromDate);
    const to = parseFlexibleDate(form.toDate);
    if (!from || !to) return 0;
    const diff = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.employeeId) e.employeeId = 'Required';
    if (!form.leaveType) e.leaveType = 'Required';
    if (!form.fromDate) e.fromDate = 'Required';
    if (!form.toDate) e.toDate = 'Required';
    if (!form.reason.trim()) e.reason = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const days = calcDays();
    const created = await postLeaveRequest({
      employeeId: form.employeeId,
      leaveType: form.leaveType as LeaveType,
      fromDate: form.fromDate,
      toDate: form.toDate,
      days,
      reason: form.reason,
      status: 'Pending',
    });
    setSubmitting(false);
    if (created) {
      toast({ title: 'Leave request submitted', description: `${days} day(s) saved to database.` });
      navigate('/leaves');
    } else {
      toast({ title: 'Failed to submit', variant: 'destructive' });
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader
        title="New Leave Request"
        action={
          <Button variant="ghost" onClick={() => navigate('/leaves')} className="gap-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        }
      />

      <form onSubmit={(e) => void handleSubmit(e)} className="glass-card rounded-2xl p-6 space-y-5">
        {!isEmployee && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Employee <span className="text-destructive">*</span>
            </Label>
            {loadingEmps ? (
              <div className="mt-2 flex items-center gap-2 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : (
              <Select value={form.employeeId} onValueChange={(v) => setForm((p) => ({ ...p, employeeId: v }))}>
                <SelectTrigger className={`mt-1.5 rounded-xl h-10 ${errors.employeeId ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.employeeId && <p className="text-xs text-destructive mt-1">{errors.employeeId}</p>}
          </div>
        )}

        {isEmployee && (
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee</Label>
            <Input disabled value={user.name} className="mt-1.5 rounded-xl h-10" />
          </div>
        )}

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Leave Type <span className="text-destructive">*</span>
          </Label>
          <Select value={form.leaveType} onValueChange={(v) => setForm((p) => ({ ...p, leaveType: v as LeaveType }))}>
            <SelectTrigger className={`mt-1.5 rounded-xl h-10 ${errors.leaveType ? 'border-destructive' : ''}`}>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {leaveTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.leaveType && <p className="text-xs text-destructive mt-1">{errors.leaveType}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              From Date <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={form.fromDate}
              onChange={(e) => setForm((p) => ({ ...p, fromDate: e.target.value }))}
              className={`mt-1.5 rounded-xl h-10 pr-10 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert ${errors.fromDate ? 'border-destructive' : ''}`}
            />
            {errors.fromDate && <p className="text-xs text-destructive mt-1">{errors.fromDate}</p>}
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              To Date <span className="text-destructive">*</span>
            </Label>
            <Input
              type="date"
              value={form.toDate}
              onChange={(e) => setForm((p) => ({ ...p, toDate: e.target.value }))}
              className={`mt-1.5 rounded-xl h-10 pr-10 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert ${errors.toDate ? 'border-destructive' : ''}`}
            />
            {errors.toDate && <p className="text-xs text-destructive mt-1">{errors.toDate}</p>}
          </div>
        </div>

        {calcDays() > 0 && (
          <div className="glass-card rounded-xl p-3 text-sm flex items-center gap-2">
            <span className="font-bold text-primary">{calcDays()}</span> day(s) requested
          </div>
        )}

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            value={form.reason}
            onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            placeholder="Enter reason for leave..."
            className={`mt-1.5 rounded-xl ${errors.reason ? 'border-destructive' : ''}`}
          />
          {errors.reason && <p className="text-xs text-destructive mt-1">{errors.reason}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting} className="rounded-xl shadow-md shadow-primary/20">
            {submitting ? 'Saving…' : 'Submit Request'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/leaves')} className="rounded-xl">
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
