import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employees } from '@/data/mockData';
import { DocumentType } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Save } from 'lucide-react';

const docTypes: DocumentType[] = [
  'Offer Letter', 'Employment Contract', 'Freelancer Agreement', 'MOU',
  'Partner Agreement', 'Candidate Agreement', 'Experience Letter',
  'Confirmation Letter', 'Warning Letter', 'Relieving Letter',
];

export default function DocumentGenerator() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [docType, setDocType] = useState<DocumentType | ''>('');
  const [linkedEmployee, setLinkedEmployee] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});

  const emp = employees.find(e => e.id === linkedEmployee);

  const getFieldsForType = (type: DocumentType): string[] => {
    const common = ['Document Date', 'Party Names', 'Address', 'Contact'];
    if (['Offer Letter', 'Employment Contract', 'Freelancer Agreement', 'Experience Letter', 'Confirmation Letter', 'Warning Letter', 'Relieving Letter'].includes(type)) {
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
      setFields(prev => ({
        ...prev,
        'Party Names': emp.fullName,
        'Address': emp.address,
        'Contact': emp.phone,
        'Job Role': emp.jobTitle,
        'Department': emp.department,
        'Joining Date': emp.joiningDate,
        'Salary/Rate': `LKR ${emp.salaryAmount.toLocaleString()}`,
      }));
    }
    setStep(3);
  };

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Generate Document"
        action={<Button variant="ghost" onClick={() => navigate('/documents')} className="gap-2"><ArrowLeft className="w-4 h-4" /> Back</Button>}
      />

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3, 4].map(s => (
          <div key={s} className={`flex items-center gap-2 ${s <= step ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border-2 ${s <= step ? 'border-primary bg-primary text-primary-foreground' : 'border-muted'}`}>
              {s}
            </div>
            <span className="text-xs hidden sm:inline">
              {s === 1 ? 'Type' : s === 2 ? 'Recipient' : s === 3 ? 'Fields' : 'Preview'}
            </span>
            {s < 4 && <div className="w-8 h-0.5 bg-border" />}
          </div>
        ))}
      </div>

      <div className="bg-card rounded-lg border p-6">
        {step === 1 && (
          <div className="space-y-4">
            <Label>Select Document Type</Label>
            <Select value={docType} onValueChange={v => setDocType(v as DocumentType)}>
              <SelectTrigger><SelectValue placeholder="Choose document type" /></SelectTrigger>
              <SelectContent>
                {docTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button disabled={!docType} onClick={() => setStep(2)}>Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Label>Select Employee / Enter Recipient</Label>
            <Select value={linkedEmployee} onValueChange={setLinkedEmployee}>
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.fullName}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button disabled={!linkedEmployee} onClick={handleGenerate}>Next</Button>
            </div>
          </div>
        )}

        {step === 3 && docType && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Fill Document Fields</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getFieldsForType(docType).map(field => (
                <div key={field}>
                  <Label className="text-sm">{field}</Label>
                  <Input
                    value={fields[field] || ''}
                    onChange={e => setFields(prev => ({ ...prev, [field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={() => setStep(4)}>Preview</Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Document Preview</h3>
            <div className="border rounded-md p-6 bg-background min-h-[300px]">
              <div className="text-center mb-6">
                <h2 className="text-lg font-bold">Gluck Global</h2>
                <p className="text-xs text-muted-foreground">Srimavo Bandaranayaka Mawatha, Peradeniya Road, Kandy, Sri Lanka</p>
                <p className="text-xs text-muted-foreground">info@gluckglobal.com | www.gluckglobal.com</p>
              </div>
              <h3 className="text-center font-bold text-lg mb-4 underline">{docType}</h3>
              <div className="space-y-2 text-sm">
                <p>Date: {fields['Document Date'] || new Date().toLocaleDateString()}</p>
                <p>To: <strong>{fields['Party Names'] || 'N/A'}</strong></p>
                <p>Address: {fields['Address'] || 'N/A'}</p>
                <br />
                <p>Dear {fields['Party Names']?.split(' ')[0] || 'Sir/Madam'},</p>
                <br />
                <p>We are pleased to confirm the following details regarding your {docType?.toLowerCase()} with Gluck Global.</p>
                {Object.entries(fields).filter(([k]) => !['Document Date', 'Party Names', 'Address', 'Contact'].includes(k)).map(([k, v]) => (
                  <p key={k}><strong>{k}:</strong> {v || 'N/A'}</p>
                ))}
                <br />
                <p>Sincerely,</p>
                <p><strong>Gluck Global</strong></p>
                <p>Human Resources Department</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'Downloaded', description: 'Document downloaded as DOCX' })}>
                <Download className="w-4 h-4" /> Download DOCX
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => toast({ title: 'Downloaded', description: 'Document downloaded as PDF' })}>
                <Download className="w-4 h-4" /> Download PDF
              </Button>
              <Button className="gap-2" onClick={() => { toast({ title: 'Saved', description: 'Document saved to employee record' }); navigate('/documents'); }}>
                <Save className="w-4 h-4" /> Save
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
