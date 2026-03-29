import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Employee, EmployeeType, EmployeeStatus, SalaryType, UserRole } from '@/types/hr';
import { useAuth } from '@/contexts/AuthContext';
import { createEmployeeWithUser, fetchEmployeeById, fetchEmployees, updateEmployee } from '@/lib/employeeService';
import { fetchEmailTemplates, sendEmail, type EmailTemplate } from '@/lib/hrApi';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Loader2, AlertCircle, Eye, EyeOff, Copy, Check,
  UserPlus, KeyRound, Mail, Lock, CheckCircle2, UserRound, RefreshCw, Building2, Send,
  PanelLeft,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { SIDEBAR_NAV_DEFINITIONS, navKeysAllowedForRole, type SidebarNavKey } from '@/lib/sidebarNav';

const departments = ['Human Resources', 'Recruitment', 'Training', 'Administration', 'Finance', 'Operations', 'Tech'];

const roleOptions: { value: UserRole; label: string; desc: string }[] = [
  { value: 'employee', label: 'Employee', desc: 'Standard employee access' },
  { value: 'freelancer_intern', label: 'Freelancer / Intern', desc: 'Limited access' },
  { value: 'reporting_manager', label: 'Reporting Manager', desc: 'Can manage team attendance & leaves' },
  { value: 'hr_manager', label: 'HR Manager', desc: 'Full HR module access' },
  { value: 'super_admin', label: 'Super Admin', desc: 'Full system access' },
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
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1.5 rounded-xl h-10 ${
          type === 'date'
            ? 'pr-10 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert'
            : ''
        } ${error ? 'border-destructive' : ''}`}
        disabled={disabled}
        placeholder={placeholder}
      />
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

/** Map template {{vars}} from the account fields on this form (name, workspace login email, password). */
function buildCredentialTemplateVars(
  keys: string[],
  fullName: string,
  loginEmail: string,
  password: string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of keys) {
    const k = raw.toLowerCase();
    if (k === 'name' || k === 'fullname' || k === 'employeename') out[raw] = fullName;
    else if (k.includes('password') || k === 'pass') out[raw] = password;
    else if (k.includes('email') || k === 'login' || k === 'loginid' || k === 'userid') out[raw] = loginEmail;
    else out[raw] = '';
  }
  return out;
}

/** Sidebar / success-screen: send credentials using an email template + recipient inbox. */
function CredentialEmailQuickSend({
  employeeName,
  loginEmail,
  password,
}: {
  employeeName: string;
  loginEmail: string;
  password: string;
}) {
  const { toast } = useToast();
  const [recipient, setRecipient] = useState('');
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [loadingTpls, setLoadingTpls] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTpls(true);
      const list = await fetchEmailTemplates();
      if (cancelled) return;
      setTemplates(list);
      if (list[0]) setTemplateId(list[0].id);
      setLoadingTpls(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const selected = templates.find((t) => t.id === templateId);
  const vars = selected
    ? buildCredentialTemplateVars(selected.variables, employeeName.trim(), loginEmail.trim(), password)
    : {};
  const missingFields = selected
    ? selected.variables.filter((v) => !String(vars[v] ?? '').trim())
    : [];
  const formReady = employeeName.trim() && loginEmail.trim() && password.length >= 6;

  async function handleSend() {
    if (!selected || !recipient.trim() || !formReady) return;
    if (missingFields.length) {
      toast({
        title: 'Complete account fields first',
        description: `This template needs: ${missingFields.map((v) => `{{${v}}}`).join(', ')} — fill name, login email, and password on the form, or pick another template.`,
        variant: 'destructive',
      });
      return;
    }
    setSending(true);
    try {
      const result = await sendEmail({
        to: recipient.trim(),
        templateId: selected.id,
        variables: vars,
      });
      if (!result.ok) {
        toast({ title: 'Email not sent', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Email sent', description: result.message ?? `Delivered to ${recipient.trim()}` });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-violet-500/25 bg-gradient-to-b from-violet-500/[0.07] to-transparent p-5 space-y-4">
      <div className="flex items-start gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-violet-500/15 text-violet-400 flex items-center justify-center shrink-0">
          <Send className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Send credentials</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Uses the <span className="text-foreground/90">name</span>, <span className="text-foreground/90">login email</span>, and <span className="text-foreground/90">password</span> from this form in your template. Enter the employee&apos;s personal inbox to deliver it.
          </p>
        </div>
      </div>

      {loadingTpls ? (
        <div className="flex items-center justify-center py-6 gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading templates…
        </div>
      ) : templates.length === 0 ? (
        <p className="text-xs text-amber-400/90">
          No email templates found. Add one under <strong>Announcements</strong> → Email.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Recipient email <span className="text-destructive">*</span>
            </Label>
            <Input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="Personal email (e.g. gmail)"
              className="h-10 rounded-xl bg-background/40 border-border/50 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="h-10 rounded-xl bg-background/40 border-border/50 text-sm">
                <SelectValue placeholder="Choose template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selected && selected.variables.length > 0 && (
            <div className="rounded-xl border border-border/40 bg-background/20 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Filled from this form</p>
              <div className="flex flex-wrap gap-1">
                {selected.variables.map((v) => (
                  <code
                    key={v}
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono border ${
                      String(vars[v] ?? '').trim() ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                    }`}
                  >
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
              {!formReady && (
                <p className="text-[11px] text-amber-400 mt-2">Enter full name, login email, and password (6+ chars) first.</p>
              )}
              {formReady && missingFields.length > 0 && (
                <p className="text-[11px] text-amber-400 mt-2">
                  This template expects fields we don&apos;t have here yet — use Announcements → Email to edit the template or switch template.
                </p>
              )}
            </div>
          )}
          <Button
            type="button"
            className="w-full h-10 rounded-xl gap-2 bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-500/20"
            disabled={sending || !recipient.trim() || !templateId || !formReady || missingFields.length > 0}
            onClick={() => void handleSend()}
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Send email'}
          </Button>
        </>
      )}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

/* ── Success screen after creating account ─────────────────────────────────── */
function AccountCreated({
  name, email, password, role,
  onCreateAnother, onViewList,
}: {
  name: string; email: string; password: string; role: string;
  onCreateAnother: () => void; onViewList: () => void;
}) {
  const { hasAccess } = useAuth();
  const [showPwd, setShowPwd] = useState(false);
  const roleLabel = roleOptions.find((r) => r.value === role)?.label ?? role;

  return (
    <div className="animate-fade-in max-w-xl mx-auto pt-8 text-center space-y-6">
      {/* Icon */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
        </div>
      </div>

      {/* Headline */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold">Account Created!</h2>
        <p className="text-muted-foreground text-sm">
          Share these credentials with <span className="text-foreground font-medium">{name}</span>. They will be asked to complete their profile on first login.
        </p>
      </div>

      {/* Credentials card */}
      <div className="rounded-2xl border border-border/60 bg-card text-left overflow-hidden">
        <div className="bg-muted/30 px-5 py-3 border-b border-border/40 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Login Credentials</span>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Email / Login ID</p>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-mono truncate">{email}</span>
              </div>
              <CopyButton text={email} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Password</p>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-mono">{showPwd ? password : '•'.repeat(password.length)}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                >
                  {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <CopyButton text={password} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Role</p>
              <p className="text-sm font-medium">{roleLabel}</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Onboarding</p>
              <p className="text-sm font-medium text-emerald-400">Required on login</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 flex items-start gap-2.5 text-left">
        <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Save these credentials now — the password cannot be viewed again. You can reset it anytime from the employee profile.
        </p>
      </div>

      {hasAccess(['super_admin', 'hr_manager']) && (
        <div className="max-w-md mx-auto w-full">
          <CredentialEmailQuickSend employeeName={name} loginEmail={email} password={password} />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={onCreateAnother} className="rounded-xl gap-2">
          <RefreshCw className="w-4 h-4" /> Create Another
        </Button>
        <Button onClick={onViewList} className="rounded-xl gap-2">
          <UserRound className="w-4 h-4" /> View All Employees
        </Button>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────────── */
export default function EmployeeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAccess, refreshAuth, user } = useAuth();
  const isEdit = !!id;
  const canEdit = hasAccess(['super_admin', 'hr_manager']);
  const isSuperAdmin = hasAccess(['super_admin']);
  const canSendCredentialEmail = hasAccess(['super_admin', 'hr_manager']);

  /* ── Create-mode state ──────────────────────────────────────────────────── */
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('employee');
  const [createDepartment, setCreateDepartment] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string; password: string; role: string } | null>(null);

  /* ── Edit-mode state ────────────────────────────────────────────────────── */
  const [form, setForm] = useState<Partial<Employee>>({
    type: 'Full Time',
    status: 'Active',
    salaryType: 'Fixed Monthly',
    nationality: 'Sri Lankan',
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [loadingExisting, setLoadingExisting] = useState(!!isEdit);
  const [managerOptions, setManagerOptions] = useState<Employee[]>([]);
  const [loginPassword, setLoginPassword] = useState('');
  const [editPortalRole, setEditPortalRole] = useState<UserRole>('employee');
  const [sidebarCustomize, setSidebarCustomize] = useState(false);
  const [customNavKeys, setCustomNavKeys] = useState<Set<SidebarNavKey>>(() => new Set(['dashboard']));

  useEffect(() => {
    fetchEmployees().then(setManagerOptions);
  }, []);

  useEffect(() => {
    if (!isEdit || !id) { setLoadingExisting(false); return; }
    setLoadingExisting(true);
    fetchEmployeeById(id).then((emp) => {
      if (!emp) {
        toast({ title: 'Employee not found', variant: 'destructive' });
        return;
      }
      setForm(emp);
      const role = (emp.appRole as UserRole) || 'employee';
      setEditPortalRole(role);
      const sn = emp.sidebarNavAllow;
      if (Array.isArray(sn) && sn.length > 0) {
        setSidebarCustomize(true);
        setCustomNavKeys(new Set(sn as SidebarNavKey[]));
      } else {
        setSidebarCustomize(false);
        setCustomNavKeys(new Set(navKeysAllowedForRole(role)));
      }
    }).finally(() => setLoadingExisting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, id]);

  /* ── Create submit ──────────────────────────────────────────────────────── */
  function validateCreate() {
    const e: Record<string, string> = {};
    if (!createName.trim()) e.name = 'Full name is required';
    if (!createEmail.trim()) e.email = 'Email address is required';
    else if (!/\S+@\S+\.\S+/.test(createEmail)) e.email = 'Enter a valid email address';
    if (!createPassword) e.password = 'Password is required';
    else if (createPassword.length < 6) e.password = 'Password must be at least 6 characters';
    if (!createDepartment) e.department = 'Department is required';
    setCreateErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!validateCreate()) return;
    setSaving(true);
    try {
      const res = await createEmployeeWithUser({
        email: createEmail.trim().toLowerCase(),
        password: createPassword,
        fullName: createName.trim(),
        app_role: createRole,
        phone: '',
        type: 'Full Time',
        department: createDepartment,
        jobTitle: '',
        joiningDate: '',
        salaryType: 'Fixed Monthly',
        salaryAmount: 0,
        status: 'Active',
        requiresOnboarding: true,
      });
      if (!res.ok) {
        toast({ title: 'Failed to create account', description: 'error' in res ? res.error : 'Unknown error', variant: 'destructive' });
        return;
      }
      setCreated({ name: createName.trim(), email: createEmail.trim().toLowerCase(), password: createPassword, role: createRole });
    } catch {
      toast({ title: 'Request failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function resetCreate() {
    setCreateName('');
    setCreateEmail('');
    setCreatePassword('');
    setCreateRole('employee');
    setCreateDepartment('');
    setCreateErrors({});
    setCreated(null);
  }

  /* ── Edit submit ────────────────────────────────────────────────────────── */
  const setField = (key: keyof Employee, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (editErrors[key as string]) setEditErrors((prev) => { const n = { ...prev }; delete n[key as string]; return n; });
  };

  const editFieldLabels: Record<string, string> = {
    fullName: 'Full name', email: 'Email', phone: 'Phone',
    department: 'Department', jobTitle: 'Job title',
    joiningDate: 'Joining date', salaryAmount: 'Salary amount',
  };

  function validateEdit() {
    const e: Record<string, string> = {};
    const req = 'Please fill in this field';
    if (!form.fullName?.trim()) e.fullName = req;
    if (!form.email?.trim()) e.email = req;
    setEditErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEdit()) return;
    setSaving(true);
    try {
      const payload: Parameters<typeof updateEmployee>[1] = {
        ...form as Employee,
        password: loginPassword.trim() || undefined,
      };
      if (isSuperAdmin) {
        payload.app_role = editPortalRole;
        if (sidebarCustomize) {
          const allowed = new Set(navKeysAllowedForRole(editPortalRole));
          const keys = [...customNavKeys].filter((k) => allowed.has(k as SidebarNavKey)) as SidebarNavKey[];
          if (!keys.includes('dashboard')) keys.unshift('dashboard');
          payload.sidebarNavAllow = [...new Set(keys)];
        } else {
          payload.sidebarNavAllow = null;
        }
      }
      const res = await updateEmployee(id!, payload);
      if (!res.ok) {
        toast({ title: 'Update failed', description: 'error' in res ? res.error : 'Unknown error', variant: 'destructive' });
        return;
      }
      toast({ title: 'Employee updated', description: `${form.fullName} saved.` });
      if (isSuperAdmin && id && user.employeeId === id) {
        await refreshAuth();
      }
      navigate('/employees');
    } catch {
      toast({ title: 'Request failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function toggleSidebarNavKey(k: SidebarNavKey) {
    if (k === 'dashboard') return;
    setCustomNavKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  const navDefsForEditRole = SIDEBAR_NAV_DEFINITIONS.filter((d) =>
    navKeysAllowedForRole(editPortalRole).includes(d.navKey)
  );

  /* ── Render: success screen ─────────────────────────────────────────────── */
  if (created) {
    return (
      <div className="animate-fade-in">
        <AccountCreated
          {...created}
          onCreateAnother={resetCreate}
          onViewList={() => navigate('/employees')}
        />
      </div>
    );
  }

  /* ── Render: create form ────────────────────────────────────────────────── */
  if (!isEdit) {
    return (
      <div className="animate-fade-in max-w-5xl mx-auto pt-4 px-1">
        <Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2 mb-4 -ml-1 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Employees
        </Button>

        {/* Hero */}
        <div className="text-center mb-8 space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <UserPlus className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-xl font-bold">Create Employee Account</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Set a login ID and password for the new employee. They will complete their profile and upload documents on first login.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Fields */}
            <div className="glass-card rounded-2xl p-5 space-y-4 lg:col-span-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account Details</h3>
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={createName}
                  onChange={(e) => { setCreateName(e.target.value); if (createErrors.name) setCreateErrors((p) => { const n = { ...p }; delete n.name; return n; }); }}
                  placeholder="e.g. Rahul Sharma"
                  className={`pl-10 h-11 rounded-xl ${createErrors.name ? 'border-destructive' : ''}`}
                />
              </div>
              {createErrors.name && <p className="text-xs text-destructive">{createErrors.name}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email / Login ID <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="email"
                  value={createEmail}
                  onChange={(e) => { setCreateEmail(e.target.value); if (createErrors.email) setCreateErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}
                  placeholder="employee@company.com"
                  className={`pl-10 h-11 rounded-xl ${createErrors.email ? 'border-destructive' : ''}`}
                />
              </div>
              {createErrors.email && <p className="text-xs text-destructive">{createErrors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Password <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  type={showPwd ? 'text' : 'password'}
                  value={createPassword}
                  onChange={(e) => { setCreatePassword(e.target.value); if (createErrors.password) setCreateErrors((p) => { const n = { ...p }; delete n.password; return n; }); }}
                  placeholder="Min 6 characters"
                  className={`pl-10 pr-10 h-11 rounded-xl ${createErrors.password ? 'border-destructive' : ''}`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPwd((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {createErrors.password && <p className="text-xs text-destructive">{createErrors.password}</p>}
              {!createErrors.password && createPassword.length > 0 && createPassword.length < 6 && (
                <p className="text-xs text-amber-400">{createPassword.length}/6 characters minimum</p>
              )}
            </div>

            {/* Department */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Department <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
                <Select
                  value={createDepartment}
                  onValueChange={(v) => {
                    setCreateDepartment(v);
                    if (createErrors.department) setCreateErrors((p) => { const n = { ...p }; delete n.department; return n; });
                  }}
                >
                  <SelectTrigger className={`h-11 rounded-xl pl-10 ${createErrors.department ? 'border-destructive' : ''}`}>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {createErrors.department && <p className="text-xs text-destructive">{createErrors.department}</p>}
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portal Role</Label>
              <Select value={createRole} onValueChange={(v) => setCreateRole(v as UserRole)}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{r.label}</span>
                        <span className="text-xs text-muted-foreground">{r.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            </div>

            {/* Side column: summary + credential email */}
            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-5 h-fit space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Summary</h3>
                <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Role</p>
                  <p className="text-sm font-medium">{roleOptions.find((r) => r.value === createRole)?.label || 'Employee'}</p>
                </div>
                <div className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Department</p>
                  <p className="text-sm font-medium">{createDepartment || 'Not selected'}</p>
                </div>
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">
                    Employee will be forced to complete onboarding on first login.
                  </p>
                </div>
              </div>

              {canSendCredentialEmail && (
                <CredentialEmailQuickSend
                  employeeName={createName}
                  loginEmail={createEmail}
                  password={createPassword}
                />
              )}
            </div>
          </div>

          {/* Onboarding note */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Onboarding wizard enabled</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The employee will be guided step-by-step to complete their profile, add government IDs, bank details, and upload documents on first login.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving} className="flex-1 h-11 rounded-xl gap-2 shadow-md shadow-primary/20">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {saving ? 'Creating Account…' : 'Create Account'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/employees')} className="rounded-xl px-5">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  /* ── Render: edit form ──────────────────────────────────────────────────── */
  const fieldDisabled = isEdit && !canEdit;

  if (loadingExisting) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading employee...
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-4xl">
      <PageHeader
        title="Edit Employee"
        action={<Button variant="ghost" onClick={() => navigate('/employees')} className="gap-2 rounded-xl"><ArrowLeft className="w-4 h-4" /> Back</Button>}
      />
      <form onSubmit={handleEdit} className="glass-card rounded-2xl p-6 space-y-6">
        {Object.keys(editErrors).length > 0 && (
          <Alert variant="destructive" className="rounded-xl border-destructive/80 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Missing required information</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-sm space-y-0.5 mt-1">
                {Object.keys(editErrors).map((key) => (
                  <li key={key}>{editFieldLabels[key] ?? key}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest">Personal Information</h3>
        {form.employeeCode ? (
          <div className="rounded-xl border border-border/50 bg-muted/25 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Employee ID</p>
            <p className="font-mono text-base font-semibold text-foreground mt-0.5">{form.employeeCode}</p>
          </div>
        ) : null}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Full Name" value={(form.fullName as string) || ''} onChange={(v) => setField('fullName', v)} required disabled={fieldDisabled} error={editErrors.fullName} />
          <FormField label="Email" value={(form.email as string) || ''} onChange={(v) => setField('email', v)} type="email" required disabled={fieldDisabled} error={editErrors.email} />
          <FormField label="Phone" value={(form.phone as string) || ''} onChange={(v) => setField('phone', v)} disabled={fieldDisabled} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
            <Select value={form.type} onValueChange={(v) => setField('type', v as EmployeeType)} disabled={fieldDisabled}>
              <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Full Time">Full Time</SelectItem>
                <SelectItem value="Freelancer">Freelancer</SelectItem>
                <SelectItem value="Intern">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Department</Label>
            <Select value={form.department} onValueChange={(v) => setField('department', v)} disabled={fieldDisabled}>
              <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <FormField label="Job Title" value={(form.jobTitle as string) || ''} onChange={(v) => setField('jobTitle', v)} disabled={fieldDisabled} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reporting Manager</Label>
            <Select value={form.reportingManagerId || ''} onValueChange={(v) => setField('reportingManagerId', v)} disabled={fieldDisabled}>
              <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {managerOptions.filter((e) => e.id !== id).map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormField label="Joining Date" type="date" value={(form.joiningDate as string) || ''} onChange={(v) => setField('joiningDate', v)} disabled={fieldDisabled} />
          <FormField label="Date of Birth" type="date" value={(form.dateOfBirth as string) || ''} onChange={(v) => setField('dateOfBirth', v)} disabled={fieldDisabled} />
        </div>

        <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest pt-2">Salary Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Salary Type</Label>
            <Select value={form.salaryType} onValueChange={(v) => setField('salaryType', v as SalaryType)} disabled={fieldDisabled}>
              <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Fixed Monthly">Fixed Monthly</SelectItem>
                <SelectItem value="Hourly Rate">Hourly Rate</SelectItem>
                <SelectItem value="Per Session">Per Session</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <FormField label="Amount/Rate (LKR)" value={String(form.salaryAmount || '')} onChange={(v) => setField('salaryAmount', Number(v))} type="number" disabled={fieldDisabled} />
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</Label>
            <Select value={form.status} onValueChange={(v) => setField('status', v as EmployeeStatus)} disabled={fieldDisabled}>
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
          <FormField label="Bank Name" value={(form.bankName as string) || ''} onChange={(v) => setField('bankName', v)} disabled={fieldDisabled} />
          <FormField label="Account Number" value={(form.accountNumber as string) || ''} onChange={(v) => setField('accountNumber', v)} disabled={fieldDisabled} />
          <FormField label="Account Holder Name" value={(form.accountHolderName as string) || ''} onChange={(v) => setField('accountHolderName', v)} disabled={fieldDisabled} />
        </div>

        <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest pt-2">Additional Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Address" value={(form.address as string) || ''} onChange={(v) => setField('address', v)} disabled={fieldDisabled} />
          <FormField label="Nationality" value={(form.nationality as string) || ''} onChange={(v) => setField('nationality', v)} disabled={fieldDisabled} />
          <FormField label="Passport Number" value={(form.passportNumber as string) || ''} onChange={(v) => setField('passportNumber', v)} disabled={fieldDisabled} />
        </div>

        {isEdit && isSuperAdmin && (
          <>
            <h3 className="font-bold text-xs text-muted-foreground uppercase tracking-widest pt-2 flex items-center gap-2">
              <PanelLeft className="w-3.5 h-3.5 opacity-70" /> Portal & sidebar access
            </h3>
            <div className="rounded-xl border border-border/50 bg-muted/10 p-4 space-y-4">
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portal role</Label>
                <Select
                  value={editPortalRole}
                  onValueChange={(v) => {
                    const nr = v as UserRole;
                    setEditPortalRole(nr);
                    if (sidebarCustomize) {
                      const allowed = new Set(navKeysAllowedForRole(nr));
                      setCustomNavKeys((prev) => {
                        const next = new Set<SidebarNavKey>();
                        for (const k of prev) {
                          if (allowed.has(k)) next.add(k);
                        }
                        next.add('dashboard');
                        return next;
                      });
                    } else {
                      setCustomNavKeys(new Set(navKeysAllowedForRole(nr)));
                    }
                  }}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl h-10 max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        <span className="font-medium">{r.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  This is the account&apos;s permission level. HR staff can differ: use the switch below to show only some sidebar modules for this person.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/40 bg-background/40 px-3 py-3">
                <div>
                  <p className="text-sm font-medium">Customize sidebar</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xl">
                    Off: menu follows the portal role defaults. On: pick exactly which items appear when they log in (e.g. one HR sees Payroll, another does not).
                  </p>
                </div>
                <Switch
                  checked={sidebarCustomize}
                  onCheckedChange={(on) => {
                    setSidebarCustomize(on);
                    if (on) setCustomNavKeys(new Set(navKeysAllowedForRole(editPortalRole)));
                  }}
                />
              </div>

              {sidebarCustomize && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {navDefsForEditRole.map((d) => {
                    const locked = d.navKey === 'dashboard';
                    const checked = locked || customNavKeys.has(d.navKey);
                    return (
                      <div
                        key={d.navKey}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border/35 px-3 py-2 bg-background/30"
                      >
                        <span className={`text-sm ${locked ? 'text-muted-foreground' : ''}`}>
                          {d.title}
                          {locked ? <span className="text-[10px] ml-1 text-muted-foreground">(always on)</span> : null}
                        </span>
                        <Switch
                          checked={checked}
                          disabled={locked}
                          onCheckedChange={() => toggleSidebarNavKey(d.navKey)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {canEdit && (
          <div className="rounded-xl border border-border/50 p-4 space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5" /> New Password (optional)
            </Label>
            <Input
              type="password"
              value={loginPassword}
              onChange={(ev) => setLoginPassword(ev.target.value)}
              placeholder="Leave blank to keep current password"
              className="rounded-xl h-10 max-w-md"
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={saving || !canEdit} className="rounded-xl shadow-md shadow-primary/20 min-w-[160px]">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Update Employee'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/employees')} className="rounded-xl">Cancel</Button>
        </div>
      </form>
    </div>
  );
}
