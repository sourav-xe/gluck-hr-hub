import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employees } from '@/data/mockData';
import { Employee, EmployeeType, EmployeeStatus, SalaryType } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const departments = ['Human Resources', 'Recruitment', 'Training', 'Administration', 'Finance', 'Operations'];

export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;
  const existing = isEdit ? employees.find(e => e.id === id) : undefined;

  const [form, setForm] = useState<Partial<Employee>>(existing || {
    type: 'Full Time', status: 'Active', salaryType: 'Fixed Monthly', nationality: 'Sri Lankan',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof Employee, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.fullName?.trim()) e.fullName = 'Required';
    if (!form.email?.trim()) e.email = 'Required';
    if (!form.phone?.trim()) e.phone = 'Required';
    if (!form.department) e.department = 'Required';
    if (!form.jobTitle?.trim()) e.jobTitle = 'Required';
    if (!form.joiningDate?.trim()) e.joiningDate = 'Required';
    if (!form.salaryAmount) e.salaryAmount = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    toast({ title: isEdit ? 'Employee updated' : 'Employee added', description: `${form.fullName} has been ${isEdit ? 'updated' : 'added'} successfully.` });
    navigate('/employees');
  };

  const Field = ({ label, name, type = 'text', required }: { label: string; name: keyof Employee; type?: string; required?: boolean }) => (
    <div>
      <Label className="text-sm">{label} {required && <span className="text-destructive">*</span>}</Label>
      <Input
        type={type}
        value={(form[name] as string) || ''}
        onChange={e => set(name, type === 'number' ? Number(e.target.value) : e.target.value)}
        className={errors[name] ? 'border-destructive' : ''}
      />
      {errors[name] && <p className="text-xs text-destructive mt-1">{errors[name]}</p>}
    </div>
  );

  return (
    <div className="animate-fade-in max-w-4xl">
      <PageHeader
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
        action={<Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2"><ArrowLeft className="w-4 h-4" /> Back</Button>}
      />
      <form onSubmit={handleSubmit} className="bg-card rounded-lg border p-6 space-y-6">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Full Name" name="fullName" required />
          <Field label="Email" name="email" type="email" required />
          <Field label="Phone" name="phone" required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">Type <span className="text-destructive">*</span></Label>
            <Select value={form.type} onValueChange={v => set('type', v as EmployeeType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Full Time">Full Time</SelectItem>
                <SelectItem value="Freelancer">Freelancer</SelectItem>
                <SelectItem value="Intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Department <span className="text-destructive">*</span></Label>
            <Select value={form.department} onValueChange={v => set('department', v)}>
              <SelectTrigger className={errors.department ? 'border-destructive' : ''}><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.department && <p className="text-xs text-destructive mt-1">{errors.department}</p>}
          </div>
          <Field label="Job Title" name="jobTitle" required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">Reporting Manager</Label>
            <Select value={form.reportingManagerId || ''} onValueChange={v => set('reportingManagerId', v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.id !== id).map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Field label="Joining Date" name="joiningDate" required />
          <Field label="Date of Birth" name="dateOfBirth" />
        </div>

        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider pt-4">Salary Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-sm">Salary Type</Label>
            <Select value={form.salaryType} onValueChange={v => set('salaryType', v as SalaryType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Fixed Monthly">Fixed Monthly</SelectItem>
                <SelectItem value="Hourly Rate">Hourly Rate</SelectItem>
                <SelectItem value="Per Session">Per Session</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field label="Amount/Rate (LKR)" name="salaryAmount" type="number" required />
          <div>
            <Label className="text-sm">Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v as EmployeeStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider pt-4">Bank Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Bank Name" name="bankName" />
          <Field label="Account Number" name="accountNumber" />
          <Field label="Account Holder Name" name="accountHolderName" />
        </div>

        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider pt-4">Additional Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Address" name="address" />
          <Field label="Nationality" name="nationality" />
          <Field label="Passport Number" name="passportNumber" />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit">{isEdit ? 'Update Employee' : 'Add Employee'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/employees')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
