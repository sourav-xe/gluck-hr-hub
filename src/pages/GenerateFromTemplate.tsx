import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Loader2, FileText } from 'lucide-react';
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
      updated = updated.replace(/<w:pPr\b([^>]*)>([\s\S]*?)<\/w:pPr>/i, (match, attrs, content) => {
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

export default function GenerateFromTemplate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [documentName, setDocumentName] = useState('');

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
      } catch {
        toast({ title: 'Failed to load template', variant: 'destructive' });
        navigate('/documents/templates');
      } finally {
        setLoading(false);
      }
    };
    void fetchTemplate();
  }, [id]);

  const handleGenerate = async () => {
    if (!template) return;
    setGenerating(true);

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
      a.download = `${documentName}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      toast({ title: 'Document generated!', description: 'Download started automatically' });
    } catch (err: unknown) {
      toast({ title: 'Generation failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setGenerating(false);
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

  return (
    <div className="animate-fade-in max-w-3xl">
      <PageHeader
        title="Generate Document"
        action={
          <Button variant="ghost" onClick={() => navigate('/documents/templates')} className="gap-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        }
      />

      <div className="glass-card rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">{template.name}</h3>
            <p className="text-xs text-muted-foreground">
              {template.original_file_name} • {template.fields.length} dynamic field(s)
            </p>
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Output Document Name</Label>
          <Input
            value={documentName}
            onChange={e => setDocumentName(e.target.value)}
            className="mt-1.5 rounded-xl h-10"
            placeholder="e.g., Offer Letter - John Doe"
          />
        </div>

        {template.fields.length > 0 ? (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Fill Dynamic Fields
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {template.fields.map((field, idx) => (
                <div key={idx}>
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    {field.fieldName.replace(/_/g, ' ')}
                  </Label>
                  <Input
                    value={fieldValues[field.placeholder] || ''}
                    onChange={e => setFieldValues(prev => ({ ...prev, [field.placeholder]: e.target.value }))}
                    placeholder={`Enter ${field.placeholder}`}
                    className="mt-1.5 rounded-xl h-10"
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No dynamic fields detected in this template.</p>
            <p className="text-xs mt-1">The document will be generated as-is.</p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => navigate('/documents/templates')} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="flex-1 rounded-xl h-11 shadow-md shadow-primary/20"
          >
            {generating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
            ) : (
              <><Download className="w-4 h-4" /> Generate & Download DOCX</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
