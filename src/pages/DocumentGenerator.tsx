import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEmployees } from '@/lib/employeeService';
import { postGeneratedDocument } from '@/lib/hrApi';
import type { Employee } from '@/types/hr';
import { DocumentType } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Save, Check, Loader2 } from 'lucide-react';

const docTypes: DocumentType[] = [
  'Offer Letter',
  'Employment Contract',
  'Freelancer Agreement',
  'MOU',
  'Partner Agreement',
  'Candidate Agreement',
  'Experience Letter',
  'Confirmation Letter',
  'Warning Letter',
  'Relieving Letter',
];

export default function DocumentGenerator() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [docType, setDocType] = useState<DocumentType | ''>('');
  const [linkedEmployee, setLinkedEmployee] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEmployees()
      .then(setEmployees)
      .finally(() => setLoadingEmps(false));
  }, []);

  const emp = employees.find((e) => e.id === linkedEmployee);

  const getFieldsForType = (type: DocumentType): string[] => {
    const common = ['Document Date', 'Party Names', 'Address', 'Contact'];
    if (
      [
        'Offer Letter',
        'Employment Contract',
        'Freelancer Agreement',
        'Experience Letter',
        'Confirmation Letter',
        'Warning Letter',
        'Relieving Letter',
      ].includes(type)
    ) {
      return [...common, 'Job Role', 'Department', 'Joining Date', 'Salary/Rate', 'Probation Period', 'Notice Period', 'Reporting Manager'];
    }
    if (['Candidate Agreement'].includes(type)) {
      return [...common, 'Program Type', 'Contract Start Date', 'Contract End Date', 'Stipend/Salary', 'Work Hours'];
    }
    if (['MOU', 'Partner Agreement'].includes(type)) {
      return [...common, 'Scope of Services', 'Revenue Sharing %', 'Jurisdiction', 'Validity Period', 'Renewal Terms'];
    }
    return common;
  };

  const handleGenerate = () => {
    if (emp) {
      setFields((prev) => ({
        ...prev,
        'Party Names': emp.fullName,
        Address: emp.address,
        Contact: emp.phone,
        'Job Role': emp.jobTitle,
        Department: emp.department,
        'Joining Date': emp.joiningDate,
        'Salary/Rate': `LKR ${emp.salaryAmount.toLocaleString()}`,
      }));
    }
    setStep(3);
  };

  const handleSave = async () => {
    if (!docType) return;
    setSaving(true);
    const name = `${docType} — ${fields['Party Names'] || emp?.fullName || 'Recipient'}`;
    const dateStr = fields['Document Date'] || new Date().toLocaleDateString('en-GB');
    const content = JSON.stringify(fields);
    const created = await postGeneratedDocument({
      name,
      type: docType,
      linkedTo: linkedEmployee || fields['Party Names'] || '',
      linkedType: 'Employee',
      date: dateStr,
      content,
    });
    setSaving(false);
    if (created) {
      toast({ title: 'Saved', description: 'Document stored in the database.' });
      navigate('/documents');
    } else {
      toast({ title: 'Save failed', description: 'Could not save the document.', variant: 'destructive' });
    }
  };

  if (loadingEmps) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Generate Document"
        action={
          <Button variant="ghost" onClick={() => navigate('/documents')} className="gap-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        }
      />

      <div className="flex items-center gap-2 mb-8">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                s < step
                  ? 'bg-success text-success-foreground'
                  : s === step
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? <Check className="w-3.5 h-3.5" /> : s}
            </div>
            <span className={`text-xs hidden sm:inline font-semibold ${s <= step ? 'text-foreground' : 'text-muted-foreground'}`}>
              {s === 1 ? 'Type' : s === 2 ? 'Recipient' : s === 3 ? 'Fields' : 'Preview'}
            </span>
            {s < 4 && <div className={`w-8 h-0.5 ${s < step ? 'bg-success' : 'bg-border'}`} />}
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-6">
        {step === 1 && (
          <div className="space-y-5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Document Type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as DocumentType)}>
              <SelectTrigger className="rounded-xl h-10">
                <SelectValue placeholder="Choose document type" />
              </SelectTrigger>
              <SelectContent>
                {docTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!docType} onClick={() => setStep(2)} className="rounded-xl">
              Next
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select Employee / Enter Recipient</Label>
            <Select value={linkedEmployee} onValueChange={setLinkedEmployee}>
              <SelectTrigger className="rounded-xl h-10">
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl">
                Back
              </Button>
              <Button disabled={!linkedEmployee} onClick={handleGenerate} className="rounded-xl">
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 3 && docType && (
          <div className="space-y-5">
            <h3 className="font-bold text-sm">Fill Document Fields</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getFieldsForType(docType).map((field) => (
                <div key={field}>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{field}</Label>
                  <Input
                    value={fields[field] || ''}
                    onChange={(e) => setFields((prev) => ({ ...prev, [field]: e.target.value }))}
                    className="mt-1.5 rounded-xl h-10"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl">
                Back
              </Button>
              <Button onClick={() => setStep(4)} className="rounded-xl">
                Preview
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h3 className="font-bold text-sm">Document Preview</h3>
            <div className="border border-border/50 rounded-xl p-6 bg-background min-h-[300px]">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold">Gluck Global</h2>
                <p className="text-xs text-muted-foreground">Srimavo Bandaranayaka Mawatha, Peradeniya Road, Kandy, Sri Lanka</p>
                <p className="text-xs text-muted-foreground">info@gluckglobal.com | www.gluckglobal.com</p>
              </div>
              <h3 className="text-center font-bold text-lg mb-4 underline">{docType}</h3>
              <div className="space-y-2 text-sm">
                <p>
                  Date: <span className="font-mono">{fields['Document Date'] || new Date().toLocaleDateString()}</span>
                </p>
                <p>
                  To: <strong>{fields['Party Names'] || 'N/A'}</strong>
                </p>
                <p>Address: {fields['Address'] || 'N/A'}</p>
                <br />
                <p>Dear {fields['Party Names']?.split(' ')[0] || 'Sir/Madam'},</p>
                <br />
                <p>We are pleased to confirm the following details regarding your {docType?.toLowerCase()} with Gluck Global.</p>
                {Object.entries(fields)
                  .filter(([k]) => !['Document Date', 'Party Names', 'Address', 'Contact'].includes(k))
                  .map(([k, v]) => (
                    <p key={k}>
                      <strong>{k}:</strong> {v || 'N/A'}
                    </p>
                  ))}
                <br />
                <p>Sincerely,</p>
                <p>
                  <strong>Gluck Global</strong>
                </p>
                <p>Human Resources Department</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setStep(3)} className="rounded-xl">
                Back
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={() => toast({ title: 'Download', description: 'Export to file is not configured yet.' })}
              >
                <Download className="w-4 h-4" /> Download DOCX
              </Button>
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={() => toast({ title: 'Download', description: 'Export to file is not configured yet.' })}
              >
                <Download className="w-4 h-4" /> Download PDF
              </Button>
              <Button
                className="gap-2 rounded-xl shadow-md shadow-primary/20"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
