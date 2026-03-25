import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Loader2, FileText, CheckCircle } from 'lucide-react';
import JSZip from 'jszip';

interface TemplateField {
  fieldName: string;
  placeholder: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  original_file_name: string;
  original_file_url: string;
  fields: TemplateField[];
}

type PreviewSegmentKind = 'static' | 'placeholder' | 'unknownRed';
type PreviewSegment = {
  kind: PreviewSegmentKind;
  text: string;
  placeholderKey?: string;
};
type PreviewParagraph = { segments: PreviewSegment[] };

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fixBrokenAlignment(xml: string): string {
  let result = xml.replace(/<w:jc\s+w:val=["']distribute["']\s*\/>/gi, '<w:jc w:val="left"/>');

  result = result.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const isHeadingStyle = /<w:pStyle\s+w:val=["'][^"']*Heading[^"']*["']/i.test(para);
    const hasBold = /<w:b(?:\s*\/?>|\s+w:val=["'](?:true|1)["'][^>]*\/?>)/i.test(para);
    const hasProblemAlignment = /<w:jc\s+w:val=["'](?:both|distribute)["']\s*\/>/i.test(para);
    const hasTabRuns = /<w:tab\s*\/>/i.test(para);

    const textContent = (para.match(/<w:t[^>]*>[\s\S]*?<\/w:t>/g) || [])
      .map((t) => t.replace(/<[^>]+>/g, ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();

    const looksLikeShortHeading = /^([\d.]+\s*)?[A-Z][^.!?]{0,140}$/.test(textContent);
    const shouldNormalize = isHeadingStyle || looksLikeShortHeading || (hasBold && (textContent.length < 120 || hasTabRuns || hasProblemAlignment));
    if (!shouldNormalize) return para;

    let updated = para;
    updated = updated.replace(/<w:jc\s+w:val=["'](?:both|distribute)["']\s*\/>/gi, '<w:jc w:val="left"/>');
    updated = updated.replace(/<w:tab\s*\/>/gi, '<w:t xml:space="preserve"> </w:t>');

    if (/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/i.test(updated)) {
      updated = updated.replace(/<w:pPr\b([^>]*)>([\s\S]*?)<\/w:pPr>/i, (_match, attrs, content) => {
        if (/<w:jc\b/i.test(content)) {
          return `<w:pPr${attrs}>${content.replace(/<w:jc\s+w:val=["'](?:both|distribute)["']\s*\/>/gi, '<w:jc w:val="left"/>')}</w:pPr>`;
        }
        return `<w:pPr${attrs}>${content}<w:jc w:val="left"/></w:pPr>`;
      });
    } else {
      updated = updated.replace(/<w:p\b([^>]*)>/i, '<w:p$1><w:pPr><w:jc w:val="left"/></w:pPr>');
    }

    return updated;
  });

  return result;
}

function replaceRedTextInXml(xml: string, fieldValues: Record<string, string>): string {
  let result = fixBrokenAlignment(xml);
  for (const [placeholder, value] of Object.entries(fieldValues)) {
    if (!value) continue;
    const regex = new RegExp(
      `(<w:r\\b[^>]*>)((?:<w:rPr>[\\s\\S]*?<w:color\\s+w:val=["'](?:FF0000|ff0000|C00000|c00000|ED1C24|ed1c24|FF3333|ff3333|CC0000|cc0000|990000|FF4444|ff4444|E60000|e60000)["'][\\s\\S]*?<\\/w:rPr>)[\\s\\S]*?)(<w:t[^>]*>)(${escapeRegex(placeholder)})(<\\/w:t>)`,
      'g'
    );
    result = result.replace(regex, (_, runStart, rprContent, tStart, _text, tEnd) => {
      const updatedRpr = rprContent.replace(
        /<w:color\s+w:val=["'](?:FF0000|ff0000|C00000|c00000|ED1C24|ed1c24|FF3333|ff3333|CC0000|cc0000|990000|FF4444|ff4444|E60000|e60000)["']\s*\/>/gi,
        '<w:color w:val="000000"/>'
      );
      return `${runStart}${updatedRpr}${tStart}${value}${tEnd}`;
    });
  }
  return result;
}

function decodeXmlEntities(s: string): string {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function isRedRun(runXml: string): boolean {
  // Matches known Word red colors used by the document parsing service.
  return /<w:color\b[^>]*w:val=["'](?:FF0000|ff0000|C00000|c00000|ED1C24|ed1c24|FF3333|ff3333|CC0000|cc0000|990000|FF4444|ff4444|E60000|e60000)["'][^>]*\/?>/i.test(
    runXml
  );
}

function extractRunText(runInnerXml: string): string {
  const parts: string[] = [];
  const textRe = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(runInnerXml)) !== null) {
    parts.push(decodeXmlEntities(m[1]));
  }
  return parts.join('');
}

function splitRedRunByPlaceholders(text: string, placeholders: string[]): PreviewSegment[] {
  // placeholders should be sorted by length desc for best matching.
  const sorted = [...placeholders].sort((a, b) => b.length - a.length);
  const out: PreviewSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let bestIdx = -1;
    let bestPh = '';
    for (const ph of sorted) {
      if (!ph) continue;
      const idx = text.indexOf(ph, cursor);
      if (idx === -1) continue;
      if (bestIdx === -1 || idx < bestIdx || (idx === bestIdx && ph.length > bestPh.length)) {
        bestIdx = idx;
        bestPh = ph;
      }
    }

    if (bestIdx === -1) {
      const rest = text.slice(cursor);
      if (rest) out.push({ kind: 'unknownRed', text: rest });
      break;
    }

    if (bestIdx > cursor) {
      out.push({ kind: 'unknownRed', text: text.slice(cursor, bestIdx) });
    }

    out.push({ kind: 'placeholder', text: bestPh, placeholderKey: bestPh });
    cursor = bestIdx + bestPh.length;
  }

  return out;
}

async function loadDocXml(template: Template): Promise<string> {
  const fileUrl = template.original_file_url;
  let arrayBuffer: ArrayBuffer;

  if (fileUrl.startsWith('data:')) {
    const base64 = fileUrl.split(',')[1];
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    arrayBuffer = bytes.buffer;
  } else {
    const resp = await fetch(fileUrl);
    arrayBuffer = await resp.arrayBuffer();
  }

  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) throw new Error('document.xml not found in DOCX');
  return docXml;
}

function parseDocXmlToPreview(docXml: string, placeholders: string[]): PreviewParagraph[] {
  const placeholderSet = new Set(placeholders);
  const placeholderSorted = placeholders.filter((p) => placeholderSet.has(p)).sort((a, b) => b.length - a.length);
  const paragraphs: PreviewParagraph[] = [];

  const paraRe = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pm: RegExpExecArray | null;
  while ((pm = paraRe.exec(docXml)) !== null) {
    const paraXml = pm[1];
    const segments: PreviewSegment[] = [];

    const runRe = /(<w:r\b[^>]*>[\s\S]*?<\/w:r>)/g;
    let rm: RegExpExecArray | null;
    while ((rm = runRe.exec(paraXml)) !== null) {
      const runXml = rm[1];
      const inner = runXml.replace(/^<w:r\b[^>]*>/i, '').replace(/<\/w:r>$/i, '');

      // Capture basic line-break behavior inside runs.
      if (runXml.includes('<w:br')) {
        // We'll treat it as a newline after the run text.
      }

      const runText = extractRunText(inner);
      if (!runText) continue;

      if (isRedRun(runXml)) {
        const segs = splitRedRunByPlaceholders(runText, placeholderSorted);
        segments.push(...segs);
      } else {
        segments.push({ kind: 'static', text: runText });
      }
    }

    if (segments.length) paragraphs.push({ segments });
  }

  return paragraphs;
}

export default function GenerateFromTemplate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [activePlaceholder, setActivePlaceholder] = useState<string>('');

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PreviewParagraph[] | null>(null);

  const [generationProgress, setGenerationProgress] = useState<number | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const placeholderSpanRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const userManuallyScrolledRef = useRef(false);

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!id) return;
      try {
        const res = await apiFetch(`/api/doc-simple-templates/${id}`);
        if (!res.ok) {
          toast({ title: 'Template not found', variant: 'destructive' });
          navigate('/documents/templates');
          return;
        }
        const data = await res.json();
        const t: Template = {
          ...data,
          fields: Array.isArray(data.fields) ? data.fields as TemplateField[] : [],
        };
        setTemplate(t);
        setDocumentName(`${t.name} - ${new Date().toLocaleDateString()}`);

        const initialValues: Record<string, string> = {};
        t.fields.forEach((f: TemplateField) => { initialValues[f.placeholder] = ''; });
        setFieldValues(initialValues);
        setActivePlaceholder(t.fields[0]?.placeholder || '');
      } catch {
        toast({ title: 'Failed to load template', variant: 'destructive' });
        navigate('/documents/templates');
      } finally {
        setLoading(false);
      }
    };
    void fetchTemplate();
  }, [id]);

  // Build the full template preview once (then it updates from `fieldValues`).
  useEffect(() => {
    if (!template) return;
    let cancelled = false;
    userManuallyScrolledRef.current = false;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewDoc(null);

    (async () => {
      try {
        const docXml = await loadDocXml(template);
        const placeholders = template.fields.map((f) => f.placeholder);
        const parsed = parseDocXmlToPreview(docXml, placeholders);
        if (!cancelled) setPreviewDoc(parsed);
      } catch (e: unknown) {
        if (!cancelled) setPreviewError((e as Error).message || 'Failed to build preview');
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [template?.id]);

  // When user focuses an input, scroll the preview container to the first occurrence
  // of the corresponding red/dynamic placeholder snippet.
  useEffect(() => {
    if (!activePlaceholder) return;
    if (!previewDoc) return;
    if (previewLoading) return;
    if (userManuallyScrolledRef.current) return;

    const el = placeholderSpanRefs.current[activePlaceholder];
    if (!el) return;

    // Make sure it's visible within the scrollable preview pane.
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activePlaceholder, previewDoc, previewLoading]);

  const handleGenerate = async () => {
    if (!template) return;
    setGenerating(true);
    setGenerationProgress(40);

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    let p = 40;
    progressTimerRef.current = setInterval(() => {
      // We don't have true ZIP progress; this is a smooth UX progress indicator.
      p = Math.min(95, p + (Math.random() * 4 + 2));
      setGenerationProgress(Math.round(p));
    }, 180);

    try {
      const fileUrl = template.original_file_url;
      let arrayBuffer: ArrayBuffer;

      if (fileUrl.startsWith('data:')) {
        const base64 = fileUrl.split(',')[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        arrayBuffer = bytes.buffer;
      } else {
        const resp = await fetch(fileUrl);
        arrayBuffer = await resp.arrayBuffer();
      }

      const zip = await JSZip.loadAsync(arrayBuffer);

      const xmlFiles = ['word/document.xml'];
      zip.forEach((path) => {
        if (/^word\/(header|footer)\d*\.xml$/.test(path)) xmlFiles.push(path);
      });

      for (const xmlFile of xmlFiles) {
        const content = await zip.file(xmlFile)?.async('string');
        if (content) {
          zip.file(xmlFile, replaceRedTextInXml(content, fieldValues));
        }
      }

      const blob = await zip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${documentName || 'generated'}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);

      toast({ title: 'Document generated!', description: 'Download started automatically' });
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
      setGenerationProgress(100);
    } catch (err: unknown) {
      toast({ title: 'Generation failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setGenerating(false);
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      // Hide progress bar shortly after completion/failure.
      setTimeout(() => setGenerationProgress(null), 800);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!template) return null;

  const allFilled = template.fields.every((f) => fieldValues[f.placeholder]?.trim());
  const activeField = template.fields.find((f) => f.placeholder === activePlaceholder) || null;

  return (
    <div className="animate-fade-in w-full max-w-none">
      <PageHeader
        title={`Generate: ${template.name}`}
        action={
          <Button variant="ghost" onClick={() => navigate('/documents/templates')} className="gap-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        }
      />

      {generationProgress !== null && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[min(720px,92vw)]">
          <div className="glass-card rounded-2xl p-4 border border-border/50">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Generating document</p>
              <p className="text-xs font-mono text-muted-foreground">{generationProgress}%</p>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-150"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-0 gap-4 items-stretch min-h-[calc(100vh-220px)] lg:h-[calc(100vh-220px)]">
        <div className="glass-card rounded-2xl p-6 space-y-6 lg:rounded-r-none lg:border-r-0 flex flex-col lg:h-full">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Document Name</Label>
            <Input
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              className="mt-1.5 rounded-xl h-10"
            />
          </div>

          <div className="space-y-4 flex-1 overflow-auto pr-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="w-4 h-4 text-primary" />
              Dynamic Fields ({template.fields.length})
            </div>

            {template.fields.map((field, i) => (
              <div key={i}>
                <Label className="text-xs text-muted-foreground">{field.fieldName}</Label>
                <Input
                  value={fieldValues[field.placeholder] || ''}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, [field.placeholder]: e.target.value }))}
                  placeholder={`Enter ${field.fieldName}`}
                  className="mt-1 rounded-xl h-10"
                  onFocus={() => setActivePlaceholder(field.placeholder)}
                />
              </div>
            ))}
          </div>

          {allFilled && (
            <div className="flex items-center gap-2 text-xs text-success">
              <CheckCircle className="w-3.5 h-3.5" /> All fields filled
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating || template.fields.length === 0}
            className="w-full rounded-xl h-11 gap-2 shadow-md shadow-primary/20"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Download className="w-4 h-4" /> Generate & Download DOCX</>
            )}
          </Button>
        </div>

        <aside className="glass-card rounded-2xl p-5 space-y-3 lg:sticky lg:top-24 lg:rounded-l-none lg:border-l-0 flex flex-col h-full min-h-0">
          <div>
            <p className="text-sm font-bold">Template Preview</p>
            <p className="text-xs text-muted-foreground mt-1">Red placeholders will turn into your typed values.</p>
          </div>

          {previewLoading ? (
            <div className="text-xs text-muted-foreground rounded-xl border border-border/40 p-3">
              Building preview…
            </div>
          ) : previewError ? (
            <div className="text-xs text-destructive rounded-xl border border-destructive/20 p-3">
              {previewError}
            </div>
          ) : previewDoc ? (
            <div className="flex-1 min-h-0 rounded-xl border border-border/40 p-3 bg-card/40">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                Document content (text preview)
              </div>
              <div
                className="h-full overflow-y-auto overflow-x-hidden pr-1"
                ref={previewContainerRef}
                // Only treat it as "manual scrolling" if the user actually interacts
                // (wheel/touch/drag). Programmatic scrollIntoView shouldn't disable auto-sync.
                onWheelCapture={() => { userManuallyScrolledRef.current = true; }}
                onTouchStartCapture={() => { userManuallyScrolledRef.current = true; }}
                onPointerDownCapture={() => { userManuallyScrolledRef.current = true; }}
              >
                {previewDoc.map((p, idx) => (
                  <p key={idx} className="text-sm leading-relaxed mb-2 last:mb-0">
                    {p.segments.map((seg, j) => {
                      if (seg.kind === 'static') {
                        return <span key={j}>{seg.text}</span>;
                      }

                      if (seg.kind === 'placeholder') {
                        const placeholderKey = seg.placeholderKey || '';
                        const rawValue = fieldValues[placeholderKey] || '';
                        const display = rawValue.trim() ? rawValue : seg.text;
                        const isActive = placeholderKey === activePlaceholder;

                        return (
                          <span
                            key={j}
                            className={[
                              'text-destructive font-semibold',
                              isActive ? 'bg-destructive/25 border-2 border-black px-1 rounded' : '',
                            ].join(' ')}
                            ref={(el) => {
                              if (!el) return;
                              // Keep the first occurrence only (stable scroll target).
                              if (!placeholderSpanRefs.current[placeholderKey]) {
                                placeholderSpanRefs.current[placeholderKey] = el;
                              }
                            }}
                          >
                            {display}
                          </span>
                        );
                      }

                      return (
                        <span key={j} className="text-destructive/80 font-semibold">
                          {seg.text}
                        </span>
                      );
                    })}
                  </p>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground rounded-xl border border-border/40 p-3">No preview available.</div>
          )}

          <div className="text-xs text-muted-foreground rounded-xl bg-info/5 border border-info/20 p-3">
            <p className="font-semibold text-foreground">Tip</p>
            <p className="mt-1">
              The preview shows the exact red snippet from your DOCX template that will be replaced with your input.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
