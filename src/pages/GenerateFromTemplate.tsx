import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Download, Loader2, FileText, CheckCircle } from 'lucide-react';

interface TemplateField {
  fieldName: string;
  placeholder: string;
  xmlPath?: string;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  original_file_name: string;
  fields: TemplateField[];
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
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchTemplate = async () => {
      if (!id) return;
      const { data, error } = await (supabase as any)
        .from('document_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        toast({ title: 'Template not found', variant: 'destructive' });
        navigate('/documents/templates');
        return;
      }

      const t = {
        ...data,
        fields: Array.isArray(data.fields) ? data.fields as TemplateField[] : [],
      };
      setTemplate(t);
      setDocumentName(`${t.name} - ${new Date().toLocaleDateString()}`);

      // Pre-populate field values
      const initialValues: Record<string, string> = {};
      t.fields.forEach((f: TemplateField) => {
        initialValues[f.placeholder] = '';
      });
      setFieldValues(initialValues);
      setLoading(false);
    };

    fetchTemplate();
  }, [id]);

  const handleGenerate = async () => {
    if (!template) return;
    setGenerating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-document`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            templateId: template.id,
            fieldValues,
            documentName,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      // Get download URL from header or create blob
      const url = response.headers.get('X-Download-Url');
      if (url) setDownloadUrl(url);

      // Also trigger download from blob
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `${documentName}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      toast({ title: '✅ Document generated!', description: 'Download started automatically' });
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
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
        {/* Template info */}
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

        {/* Document name */}
        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Output Document Name</Label>
          <Input
            value={documentName}
            onChange={e => setDocumentName(e.target.value)}
            className="mt-1.5 rounded-xl h-10"
            placeholder="e.g., Offer Letter - John Doe"
          />
        </div>

        {/* Dynamic fields form */}
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

        {/* Generate button */}
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

        {downloadUrl && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-success/5 border border-success/20">
            <CheckCircle className="w-4 h-4 text-success" />
            <p className="text-xs text-success font-medium">Document generated successfully!</p>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-auto text-xs text-primary underline"
            >
              Download again
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
