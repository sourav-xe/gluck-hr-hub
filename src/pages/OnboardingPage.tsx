import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  User,
  MapPin,
  CreditCard,
  Upload,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  Loader2,
  FileText,
  Shield,
  Heart,
  Building2,
  Phone,
  AlertCircle,
  Check,
} from 'lucide-react';

const INPUT_CLASS =
  'h-11 rounded-xl border-border/60 bg-background/80 focus-visible:ring-2 focus-visible:ring-primary/40';
const TEXTAREA_CLASS =
  'rounded-xl border-border/60 bg-background/80 focus-visible:ring-2 focus-visible:ring-primary/40';
const SELECT_CLASS =
  'flex h-11 w-full rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/40';

interface OnboardingData {
  fullName: string;
  phone: string;
  dateOfBirth: string;
  bloodGroup: string;
  maritalStatus: string;
  nationality: string;
  address: string;
  permanentAddress: string;
  emergencyContactName: string;
  emergencyContactRelation: string;
  emergencyContactPhone: string;
  aadhaarNumber: string;
  panNumber: string;
  pfNumber: string;
  uanNumber: string;
  passportNumber: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  ifscCode: string;
  previousCompany: string;
  previousSalary: string;
}

interface UploadedDoc {
  docType: string;
  label: string;
  fileName: string;
  uploadedAt?: string;
}

const REQUIRED_DOCS = [
  { docType: 'aadhar_card', label: 'Aadhar Card', required: true },
  { docType: 'pan_card', label: 'PAN Card', required: true },
  { docType: 'photo', label: 'Passport Photo', required: true },
  { docType: 'salary_slip', label: 'Last Salary Slip', required: false },
  { docType: 'offer_letter', label: 'Offer Letter / Relieving Letter', required: false },
  { docType: 'education_cert', label: 'Educational Certificates', required: false },
  { docType: 'bank_proof', label: 'Bank Account Proof (cancelled cheque / passbook)', required: false },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const MARITAL_STATUS = ['Single', 'Married', 'Divorced', 'Widowed'];

const STEPS = [
  { id: 1, title: 'Personal Info', icon: User, desc: 'Basic personal details' },
  { id: 2, title: 'Address & Emergency', icon: MapPin, desc: 'Address & emergency contact' },
  { id: 3, title: 'IDs & Bank', icon: Shield, desc: 'Government IDs & bank details' },
  { id: 4, title: 'Documents', icon: Upload, desc: 'Upload required documents' },
  { id: 5, title: 'Review & Submit', icon: CheckCircle, desc: 'Confirm and complete' },
];

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground/80">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-5 pb-3 border-b border-border/50">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
  );
}

export default function OnboardingPage() {
  const { user, signOut, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [employeeData, setEmployeeData] = useState<Partial<OnboardingData> & { department?: string; jobTitle?: string; joiningDate?: string }>({});

  const [form, setForm] = useState<OnboardingData>({
    fullName: user.name || '',
    phone: '',
    dateOfBirth: '',
    bloodGroup: '',
    maritalStatus: '',
    nationality: '',
    address: '',
    permanentAddress: '',
    emergencyContactName: '',
    emergencyContactRelation: '',
    emergencyContactPhone: '',
    aadhaarNumber: '',
    panNumber: '',
    pfNumber: '',
    uanNumber: '',
    passportNumber: '',
    bankName: '',
    accountNumber: '',
    accountHolderName: '',
    ifscCode: '',
    previousCompany: '',
    previousSalary: '',
  });

  useEffect(() => {
    apiFetch('/api/onboarding/me')
      .then((r) => r.json())
      .then((data) => {
        setEmployeeData(data);
        setForm((prev) => ({
          ...prev,
          fullName: data.fullName || user.name || '',
          phone: data.phone || '',
          dateOfBirth: data.dateOfBirth || '',
          bloodGroup: data.bloodGroup || '',
          maritalStatus: data.maritalStatus || '',
          nationality: data.nationality || '',
          address: data.address || '',
          permanentAddress: data.permanentAddress || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactRelation: data.emergencyContactRelation || '',
          emergencyContactPhone: data.emergencyContactPhone || '',
          aadhaarNumber: data.aadhaarNumber || '',
          panNumber: data.panNumber || '',
          pfNumber: data.pfNumber || '',
          uanNumber: data.uanNumber || '',
          passportNumber: data.passportNumber || '',
          bankName: data.bankName || '',
          accountNumber: data.accountNumber || '',
          accountHolderName: data.accountHolderName || '',
          ifscCode: data.ifscCode || '',
          previousCompany: data.previousCompany || '',
          previousSalary: data.previousSalary || '',
        }));
        if (data.onboardingStep && data.onboardingStep > 1) {
          setStep(data.onboardingStep);
        }
      })
      .catch(() => {});

    apiFetch('/api/onboarding/documents')
      .then((r) => r.json())
      .then((docs: UploadedDoc[]) => setUploadedDocs(docs || []))
      .catch(() => {});
  }, []);

  const set = (field: keyof OnboardingData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  async function saveStep(nextStep: number, complete = false) {
    setSaving(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {
        ...form,
        onboardingStep: nextStep,
      };
      if (complete) payload.onboardingComplete = true;

      const res = await apiFetch('/api/onboarding/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        let apiErr = 'Failed to save. Please try again.';
        try {
          const data = raw ? JSON.parse(raw) : {};
          apiErr = (data as { error?: string }).error || apiErr;
        } catch {
          if (raw) apiErr = raw.slice(0, 220);
        }
        setError(apiErr);
        return false;
      }
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg ? `Network error: ${msg}` : 'Network error. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function validate(s: number): string {
    if (s === 1) {
      if (!form.fullName.trim()) return 'Full name is required.';
      if (!form.phone.trim()) return 'Phone number is required.';
      if (!form.dateOfBirth) return 'Date of birth is required.';
    }
    if (s === 2) {
      if (!form.address.trim()) return 'Current address is required.';
      if (!form.emergencyContactName.trim()) return 'Emergency contact name is required.';
      if (!form.emergencyContactPhone.trim()) return 'Emergency contact phone is required.';
    }
    if (s === 3) {
      if (!form.aadhaarNumber.trim()) return 'Aadhar number is required.';
      if (!form.panNumber.trim()) return 'PAN number is required.';
      if (!form.bankName.trim()) return 'Bank name is required.';
      if (!form.accountNumber.trim()) return 'Account number is required.';
      if (!form.accountHolderName.trim()) return 'Account holder name is required.';
      if (!form.ifscCode.trim()) return 'IFSC code is required.';
    }
    if (s === 4) {
      const required = REQUIRED_DOCS.filter((d) => d.required);
      const uploaded = uploadedDocs.map((d) => d.docType);
      const missing = required.filter((d) => !uploaded.includes(d.docType)).map((d) => d.label);
      if (missing.length > 0) return `Please upload: ${missing.join(', ')}`;
    }
    return '';
  }

  async function handleNext() {
    const err = validate(step);
    if (err) { setError(err); return; }
    setError('');
    const ok = await saveStep(step + 1);
    if (ok) setStep((s) => s + 1);
  }

  async function handleSubmit() {
    const err = validate(5);
    if (err) { setError(err); return; }
    const ok = await saveStep(5, true);
    if (ok) {
      // Refresh auth so needsOnboarding becomes false, then navigate
      await refreshAuth();
      navigate('/', { replace: true });
    }
  }

  async function handleDocUpload(docType: string, label: string, file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Max size is 5MB per document.');
      return;
    }
    setUploadingDoc(docType);
    setError('');
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = String(reader.result);
        const res = await apiFetch('/api/onboarding/documents', {
          method: 'POST',
          body: JSON.stringify({ docType, label, fileName: file.name, mimeType: file.type, data }),
        });
        if (!res.ok) {
          setError('Failed to upload document.');
          return;
        }
        const result = await res.json();
        setUploadedDocs(result.documents || []);
      } catch {
        setError('Upload failed. Please try again.');
      } finally {
        setUploadingDoc(null);
      }
    };
    reader.readAsDataURL(file);
  }

  const completedSteps = step - 1;
  const progress = ((completedSteps) / (STEPS.length)) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-bold text-sm shadow">
            GG
          </div>
          <div>
            <p className="font-semibold text-sm leading-none">Gluck Global HRMS</p>
            <p className="text-xs text-muted-foreground mt-0.5">Employee Onboarding</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">Welcome, {user.name}</span>
          <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Complete Your Profile</h1>
          <p className="text-muted-foreground text-sm">Fill in your details to get access to your workspace. This usually takes 5–10 minutes.</p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {step} of {STEPS.length}</span>
            <span>{Math.round(progress)}% complete</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const active = step === s.id;
            const Icon = s.icon;
            return (
              <React.Fragment key={s.id}>
                <div className="flex flex-col items-center gap-1 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    done ? 'bg-primary border-primary text-primary-foreground' :
                    active ? 'border-primary bg-primary/10 text-primary' :
                    'border-border bg-card text-muted-foreground'
                  }`}>
                    {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <span className={`text-[10px] font-medium text-center leading-tight hidden sm:block ${active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 rounded transition-colors duration-300 ${done ? 'bg-primary' : 'bg-border'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step Content */}
        <div className="bg-card/95 border border-border/70 rounded-3xl shadow-lg shadow-black/5 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-accent/5 px-6 py-4 border-b border-border/50">
            <h2 className="font-semibold text-lg">{STEPS[step - 1].title}</h2>
            <p className="text-sm text-muted-foreground">{STEPS[step - 1].desc}</p>
          </div>
          <div className="p-6">
            {step === 1 && <Step1 form={form} set={set} employeeData={employeeData} />}
            {step === 2 && <Step2 form={form} set={set} />}
            {step === 3 && <Step3 form={form} set={set} />}
            {step === 4 && (
              <Step4
                uploadedDocs={uploadedDocs}
                uploadingDoc={uploadingDoc}
                onUpload={handleDocUpload}
              />
            )}
            {step === 5 && <Step5 form={form} uploadedDocs={uploadedDocs} employeeData={employeeData} />}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => { setError(''); setStep((s) => s - 1); }}
            disabled={step === 1 || saving}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          {step < 5 ? (
            <Button onClick={handleNext} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving} className="bg-green-600 hover:bg-green-700 text-white">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Complete Onboarding
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Personal Info ─────────────────────────────────────────────────────

function Step1({ form, set, employeeData }: {
  form: OnboardingData;
  set: (f: keyof OnboardingData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  employeeData: Record<string, unknown>;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle icon={User} title="Personal Information" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full Name" required>
          <Input value={form.fullName} onChange={set('fullName')} placeholder="Your full name" className={INPUT_CLASS} />
        </Field>
        <Field label="Phone Number" required>
          <Input value={form.phone} onChange={set('phone')} placeholder="+91 9876543210" type="tel" className={INPUT_CLASS} />
        </Field>
        <Field label="Date of Birth" required>
          <Input
            value={form.dateOfBirth}
            onChange={set('dateOfBirth')}
            type="date"
            className={`${INPUT_CLASS} pr-10 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert`}
          />
        </Field>
        <Field label="Blood Group">
          <select
            value={form.bloodGroup}
            onChange={set('bloodGroup')}
            className={SELECT_CLASS}
          >
            <option value="">Select blood group</option>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="Marital Status">
          <select
            value={form.maritalStatus}
            onChange={set('maritalStatus')}
            className={SELECT_CLASS}
          >
            <option value="">Select status</option>
            {MARITAL_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Nationality">
          <Input value={form.nationality} onChange={set('nationality')} placeholder="e.g. Indian" className={INPUT_CLASS} />
        </Field>
      </div>

      {(employeeData.department || employeeData.jobTitle || employeeData.joiningDate) && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Pre-filled by HR</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {employeeData.department && (
              <div>
                <p className="text-muted-foreground text-xs">Department</p>
                <p className="font-medium">{String(employeeData.department)}</p>
              </div>
            )}
            {employeeData.jobTitle && (
              <div>
                <p className="text-muted-foreground text-xs">Job Title</p>
                <p className="font-medium">{String(employeeData.jobTitle)}</p>
              </div>
            )}
            {employeeData.joiningDate && (
              <div>
                <p className="text-muted-foreground text-xs">Joining Date</p>
                <p className="font-medium">{String(employeeData.joiningDate)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <SectionTitle icon={Building2} title="Previous Employment (Optional)" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Previous Company">
            <Input value={form.previousCompany} onChange={set('previousCompany')} placeholder="Company name" className={INPUT_CLASS} />
          </Field>
          <Field label="Last Drawn Salary (₹)">
            <Input value={form.previousSalary} onChange={set('previousSalary')} placeholder="e.g. 50000" className={INPUT_CLASS} />
          </Field>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Address & Emergency ───────────────────────────────────────────────

function Step2({ form, set }: {
  form: OnboardingData;
  set: (f: keyof OnboardingData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}) {
  const [sameAddress, setSameAddress] = useState(false);

  const handleSameAddress = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSameAddress(e.target.checked);
    if (e.target.checked) {
      const event = { target: { value: form.address } } as React.ChangeEvent<HTMLTextAreaElement>;
      set('permanentAddress')(event);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle icon={MapPin} title="Address Details" />
      <div className="space-y-4">
        <Field label="Current Address" required>
          <Textarea value={form.address} onChange={set('address')} placeholder="House no, Street, City, State, PIN" rows={3} className={TEXTAREA_CLASS} />
        </Field>
        <div className="flex items-center gap-2">
          <input type="checkbox" id="same" checked={sameAddress} onChange={handleSameAddress} className="rounded" />
          <label htmlFor="same" className="text-sm text-muted-foreground cursor-pointer">Permanent address same as current address</label>
        </div>
        <Field label="Permanent Address">
          <Textarea
            value={form.permanentAddress}
            onChange={set('permanentAddress')}
            placeholder="House no, Street, City, State, PIN"
            rows={3}
            disabled={sameAddress}
            className={TEXTAREA_CLASS}
          />
        </Field>
      </div>

      <SectionTitle icon={Phone} title="Emergency Contact" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Contact Name" required>
          <Input value={form.emergencyContactName} onChange={set('emergencyContactName')} placeholder="Full name" className={INPUT_CLASS} />
        </Field>
        <Field label="Relationship" required>
          <select
            value={form.emergencyContactRelation}
            onChange={set('emergencyContactRelation')}
            className={SELECT_CLASS}
          >
            <option value="">Select relation</option>
            {['Father', 'Mother', 'Spouse', 'Sibling', 'Friend', 'Other'].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="Phone Number" required>
          <Input value={form.emergencyContactPhone} onChange={set('emergencyContactPhone')} placeholder="+91 9876543210" type="tel" className={INPUT_CLASS} />
        </Field>
      </div>
    </div>
  );
}

// ── Step 3: IDs & Bank ────────────────────────────────────────────────────────

function Step3({ form, set }: {
  form: OnboardingData;
  set: (f: keyof OnboardingData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle icon={Shield} title="Government IDs" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Aadhar Number" required>
          <Input value={form.aadhaarNumber} onChange={set('aadhaarNumber')} placeholder="XXXX XXXX XXXX" maxLength={14} className={INPUT_CLASS} />
        </Field>
        <Field label="PAN Number" required>
          <Input value={form.panNumber} onChange={set('panNumber')} placeholder="ABCDE1234F" maxLength={10} className={`${INPUT_CLASS} uppercase`} />
        </Field>
        <Field label="PF Number">
          <Input value={form.pfNumber} onChange={set('pfNumber')} placeholder="PF account number" className={INPUT_CLASS} />
        </Field>
        <Field label="UAN Number">
          <Input value={form.uanNumber} onChange={set('uanNumber')} placeholder="Universal Account Number" className={INPUT_CLASS} />
        </Field>
        <Field label="Passport Number">
          <Input value={form.passportNumber} onChange={set('passportNumber')} placeholder="Optional" className={INPUT_CLASS} />
        </Field>
      </div>

      <SectionTitle icon={CreditCard} title="Bank Account Details" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Account Holder Name" required>
          <Input value={form.accountHolderName} onChange={set('accountHolderName')} placeholder="As per bank records" className={INPUT_CLASS} />
        </Field>
        <Field label="Bank Name" required>
          <Input value={form.bankName} onChange={set('bankName')} placeholder="e.g. HDFC Bank" className={INPUT_CLASS} />
        </Field>
        <Field label="Account Number" required>
          <Input value={form.accountNumber} onChange={set('accountNumber')} placeholder="Bank account number" className={INPUT_CLASS} />
        </Field>
        <Field label="IFSC Code" required>
          <Input value={form.ifscCode} onChange={set('ifscCode')} placeholder="e.g. HDFC0001234" className={`${INPUT_CLASS} uppercase`} maxLength={11} />
        </Field>
      </div>
    </div>
  );
}

// ── Step 4: Document Upload ───────────────────────────────────────────────────

function Step4({
  uploadedDocs,
  uploadingDoc,
  onUpload,
}: {
  uploadedDocs: UploadedDoc[];
  uploadingDoc: string | null;
  onUpload: (docType: string, label: string, file: File) => void;
}) {
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const uploaded = uploadedDocs.map((d) => d.docType);

  return (
    <div className="space-y-5">
      <SectionTitle icon={Upload} title="Document Upload" />
      <p className="text-sm text-muted-foreground -mt-2">
        Upload clear scans or photos. Max 5MB per file. Aadhar card, PAN card, and Photo are required.
      </p>

      <div className="grid gap-3">
        {REQUIRED_DOCS.map((doc) => {
          const isUploaded = uploaded.includes(doc.docType);
          const isUploading = uploadingDoc === doc.docType;
          const uploadedDoc = uploadedDocs.find((d) => d.docType === doc.docType);

          return (
            <div
              key={doc.docType}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                isUploaded
                  ? 'border-green-500/40 bg-green-500/5'
                  : doc.required
                  ? 'border-destructive/30 bg-destructive/5'
                  : 'border-border bg-card/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  isUploaded ? 'bg-green-500/15' : 'bg-muted'
                }`}>
                  {isUploaded ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-none">
                    {doc.label}
                    {doc.required && <span className="text-destructive ml-1 text-xs">*</span>}
                  </p>
                  {isUploaded && uploadedDoc && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 truncate max-w-[220px]">
                      ✓ {uploadedDoc.fileName}
                    </p>
                  )}
                  {!isUploaded && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {doc.required ? 'Required' : 'Optional'} · PDF, JPG, PNG
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <input
                  type="file"
                  ref={(el) => { fileRefs.current[doc.docType] = el; }}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUpload(doc.docType, doc.label, file);
                    e.target.value = '';
                  }}
                />
                <Button
                  size="sm"
                  variant={isUploaded ? 'outline' : 'default'}
                  disabled={isUploading}
                  onClick={() => fileRefs.current[doc.docType]?.click()}
                >
                  {isUploading ? (
                    <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Uploading</>
                  ) : isUploaded ? (
                    <><Upload className="w-3 h-3 mr-1" /> Replace</>
                  ) : (
                    <><Upload className="w-3 h-3 mr-1" /> Upload</>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 5: Review & Submit ───────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[55%]">{value}</span>
    </div>
  );
}

function ReviewSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <div className="bg-muted/40 px-4 py-2.5 flex items-center gap-2 border-b border-border/40">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

function Step5({ form, uploadedDocs, employeeData }: {
  form: OnboardingData;
  uploadedDocs: UploadedDoc[];
  employeeData: Record<string, unknown>;
}) {
  const uploaded = uploadedDocs.map((d) => d.docType);
  const requiredDocs = REQUIRED_DOCS.filter((d) => d.required);
  const allRequiredUploaded = requiredDocs.every((d) => uploaded.includes(d.docType));

  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-4 flex items-start gap-3 ${allRequiredUploaded ? 'bg-green-500/10 border border-green-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
        {allRequiredUploaded ? (
          <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
        )}
        <div>
          <p className={`text-sm font-semibold ${allRequiredUploaded ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
            {allRequiredUploaded ? 'All required documents uploaded!' : 'Missing required documents'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allRequiredUploaded
              ? 'Review your details below and click "Complete Onboarding" to finish.'
              : 'Please go back to Step 4 and upload all required documents before submitting.'}
          </p>
        </div>
      </div>

      <ReviewSection title="Personal Info" icon={User}>
        <ReviewRow label="Full Name" value={form.fullName} />
        <ReviewRow label="Phone" value={form.phone} />
        <ReviewRow label="Date of Birth" value={form.dateOfBirth} />
        <ReviewRow label="Blood Group" value={form.bloodGroup} />
        <ReviewRow label="Marital Status" value={form.maritalStatus} />
        <ReviewRow label="Nationality" value={form.nationality} />
        {employeeData.department && <ReviewRow label="Department" value={String(employeeData.department)} />}
        {employeeData.jobTitle && <ReviewRow label="Job Title" value={String(employeeData.jobTitle)} />}
      </ReviewSection>

      <ReviewSection title="Address & Emergency" icon={MapPin}>
        <ReviewRow label="Current Address" value={form.address} />
        <ReviewRow label="Permanent Address" value={form.permanentAddress} />
        <ReviewRow label="Emergency Contact" value={form.emergencyContactName} />
        <ReviewRow label="Relationship" value={form.emergencyContactRelation} />
        <ReviewRow label="Emergency Phone" value={form.emergencyContactPhone} />
      </ReviewSection>

      <ReviewSection title="Government IDs & Bank" icon={Shield}>
        <ReviewRow label="Aadhar Number" value={form.aadhaarNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')} />
        <ReviewRow label="PAN Number" value={form.panNumber.toUpperCase()} />
        <ReviewRow label="Bank" value={form.bankName} />
        <ReviewRow label="Account Number" value={form.accountNumber} />
        <ReviewRow label="Account Holder" value={form.accountHolderName} />
        <ReviewRow label="IFSC Code" value={form.ifscCode.toUpperCase()} />
      </ReviewSection>

      <ReviewSection title="Documents" icon={FileText}>
        {REQUIRED_DOCS.map((doc) => (
          <div key={doc.docType} className="flex justify-between py-1.5 border-b border-border/30 last:border-0">
            <span className="text-sm text-muted-foreground">{doc.label}</span>
            <span className={`text-sm font-medium ${uploaded.includes(doc.docType) ? 'text-green-500' : doc.required ? 'text-destructive' : 'text-muted-foreground'}`}>
              {uploaded.includes(doc.docType) ? '✓ Uploaded' : doc.required ? '✗ Missing' : '—'}
            </span>
          </div>
        ))}
      </ReviewSection>
    </div>
  );
}
