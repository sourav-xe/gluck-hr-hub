import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employees } from '@/data/mockData';
import { Employee, EmployeeType, EmployeeStatus, SalaryType, UserRole } from '@/types/hr';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, KeyRound } from 'lucide-react';

const departments = ['Human Resources', 'Recruitment', 'Training', 'Administration', 'Finance', 'Operations'];

const roleOptions: { value: UserRole; label: string }[] = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'reporting_manager', label: 'Reporting Manager' },
  { value: 'employee', label: 'Employee' },
  { value: 'freelancer_intern', label: 'Freelancer / Intern' },
];

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
}

function FormField({ label, value, onChange, type = 'text', required, disabled, error, placeholder }: FormFieldProps) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`mt-1.5 rounded-xl h-10 ${error ? 'border-destructive' : ''}`}
        disabled={disabled}
        placeholder={placeholder}
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, hasAccess } = useAuth();
  const isEdit = !!id;
  const existing = isEdit ? employees.find(e => e.id === id) : undefined;

  const canEdit = hasAccess(['super_admin', 'hr_manager']);

  const [form, setForm] = useState<Partial<Employee>>(existing || {
    type: 'Full Time', status: 'Active', salaryType: 'Fixed Monthly', nationality: 'Sri Lankan',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [loginPassword, setLoginPassword] = useState('');
  const [portalRole, setPortalRole] = useState<UserRole>('employee');
  const [creatingUser, setCreatingUser] = useState(false);

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
    if (!isEdit && !loginPassword.trim()) e.loginPassword = 'Required for new employee';
    if (!isEdit && loginPassword.trim() && loginPassword.length < 6) e.loginPassword = 'Min 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (!isEdit) {
      setCreatingUser(true);
      try {
        const res = await supabase.functions.invoke('create-employee-user', {
          body: {
            email: form.email,
            password: loginPassword,
            full_name: form.fullName,
            app_role: portalRole,
            employee_data: {
              phone: form.phone,
              type: form.type,
              department: form.department,
              job_title: form.jobTitle,
              joining_date: form.joiningDate,
              date_of_birth: form.dateOfBirth,
              salary_type: form.salaryType,
              salary_amount: form.salaryAmount,
              bank_name: form.bankName,
              account_number: form.accountNumber,
              account_holder_name: form.accountHolderName,
              address: form.address,
              nationality: form.nationality,
              passport_number: form.passportNumber,
              status: form.status,
            },
          },
        });

        if (res.error || res.data?.error) {
          toast({ title: 'Failed to create portal account', description: res.data?.error || res.error?.message, variant: 'destructive' });
          setCreatingUser(false);
          return;
        }

        toast({
          title: '✅ Employee added with portal access',
          description: `${form.fullName} can now log in with ${form.email}`,
        });
      } catch (err) {
        toast({ title: 'Error creating account', variant: 'destructive' });
        setCreatingUser(false);
        return;
      }
      setCreatingUser(false);
    } else {
      toast({
        title: '✅ Employee updated',
        description: `${form.fullName} has been updated successfully.`,
      });
    }

    navigate('/employees');
  };

  const fieldDisabled = isEdit && !canEdit;

  return (
    <div className="animate-fade-in max-w-4xl">
      <PageHeader
        title={isEdit ? 'Edit Employee' : 'Add Employee'}
        action={<Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2 rounded-xl"><ArrowLeft className="w-4 h-4" /> Back</Button>}
      />
      <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 space-y-6">
        <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Full Name" value={(form.fullName as string) || ''} onChange={v => set('fullName', v)} required disabled={fieldDisabled} error={errors.fullName} />
          <FormField label="Email" value={(form.email as string) || ''} onChange={v => set('email', v)} type="email" required disabled={fieldDisabled} error={errors.email} />
          <FormField label="Phone" value={(form.phone as string) || ''} onChange={v => set('phone', v)} required disabled={fieldDisabled} error={errors.phone} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type <span className="text-destructive">*</span></Label>
            <Select value={form.type} onValueChange={v => set('type', v as EmployeeType)} disabled={fieldDisabled}>
              <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Full Time">Full Time</SelectItem>
                <SelectItem value="Freelancer">Freelancer</SelectItem>
                <SelectItem value="Intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department <span className="text-destructive">*</span></Label>
            <Select value={form.department} onValueChange={v => set('department', v)} disabled={fieldDisabled}>
              <SelectTrigger className={`mt-1.5 rounded-xl h-10 ${errors.department ? 'border-destructive' : ''}`}><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            {errors.department && <p className="text-xs text-destructive mt-1">{errors.department}</p>}
          </div>
          <FormField label="Job Title" value={(form.jobTitle as string) || ''} onChange={v => set('jobTitle', v)} required disabled={fieldDisabled} error={errors.jobTitle} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reporting Manager</Label>
            <Select value={form.reportingManagerId || ''} onValueChange={v => set('reportingManagerId', v)} disabled={fieldDisabled}>
              <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {employees.filter(e => e.id !== id).map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <FormField label="Joining Date" value={(form.joiningDate as string) || ''} onChange={v => set('joiningDate', v)} required disabled={fieldDisabled} error={errors.joiningDate} />
          <FormField label="Date of Birth" value={(form.dateOfBirth as string) || ''} onChange={v => set('dateOfBirth', v)} disabled={fieldDisabled} />
        </div>

        <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest pt-2">Salary Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salary Type</Label>
            <Select value={form.salaryType} onValueChange={v => set('salaryType', v as SalaryType)} disabled={fieldDisabled}>
              <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Fixed Monthly">Fixed Monthly</SelectItem>
                <SelectItem value="Hourly Rate">Hourly Rate</SelectItem>
                <SelectItem value="Per Session">Per Session</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <FormField label="Amount/Rate (LKR)" value={String(form.salaryAmount || '')} onChange={v => set('salaryAmount', Number(v))} type="number" required disabled={fieldDisabled} error={errors.salaryAmount} />
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
            <Select value={form.status} onValueChange={v => set('status', v as EmployeeStatus)} disabled={fieldDisabled}>
              <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="On Leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest pt-2">Bank Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Bank Name" value={(form.bankName as string) || ''} onChange={v => set('bankName', v)} disabled={fieldDisabled} />
          <FormField label="Account Number" value={(form.accountNumber as string) || ''} onChange={v => set('accountNumber', v)} disabled={fieldDisabled} />
          <FormField label="Account Holder Name" value={(form.accountHolderName as string) || ''} onChange={v => set('accountHolderName', v)} disabled={fieldDisabled} />
        </div>

        <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest pt-2">Additional Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Address" value={(form.address as string) || ''} onChange={v => set('address', v)} disabled={fieldDisabled} />
          <FormField label="Nationality" value={(form.nationality as string) || ''} onChange={v => set('nationality', v)} disabled={fieldDisabled} />
          <FormField label="Passport Number" value={(form.passportNumber as string) || ''} onChange={v => set('passportNumber', v)} disabled={fieldDisabled} />
        </div>

        {!isEdit && (
          <>
            <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest pt-2 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-accent" /> Portal Login Credentials
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Login Email <span className="text-destructive">*</span></Label>
                <Input
                  value={form.email || ''}
                  disabled
                  className="mt-1.5 rounded-xl h-10 bg-muted/50"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Same as employee email above</p>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password <span className="text-destructive">*</span></Label>
                <Input
                  type="password"
                  value={loginPassword}
                  onChange={e => {
                    setLoginPassword(e.target.value);
                    if (errors.loginPassword) setErrors(prev => { const n = { ...prev }; delete n.loginPassword; return n; });
                  }}
                  placeholder="Min 6 characters"
                  className={`mt-1.5 rounded-xl h-10 ${errors.loginPassword ? 'border-destructive' : ''}`}
                />
                {errors.loginPassword && <p className="text-xs text-destructive mt-1">{errors.loginPassword}</p>}
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portal Role <span className="text-destructive">*</span></Label>
                <Select value={portalRole} onValueChange={v => setPortalRole(v as UserRole)}>
                  <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {roleOptions.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={creatingUser || (isEdit && !canEdit)} className="rounded-xl shadow-md shadow-primary/20">
            {creatingUser ? 'Creating...' : isEdit ? 'Update Employee' : 'Add Employee'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/employees')} className="rounded-xl">Cancel</Button>
        </div>
      </form>
    </div>
  );
}
