import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Upload, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function TemplateUpload() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ fieldsFound: number; templateId: string } | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith('.docx')) {
      setFile(droppedFile);
    } else {
      toast({ title: 'Invalid file', description: 'Please upload a .docx file', variant: 'destructive' });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile?.name.endsWith('.docx')) {
      setFile(selectedFile);
    } else {
      toast({ title: 'Invalid file', description: 'Please upload a .docx file', variant: 'destructive' });
    }
  };

  const handleUpload = async () => {
    if (!file || !templateName) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('templateName', templateName);
      formData.append('description', description);

      const response = await apiFetch('/api/doc-simple-templates', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult({ fieldsFound: data.fieldsFound, templateId: data.template.id });
      toast({ title: 'Template uploaded', description: data.message });
    } catch (err: unknown) {
      toast({ title: 'Upload failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader
        title="Upload Template"
        action={
          <Button variant="ghost" onClick={() => navigate('/documents/templates')} className="gap-2 rounded-xl">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
        }
      />

      {result ? (
        <div className="glass-card rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h3 className="text-lg font-bold">Template Uploaded Successfully!</h3>
          <p className="text-sm text-muted-foreground">
            Found <strong className="text-primary">{result.fieldsFound}</strong> dynamic field(s) (red-colored text)
          </p>
          {result.fieldsFound === 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 text-warning text-xs text-left">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>No red-colored text was detected. Make sure dynamic fields in your DOCX are colored <strong>red</strong> (e.g., #FF0000).</p>
            </div>
          )}
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={() => navigate('/documents/templates')} className="rounded-xl">
              View Templates
            </Button>
            <Button onClick={() => navigate(`/documents/templates/${result.templateId}/generate`)} className="rounded-xl shadow-md shadow-primary/20">
              Generate Document
            </Button>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-6 space-y-6">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Template Name *</Label>
            <Input
              value={templateName}
              onChange={e => setTemplateName(e.target.value)}
              placeholder="e.g., Offer Letter Template"
              className="mt-1.5 rounded-xl h-10"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this template..."
              className="mt-1.5 rounded-xl min-h-[80px] resize-none"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Upload DOCX File *</Label>
            <div
              className={`mt-1.5 border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : file ? 'border-success/50 bg-success/5' : 'border-border hover:border-primary/50'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept=".docx"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div className="space-y-2">
                  <FileText className="w-10 h-10 text-success mx-auto" />
                  <p className="text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-sm font-semibold">Drop your DOCX file here</p>
                  <p className="text-xs text-muted-foreground">or click to browse • Only .docx files supported</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-info/5 border border-info/20 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">How it works</p>
            <p>• Any text in <span className="text-destructive font-bold">red color</span> in your DOCX will become a dynamic field</p>
            <p>• Black/normal text will remain static</p>
            <p>• Watermarks, signatures, and formatting are preserved</p>
          </div>

          <Button
            onClick={handleUpload}
            disabled={!file || !templateName || uploading}
            className="w-full rounded-xl h-11 shadow-md shadow-primary/20"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Parsing & Uploading...</>
            ) : (
              <><Upload className="w-4 h-4" /> Upload & Parse Template</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
