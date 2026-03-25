import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { fetchEmployees } from '@/lib/employeeService';
import Papa from 'papaparse';
import {
  deleteDocumentTemplate,
  detectDocumentPlaceholders,
  downloadAutomationFile,
  fetchDocumentRuns,
  fetchDocumentTemplate,
  fetchDocumentTemplates,
  fetchEmployeeDocDefaults,
  generateDocument,
  generateDocumentBatch,
  patchDocumentTemplate,
  previewDocument,
  uploadDocumentTemplate,
} from '@/lib/documentAutomationApi';
import type { DocPlaceholderRow, DocumentAutomationRunRow, DocumentTemplateRow, Employee } from '@/types/hr';
import { ArrowLeft, Eye, FileDown, FileSpreadsheet, Info, Loader2, Sparkles, Trash2, Upload, Wand2 } from 'lucide-react';

function templateIsPdf(t: Pick<DocumentTemplateRow, 'templateKind'> | null | undefined) {
  return (t?.templateKind ?? 'docx') === 'pdf';
}

const DYNAMIC_FIELDS_HINT_KEY = 'hrms_doc_dynamic_fields_hint';

function WorkflowSteps({ active }: { active: 1 | 2 | 3 }) {
  const item = (n: 1 | 2 | 3, label: string) => (
    <li
      className={`rounded-lg px-2.5 py-1 ${
        active === n ? 'bg-primary/15 text-primary font-semibold' : 'text-muted-foreground'
      }`}
    >
      {n}. {label}
    </li>
  );
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs mb-6 list-none p-0">
      {item(1, 'Upload & name')}
      <span className="text-muted-foreground/50">→</span>
      {item(2, 'Generate template')}
      <span className="text-muted-foreground/50">→</span>
      {item(3, 'Make document')}
    </ol>
  );
}

function SubNav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors ${
      isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    }`;

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      <NavLink to="/automations/documents/templates" className={linkClass}>
        Upload & templates
      </NavLink>
      <NavLink to="/automations/documents/generate" className={linkClass}>
        Make document
      </NavLink>
      <NavLink to="/automations/documents/history" className={linkClass}>
        History
      </NavLink>
    </div>
  );
}

function TemplatesSection() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [list, setList] = useState<DocumentTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setList(await fetchDocumentTemplates());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onUpload = async () => {
    if (!file || !name.trim()) {
      toast({ title: 'Missing fields', description: 'Name and Word or PDF file are required.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    const created = await uploadDocumentTemplate(file, { name: name.trim(), category: 'General' });
    setUploading(false);
    if (created) {
      toast({ title: 'Template uploaded' });
      setName('');
      setFile(null);
      await load();
      navigate(`/automations/documents/templates/${created.id}?setup=1`);
    } else {
      toast({ title: 'Upload failed', variant: 'destructive' });
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this template and its stored files?')) return;
    const ok = await deleteDocumentTemplate(id);
    if (ok) {
      toast({ title: 'Deleted' });
      void load();
    } else toast({ title: 'Delete failed', variant: 'destructive' });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-16">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading templates…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <WorkflowSteps active={1} />
      <div className="glass-card-hover rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <Upload className="w-4 h-4" /> Step 1 — Name the document and upload
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Type how this template should appear in the library. For <strong className="text-foreground">Word</strong>, use{' '}
          <strong className="text-destructive">red</strong> text for anything that changes per person; after upload, detection
          reads those fields (AI can label them). For <strong className="text-foreground">PDF</strong> uploads, put placeholders
          in the PDF text as <code className="text-[11px]">{'{{field_key}}'}</code> or{' '}
          <code className="text-[11px]">{'<<field_key>>'}</code> — detection scans the text layer (not Word “red runs”).
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Document name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Offer letter — Sales" />
          </div>
          <div className="space-y-2">
            <Label>Word/PDF file</Label>
            <Input type="file" accept=".docx,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <Button type="button" disabled={uploading} onClick={() => void onUpload()} className="rounded-xl">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload document'}
        </Button>
      </div>

      <div className="space-y-3">
        <h3 className="font-bold text-sm">Library</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">No templates yet. Upload a DOCX or run seed for a sample.</p>
        ) : (
          <div className="rounded-2xl border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-lg text-[10px] font-mono">
                        {templateIsPdf(t) ? 'PDF' : 'DOCX'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.category}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={t.status === 'active' ? 'default' : 'secondary'} className="rounded-lg text-[10px]">
                          {t.status}
                        </Badge>
                        {t.mappingsCommitted || t.status === 'active' ? (
                          <Badge variant="outline" className="rounded-lg text-[10px]">
                            Generated
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => navigate(`/automations/documents/templates/${t.id}`)}
                      >
                        Set up template
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="rounded-lg text-destructive"
                        onClick={() => void remove(t.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function TemplateEditorSection() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [row, setRow] = useState<DocumentTemplateRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [placeholders, setPlaceholders] = useState<DocPlaceholderRow[]>([]);
  const [useAi, setUseAi] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [showDynamicHint, setShowDynamicHint] = useState(() => {
    try {
      return typeof localStorage !== 'undefined' && !localStorage.getItem(DYNAMIC_FIELDS_HINT_KEY);
    } catch {
      return false;
    }
  });
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewPdfBase64, setPreviewPdfBase64] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const t = await fetchDocumentTemplate(id);
    setRow(t);
    setPlaceholders(t?.placeholders?.length ? t.placeholders : []);
    if (t?.placeholders?.length) {
      const v: Record<string, string> = {};
      for (const p of t.placeholders) v[p.key] = p.exampleValue || '';
      setValues(v);
    } else setValues({});
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const dismissDynamicHint = () => {
    try {
      localStorage.setItem(DYNAMIC_FIELDS_HINT_KEY, '1');
    } catch {
      /* ignore */
    }
    setShowDynamicHint(false);
  };

  useEffect(() => {
    if (!id || loading || !row) return;
    if (searchParams.get('setup') !== '1') return;
    const storageKey = `doc_setup_ai_done_${id}`;
    if (sessionStorage.getItem(storageKey)) {
      navigate(`/automations/documents/templates/${id}`, { replace: true });
      return;
    }
    sessionStorage.setItem(storageKey, '1');
    void (async () => {
      setDetecting(true);
      const res = await detectDocumentPlaceholders(id, true);
      setDetecting(false);
      navigate(`/automations/documents/templates/${id}`, { replace: true });
      if (!res) {
        toast({ title: 'Detection failed', description: 'Could not analyze the template. Try Fetch dynamic fields again.', variant: 'destructive' });
        return;
      }
      if (res.suggestions?.length) {
        setPlaceholders(res.suggestions);
        const v: Record<string, string> = {};
        for (const p of res.suggestions) v[p.key] = p.exampleValue || '';
        setValues(v);
      }
      toast({
        title: 'Dynamic fields loaded',
        description: res.suggestions?.length
          ? 'Review the table, then click Generate template when you are happy with the keys.'
          : templateIsPdf(row)
            ? 'No {{tokens}} or red text runs were detected. Use a text-based PDF (not a scan), include {{field_key}} text if you want tokens, or add table rows manually.'
            : 'No red fields found. Check colours in Word or add rows manually.',
      });
    })();
  }, [id, loading, row, searchParams, navigate]);

  useEffect(() => {
    if (!placeholders.length) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const p of placeholders) {
        if (next[p.key] === undefined) next[p.key] = p.exampleValue || '';
      }
      return next;
    });
  }, [placeholders]);

  const mergeSuggestions = (suggestions: DocPlaceholderRow[]) => {
    const byKey = new Map<string, DocPlaceholderRow>();
    for (const p of placeholders) byKey.set(p.key, p);
    for (const s of suggestions) {
      if (!byKey.has(s.key)) byKey.set(s.key, s);
    }
    setPlaceholders(Array.from(byKey.values()));
  };

  const onDetect = async () => {
    if (!id) return;
    setDetecting(true);
    const res = await detectDocumentPlaceholders(id, useAi);
    setDetecting(false);
    if (!res) {
      toast({ title: 'Detection failed', variant: 'destructive' });
      return;
    }
    mergeSuggestions(res.suggestions);
    toast({
      title: 'Suggestions ready',
      description: templateIsPdf(row)
        ? 'PDF: filled-in red text plus {{token}} placeholders are read from the file (not Word XML).'
        : res.aiEnabled
          ? 'Review keys before saving. AI assists — human review is always required.'
          : 'Heuristic + mustache scan (set OPENAI_API_KEY on server for AI labels).',
    });
  };

  const onSave = async () => {
    if (!id) return;
    setSaving(true);
    const updated = await patchDocumentTemplate(id, { placeholders });
    setSaving(false);
    if (updated) {
      setRow(updated);
      toast({ title: 'Draft saved' });
    } else toast({ title: 'Save failed', variant: 'destructive' });
  };

  const onGenerateTemplate = async () => {
    if (!id) return;
    if (!placeholders.length) {
      toast({
        title: 'No fields yet',
        description: 'Click Fetch dynamic fields (AI) first, or add fields manually.',
        variant: 'destructive',
      });
      return;
    }
    setCommitting(true);
    const updated = await patchDocumentTemplate(id, {
      placeholders,
      commitMappings: true,
      status: 'active',
    });
    setCommitting(false);
    if (updated) {
      setRow(updated);
      toast({
        title: 'Template generated',
        description: templateIsPdf(row)
          ? 'PDF template is active. Open Make document or run a CSV batch to fill placeholders.'
          : 'The working file is ready. Open Make document, fill each field, and export Word + PDF with the same layout.',
      });
    } else toast({ title: 'Generate template failed', variant: 'destructive' });
  };

  const onPreview = async () => {
    if (!id) return;
    setPreviewLoading(true);
    const res = await previewDocument(id, values);
    setPreviewLoading(false);
    if (!res.ok) {
      toast({ title: 'Preview failed', description: res.error, variant: 'destructive' });
      return;
    }
    if (res.pdfBase64) {
      setPreviewPdfBase64(res.pdfBase64);
      setPreviewHtml('');
    } else {
      setPreviewHtml(res.html || '');
      setPreviewPdfBase64('');
    }
    toast({
      title: 'Preview updated',
      description: res.mergeWarning
        ? `Mustache step: ${res.mergeWarning} (red text was still replaced.)`
        : undefined,
    });
  };

  const updatePh = (idx: number, patch: Partial<DocPlaceholderRow>) => {
    setPlaceholders((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  };

  const removePh = (idx: number) => {
    setPlaceholders((prev) => prev.filter((_, i) => i !== idx));
  };

  if (loading || !id) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-16">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (!row) {
    return <p className="text-sm text-muted-foreground py-10">Template not found.</p>;
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <WorkflowSteps active={2} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h2 className="font-bold">Step 2 — {row.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{row.originalFileName}</p>
        </div>
        <Badge variant={row.status === 'active' ? 'default' : 'secondary'} className="rounded-lg text-[10px] ml-auto">
          {row.status === 'active' ? 'Template ready' : 'Draft'}
        </Badge>
      </div>

      {showDynamicHint ? (
        <Alert className="border-primary/30 bg-primary/5">
          <Info className="h-4 w-4" />
          <AlertTitle>These rows are your dynamic fields</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {templateIsPdf(row) ? (
                <>
                  Placeholders such as <code className="text-[11px]">{'{{key}}'}</code> in the PDF become fields you fill
                  later. Detection listed them once; you can edit keys and samples. Shown once on this browser.
                </>
              ) : (
                <>
                  Anything marked <strong className="text-destructive">red</strong> in your Word file becomes a value you fill
                  later. AI listed them once; you can edit keys and sample text. Shown once on this browser.
                </>
              )}
            </span>
            <Button type="button" variant="secondary" size="sm" className="shrink-0 rounded-lg" onClick={dismissDynamicHint}>
              Got it
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="glass-card-hover rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-sm">Fetch fields and generate template</h3>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Checkbox id="useAi" checked={useAi} onCheckedChange={(v) => setUseAi(!!v)} />
            <Label htmlFor="useAi" className="text-sm cursor-pointer flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Use AI for labels (OpenAI key on server)
            </Label>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl"
            disabled={detecting}
            onClick={() => void onDetect()}
          >
            {detecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
            Fetch dynamic fields (AI)
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" disabled={saving} onClick={() => void onSave()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save draft'}
          </Button>
          <Button type="button" className="rounded-xl" disabled={committing} onClick={() => void onGenerateTemplate()}>
            {committing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Generate template'}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {templateIsPdf(row) ? (
            <>
              After placeholders are listed, review the table. <strong className="text-foreground">Generate template</strong>{' '}
              activates the PDF flow. Then use <strong className="text-foreground">Make document</strong> or CSV batch to fill
              values.
            </>
          ) : (
            <>
              After AI lists the red fields, review the table (human check is required).{' '}
              <strong className="text-foreground">Generate template</strong> locks the working Word file and turns this into
              an active template. Then use <strong className="text-foreground">Make document</strong> to fill values and export
              Word + PDF.
            </>
          )}
        </p>

        <div className="rounded-2xl border border-border/60 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Dynamic</TableHead>
                <TableHead>Field key</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>{templateIsPdf(row) ? 'Token in PDF' : 'Text from Word (red)'}</TableHead>
                <TableHead>Sample / preview</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {placeholders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground py-8">
                    {templateIsPdf(row)
                      ? 'Upload finishes with an automatic scan for {{placeholders}}, or click Fetch dynamic fields.'
                      : 'Upload finishes with an automatic fetch of red fields, or click "Fetch dynamic fields (AI)".'}
                  </TableCell>
                </TableRow>
              ) : (
                placeholders.map((p, idx) => (
                  <TableRow key={`${p.key}-${idx}`}>
                    <TableCell className="align-top">
                      <Badge variant="outline" className="text-[10px] rounded-md border-destructive/40 text-destructive">
                        Dynamic
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top">
                      <Input value={p.key} onChange={(e) => updatePh(idx, { key: e.target.value })} className="h-9 font-mono text-xs" />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input value={p.label} onChange={(e) => updatePh(idx, { label: e.target.value })} className="h-9 text-xs" />
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">{p.source}</TableCell>
                    <TableCell className="align-top">
                      <Input
                        value={p.redSnippet}
                        onChange={(e) => updatePh(idx, { redSnippet: e.target.value })}
                        className="h-9 text-xs"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        value={values[p.key] ?? ''}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            [p.key]: e.target.value,
                          }))
                        }
                        className="h-9 text-xs"
                        placeholder="Sample value"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removePh(idx)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="rounded-xl" disabled={previewLoading} onClick={() => void onPreview()}>
            {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />} Preview
          </Button>
          <Button
            type="button"
            variant="default"
            className="rounded-xl"
            onClick={() => navigate(`/automations/documents/generate?t=${encodeURIComponent(row.id)}`)}
          >
            Go to Make document
          </Button>
        </div>
      </div>

      {previewHtml ? (
        <div className="glass-card-hover rounded-2xl p-5 space-y-2">
          <h3 className="font-bold text-sm">Preview (HTML)</h3>
          <div
            className="prose prose-sm dark:prose-invert max-w-none max-h-[480px] overflow-auto rounded-xl border border-border/60 bg-background/40 p-4"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      ) : null}
      {previewPdfBase64 ? (
        <div className="glass-card-hover rounded-2xl p-5 space-y-2">
          <h3 className="font-bold text-sm">Preview (PDF)</h3>
          <iframe
            title="PDF preview"
            src={`data:application/pdf;base64,${previewPdfBase64}`}
            className="w-full h-[520px] rounded-xl border border-border/60 bg-background/40"
          />
        </div>
      ) : null}
    </div>
  );
}

function GenerateSection() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplateRow[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [employeeId, setEmployeeId] = useState<string>('none');
  const [values, setValues] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewPdfBase64, setPreviewPdfBase64] = useState('');
  const [busy, setBusy] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);

  const selected = useMemo(() => templates.find((t) => t.id === templateId), [templates, templateId]);

  useEffect(() => {
    void (async () => {
      const [emps, tmpls] = await Promise.all([fetchEmployees(), fetchDocumentTemplates()]);
      setEmployees(emps);
      setTemplates(tmpls);
      const fromQuery = searchParams.get('t') || '';
      if (fromQuery && tmpls.some((t) => t.id === fromQuery)) {
        setTemplateId(fromQuery);
        return;
      }
      setTemplateId((prev) => prev || tmpls[0]?.id || '');
    })();
  }, [searchParams]);

  useEffect(() => {
    if (!selected?.placeholders?.length) return;
    setValues((prev) => {
      const next = { ...prev };
      for (const p of selected.placeholders) {
        if (next[p.key] === undefined || next[p.key] === '') {
          next[p.key] = p.exampleValue ?? '';
        }
      }
      return next;
    });
  }, [selected?.id, selected?.placeholders]);

  const loadDefaults = async () => {
    if (!employeeId || employeeId === 'none') return;
    const defs = await fetchEmployeeDocDefaults(employeeId);
    setValues((prev) => ({ ...defs, ...prev }));
    toast({ title: 'Prefilled from employee' });
  };

  const onPreview = async () => {
    if (!templateId) return;
    setBusy(true);
    const res = await previewDocument(templateId, values);
    setBusy(false);
    if (!res.ok) {
      toast({ title: 'Preview failed', description: res.error, variant: 'destructive' });
      return;
    }
    if (res.pdfBase64) {
      setPreviewPdfBase64(res.pdfBase64);
      setPreviewHtml('');
    } else {
      setPreviewHtml(res.html || '');
      setPreviewPdfBase64('');
    }
    toast({
      title: 'Preview ready',
      description: res.mergeWarning
        ? templateIsPdf(selected)
          ? `Fill step: ${res.mergeWarning}`
          : `Mustache step: ${res.mergeWarning} (your red text was still replaced.)`
        : undefined,
    });
  };

  const onGenerate = async () => {
    if (!templateId) return;
    setBusy(true);
    const res = await generateDocument(templateId, {
      values,
      employeeId: employeeId === 'none' ? undefined : employeeId,
      outputPdf: true,
    });
    setBusy(false);
    if ('error' in res) {
      toast({ title: 'Generate failed', description: res.error, variant: 'destructive' });
      return;
    }
    const parts = [
      res.pdfError ? `PDF: ${res.pdfError}` : null,
      res.mergeWarning ? (templateIsPdf(selected) ? res.mergeWarning : `Mustache: ${res.mergeWarning}`) : null,
    ].filter(Boolean);
    const defaultDesc = templateIsPdf(selected)
      ? 'PDF is ready (DOCX is not produced for PDF templates).'
      : 'Word and PDF match your template layout.';
    toast({
      title: 'Document ready',
      description: parts.length ? parts.join(' — ') : defaultDesc,
    });
    if (res.downloadDocxUrl) {
      await downloadAutomationFile(res.downloadDocxUrl, `${res.run.templateName || 'document'}.docx`);
    }
    if (res.downloadPdfUrl) {
      await downloadAutomationFile(res.downloadPdfUrl, `${res.run.templateName || 'document'}.pdf`);
    }
    navigate('/automations/documents/history');
  };

  const onBatchCsv = (file: File | null) => {
    if (!file || !templateId) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (parseResult) => {
        void (async () => {
          const firstErr = parseResult.errors?.find((e) => e.type === 'Quotes' || e.type === 'FieldMismatch');
          if (firstErr) {
            toast({ title: 'CSV parse issue', description: firstErr.message, variant: 'destructive' });
            return;
          }
          const rows = (parseResult.data || []).filter((r) => Object.values(r).some((v) => String(v ?? '').trim()));
          if (!rows.length) {
            toast({ title: 'Empty CSV', description: 'No data rows after the header.', variant: 'destructive' });
            return;
          }
          setBatchBusy(true);
          const res = await generateDocumentBatch(templateId, {
            rows,
            employeeId: employeeId === 'none' ? undefined : employeeId,
            outputPdf: true,
          });
          setBatchBusy(false);
          if ('error' in res) {
            toast({ title: 'Batch failed', description: res.error, variant: 'destructive' });
            return;
          }
          const errCount = res.errors?.length ?? 0;
          toast({
            title: 'Batch finished',
            description:
              errCount > 0
                ? `Generated ${res.generated} file(s). ${errCount} row(s) failed — see server response in network tab for details.`
                : `Generated ${res.generated} file(s). Open History to download each PDF.`,
          });
          navigate('/automations/documents/history');
        })();
      },
    });
  };

  return (
    <div className="space-y-8 max-w-5xl">
      <WorkflowSteps active={3} />
      <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <strong className="text-foreground">Step 3</strong> — Pick the template and enter values for each mapped field, then{' '}
        <strong className="text-foreground">Make document</strong>. Word templates export as DOCX plus PDF; PDF templates export
        PDF only. Optionally run a CSV batch: one row per document, column headers must match field keys.
      </div>
      {selected && selected.status !== 'active' ? (
        <Alert className="border-amber-500/40 bg-amber-500/10 dark:bg-amber-950/30">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle>Finish step 2 first</AlertTitle>
          <AlertDescription>
            This template is still a draft. Open <strong>Set up template</strong>, review AI fields, and click{' '}
            <strong>Generate template</strong> before making final documents.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="glass-card-hover rounded-2xl p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Choose template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {templateIsPdf(t) ? ' (PDF)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Employee (optional, for defaults)</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => void loadDefaults()}>
              Apply employee defaults
            </Button>
          </div>
        </div>

        {selected?.placeholders?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {selected.placeholders.map((p) => (
              <div key={p.key} className="space-y-1">
                <Label className="text-xs">{p.label || p.redSnippet || p.key}</Label>
                <Input
                  value={values[p.key] ?? ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  className="rounded-lg"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Select a template with saved placeholders.</p>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <Button type="button" variant="secondary" className="rounded-xl" disabled={busy || batchBusy} onClick={() => void onPreview()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />} Preview
          </Button>
          <Button
            type="button"
            className="rounded-xl"
            disabled={busy || batchBusy || !!(selected && selected.status !== 'active')}
            onClick={() => void onGenerate()}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />} Make document
          </Button>
        </div>

        <div className="rounded-xl border border-border/50 border-dashed p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileSpreadsheet className="w-4 h-4" /> Batch from CSV
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            First row = column names matching template keys (e.g. <code className="text-[10px]">employee_full_name</code>). Each
            additional row generates one document run (Word templates → DOCX + PDF; PDF templates → PDF only). Max 500 rows.
          </p>
          <Input
            type="file"
            accept=".csv,text/csv"
            disabled={batchBusy || !!(selected && selected.status !== 'active')}
            className="cursor-pointer rounded-xl max-w-md"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = '';
              onBatchCsv(f);
            }}
          />
          {batchBusy ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…
            </div>
          ) : null}
        </div>
      </div>

      {previewHtml ? (
        <div className="glass-card-hover rounded-2xl p-5 space-y-2">
          <h3 className="font-bold text-sm">Preview</h3>
          <div
            className="prose prose-sm dark:prose-invert max-w-none max-h-[520px] overflow-auto rounded-xl border border-border/60 bg-background/40 p-4"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      ) : null}
      {previewPdfBase64 ? (
        <div className="glass-card-hover rounded-2xl p-5 space-y-2">
          <h3 className="font-bold text-sm">Preview (PDF)</h3>
          <iframe
            title="PDF preview"
            src={`data:application/pdf;base64,${previewPdfBase64}`}
            className="w-full h-[520px] rounded-xl border border-border/60 bg-background/40"
          />
        </div>
      ) : null}
    </div>
  );
}

function HistorySection() {
  const { toast } = useToast();
  const [rows, setRows] = useState<DocumentAutomationRunRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setRows(await fetchDocumentRuns());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dl = async (id: string, format: 'docx' | 'pdf', name: string) => {
    const path = `/api/document-automation/runs/${id}/download?format=${format}`;
    const ok = await downloadAutomationFile(path, `${name}.${format}`);
    if (!ok) toast({ title: 'Download failed', variant: 'destructive' });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-16">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading history…
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-4">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">No generated documents yet.</p>
      ) : (
        <div className="rounded-2xl border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Template</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Downloads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-sm">{r.templateName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.employeeName || r.employeeId || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {r.hasDocx ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => void dl(r.id, 'docx', `${r.templateName}-${r.id.slice(-6)}`)}
                      >
                        DOCX
                      </Button>
                    ) : null}
                    {r.hasPdf ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => void dl(r.id, 'pdf', `${r.templateName}-${r.id.slice(-6)}`)}
                      >
                        PDF
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{r.pdfError ? 'PDF n/a' : ''}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function DocumentAutomationHub() {
  const { hasAccess } = useAuth();
  const allowed = hasAccess(['super_admin', 'hr_manager']);
  if (!allowed) return <Navigate to="/" replace />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Document automation"
        description="HR flow: (1) Upload Word or PDF — (2) Detection finds dynamic fields (red text in Word, or {{tokens}} in PDF), you review and Generate template — (3) Make document or CSV batch; Word templates export DOCX + PDF, PDF templates export PDF only."
      />
      <SubNav />
      <Routes>
        <Route index element={<Navigate to="/automations/documents/templates" replace />} />
        <Route path="templates" element={<TemplatesSection />} />
        <Route path="templates/:id" element={<TemplateEditorSection />} />
        <Route path="generate" element={<GenerateSection />} />
        <Route path="history" element={<HistorySection />} />
      </Routes>
    </div>
  );
}
