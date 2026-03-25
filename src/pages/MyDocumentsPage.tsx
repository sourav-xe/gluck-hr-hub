import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2, FileText, Upload, Download, Loader2,
  AlertCircle, ShieldCheck, FileX,
} from 'lucide-react';

const ALL_DOCS = [
  { docType: 'aadhar_card',   label: 'Aadhar Card',                               required: true,  icon: '🪪' },
  { docType: 'pan_card',      label: 'PAN Card',                                  required: true,  icon: '💳' },
  { docType: 'photo',         label: 'Passport Photo',                            required: true,  icon: '🖼️' },
  { docType: 'salary_slip',   label: 'Last Salary Slip (Previous Company)',       required: false, icon: '💰' },
  { docType: 'offer_letter',  label: 'Offer Letter / Relieving Letter',           required: false, icon: '📄' },
  { docType: 'education_cert',label: 'Educational Certificates',                  required: false, icon: '🎓' },
  { docType: 'bank_proof',    label: 'Bank Proof (Cancelled Cheque / Passbook)',  required: false, icon: '🏦' },
];

interface DocMeta {
  id?: string;
  docType: string;
  label: string;
  fileName: string;
  uploadedAt?: string;
}

function base64ToBlob(b64: string, mime: string): Blob {
  const byteStr = atob(b64.split(',')[1] ?? b64);
  const arr = new Uint8Array(byteStr.length);
  for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function MyDocumentsPage() {
  const { toast } = useToast();
  const [uploadedDocs, setUploadedDocs] = useState<DocMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    apiFetch('/api/onboarding/documents')
      .then((r) => r.json())
      .then((docs: DocMeta[]) => setUploadedDocs(Array.isArray(docs) ? docs : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const uploadedMap = new Map(uploadedDocs.map((d) => [d.docType, d]));

  async function handleDownload(docType: string) {
    setDownloadingDoc(docType);
    try {
      const res = await apiFetch(`/api/onboarding/documents/${docType}/download`);
      if (!res.ok) {
        toast({ title: 'Download failed', description: 'Could not retrieve this document.', variant: 'destructive' });
        return;
      }
      const { fileName, mimeType, data } = await res.json() as { fileName: string; mimeType: string; data: string };
      const blob = base64ToBlob(data, mimeType || 'application/octet-stream');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `${docType}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: 'Downloaded', description: `${fileName} downloaded successfully.` });
    } catch {
      toast({ title: 'Download error', variant: 'destructive' });
    } finally {
      setDownloadingDoc(null);
    }
  }

  async function handleUpload(docType: string, label: string, file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB per document.', variant: 'destructive' });
      return;
    }
    setUploadingDoc(docType);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = String(reader.result);
        const res = await apiFetch('/api/onboarding/documents', {
          method: 'POST',
          body: JSON.stringify({ docType, label, fileName: file.name, mimeType: file.type, data }),
        });
        if (!res.ok) {
          toast({ title: 'Upload failed', description: 'Could not save document.', variant: 'destructive' });
          return;
        }
        const result = await res.json() as { documents: DocMeta[] };
        setUploadedDocs(result.documents || []);
        toast({ title: 'Uploaded', description: `${label} uploaded successfully.` });
      } catch {
        toast({ title: 'Upload error', variant: 'destructive' });
      } finally {
        setUploadingDoc(null);
      }
    };
    reader.readAsDataURL(file);
  }

  const requiredDocs = ALL_DOCS.filter((d) => d.required);
  const optionalDocs = ALL_DOCS.filter((d) => !d.required);
  const submittedCount = ALL_DOCS.filter((d) => uploadedMap.has(d.docType)).length;
  const requiredDone = requiredDocs.every((d) => uploadedMap.has(d.docType));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading your documents…
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 max-w-7xl">
      <PageHeader
        title="My Documents"
        description={`${submittedCount} of ${ALL_DOCS.length} documents submitted`}
      />

      {/* Status banner */}
      <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${
        requiredDone
          ? 'border-emerald-500/25 bg-emerald-500/8'
          : 'border-amber-500/25 bg-amber-500/8'
      }`}>
        {requiredDone
          ? <ShieldCheck className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          : <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />}
        <div>
          <p className={`text-sm font-semibold ${requiredDone ? 'text-emerald-400' : 'text-amber-400'}`}>
            {requiredDone ? 'All required documents are on file.' : 'Some required documents are missing.'}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {requiredDone
              ? 'You can add optional documents below anytime.'
              : 'Please upload required documents marked with ✱. Contact HR if you need help.'}
          </p>
        </div>
      </div>

      {/* Required Docs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-destructive" />
          Required Documents
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {requiredDocs.map((doc) => (
            <DocRow
              key={doc.docType}
              doc={doc}
              meta={uploadedMap.get(doc.docType)}
              isDownloading={downloadingDoc === doc.docType}
              isUploading={uploadingDoc === doc.docType}
              fileRef={(el) => { fileRefs.current[doc.docType] = el; }}
              onDownload={() => void handleDownload(doc.docType)}
              onUploadClick={() => fileRefs.current[doc.docType]?.click()}
              onFileChange={(file) => void handleUpload(doc.docType, doc.label, file)}
            />
          ))}
        </div>
      </section>

      {/* Optional Docs */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-primary" />
          Optional Documents
          <span className="text-[10px] font-normal normal-case text-muted-foreground/60 bg-muted rounded-full px-2 py-0.5">Can be added later</span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {optionalDocs.map((doc) => (
            <DocRow
              key={doc.docType}
              doc={doc}
              meta={uploadedMap.get(doc.docType)}
              isDownloading={downloadingDoc === doc.docType}
              isUploading={uploadingDoc === doc.docType}
              fileRef={(el) => { fileRefs.current[doc.docType] = el; }}
              onDownload={() => void handleDownload(doc.docType)}
              onUploadClick={() => fileRefs.current[doc.docType]?.click()}
              onFileChange={(file) => void handleUpload(doc.docType, doc.label, file)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function DocRow({
  doc, meta, isDownloading, isUploading,
  fileRef, onDownload, onUploadClick, onFileChange,
}: {
  doc: { docType: string; label: string; required: boolean; icon: string };
  meta?: DocMeta;
  isDownloading: boolean;
  isUploading: boolean;
  fileRef: (el: HTMLInputElement | null) => void;
  onDownload: () => void;
  onUploadClick: () => void;
  onFileChange: (file: File) => void;
}) {
  const uploaded = !!meta;
  const uploadedDate = meta?.uploadedAt
    ? new Date(meta.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className={`rounded-2xl border p-4 transition-colors ${
      uploaded
        ? 'border-emerald-500/25 bg-emerald-500/5 shadow-sm'
        : doc.required
        ? 'border-destructive/20 bg-destructive/5'
        : 'border-border/50 bg-card/60'
    }`}>
      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileChange(file);
          e.target.value = '';
        }}
      />

      <div className="flex items-start gap-3 min-w-0">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
          uploaded ? 'bg-emerald-500/12' : 'bg-muted/60'
        }`}>
          {uploaded ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <FileX className="w-5 h-5 text-muted-foreground/50" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold leading-none">{doc.label}</p>
            {doc.required && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-destructive border border-destructive/30 rounded px-1 py-0.5">Required</span>
            )}
          </div>
          {uploaded ? (
            <div className="flex items-center gap-1.5 mt-0.5">
              <FileText className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{meta.fileName}</p>
              {uploadedDate && (
                <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">· {uploadedDate}</span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              {doc.required ? 'Not uploaded yet — required' : 'Not uploaded — optional'}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-end gap-2">
        {uploaded && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 rounded-lg text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            disabled={isDownloading}
            onClick={onDownload}
          >
            {isDownloading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Download className="w-3 h-3" />}
            {isDownloading ? 'Downloading…' : 'Download'}
          </Button>
        )}

        {!uploaded && (
          <Button
            size="sm"
            variant={doc.required ? 'default' : 'outline'}
            className="gap-1.5 h-8 rounded-lg text-xs"
            disabled={isUploading}
            onClick={onUploadClick}
          >
            {isUploading
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : <Upload className="w-3 h-3" />}
            {isUploading ? 'Uploading…' : 'Upload'}
          </Button>
        )}
      </div>
    </div>
  );
}
