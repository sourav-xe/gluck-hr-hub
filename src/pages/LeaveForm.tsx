import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { employees } from '@/data/mockData';
import { LeaveType } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const leaveTypes: LeaveType[] = ['Annual', 'Sick', 'Casual', 'Unpaid', 'Maternity', 'Emergency'];

export default function LeaveForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isEmployee = user.role === 'employee' || user.role === 'freelancer_intern';

  const [form, setForm] = useState({
    employeeId: isEmployee ? (user.employeeId || '') : '',
    leaveType: '' as LeaveType | '',
    fromDate: '',
    toDate: '',
    reason: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const calcDays = () => {
    if (!form.fromDate || !form.toDate) return 0;
    const [fd, fm, fy] = form.fromDate.split('/').map(Number);
    const [td, tm, ty] = form.toDate.split('/').map(Number);
    if (!fd || !fm || !fy || !td || !tm || !ty) return 0;
    const from = new Date(fy, fm - 1, fd);
    const to = new Date(ty, tm - 1, td);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    toast({ title: 'Leave request submitted', description: `${calcDays()} day(s) leave request has been submitted for approval.` });
    navigate('/leaves');
  };

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader
        title="New Leave Request"
        action={<Button variant="ghost" onClick={() => navigate('/leaves')} className="gap-2"><ArrowLeft className="w-4 h-4" /> Back</Button>}
      />

      <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-6 space-y-4">
        {!isEmployee && (
          <div>
            <Label>Employee <span className="text-destructive">*</span></Label>
            <Select value={form.employeeId} onValueChange={v => setForm(p => ({ ...p, employeeId: v }))}>
              <SelectTrigger className={errors.employeeId ? 'border-destructive' : ''}><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.employeeId && <p className="text-xs text-destructive mt-1">{errors.employeeId}</p>}
          </div>
        )}

        {isEmployee && (
          <div>
            <Label>Employee</Label>
            <Input disabled value={user.name} />
          </div>
        )}

        <div>
          <Label>Leave Type <span className="text-destructive">*</span></Label>
          <Select value={form.leaveType} onValueChange={v => setForm(p => ({ ...p, leaveType: v as LeaveType }))}>
            <SelectTrigger className={errors.leaveType ? 'border-destructive' : ''}><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              {leaveTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {errors.leaveType && <p className="text-xs text-destructive mt-1">{errors.leaveType}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>From Date (DD/MM/YYYY) <span className="text-destructive">*</span></Label>
            <Input value={form.fromDate} onChange={e => setForm(p => ({ ...p, fromDate: e.target.value }))} placeholder="DD/MM/YYYY" className={errors.fromDate ? 'border-destructive' : ''} />
            {errors.fromDate && <p className="text-xs text-destructive mt-1">{errors.fromDate}</p>}
          </div>
          <div>
            <Label>To Date (DD/MM/YYYY) <span className="text-destructive">*</span></Label>
            <Input value={form.toDate} onChange={e => setForm(p => ({ ...p, toDate: e.target.value }))} placeholder="DD/MM/YYYY" className={errors.toDate ? 'border-destructive' : ''} />
            {errors.toDate && <p className="text-xs text-destructive mt-1">{errors.toDate}</p>}
          </div>
        </div>

        {calcDays() > 0 && (
          <div className="bg-muted rounded-md p-3 text-sm">
            <strong>Total Days:</strong> {calcDays()}
          </div>
        )}

        <div>
          <Label>Reason <span className="text-destructive">*</span></Label>
          <Textarea value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Enter reason for leave..." className={errors.reason ? 'border-destructive' : ''} />
          {errors.reason && <p className="text-xs text-destructive mt-1">{errors.reason}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="submit">Submit Request</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/leaves')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
