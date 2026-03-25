import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, FileText, Trash2, Play, Calendar, Tag, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface Template {
  id: string;
  name: string;
  description: string | null;
  original_file_name: string;
  file_type: string;
  fields: { fieldName: string; placeholder: string }[];
  created_at: string;
}

export default function TemplateList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('document_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setTemplates((data || []).map((t: any) => ({
        ...t,
        fields: Array.isArray(t.fields) ? t.fields : [],
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('document_templates').delete().eq('id', deleteId);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '🗑️ Template deleted' });
      fetchTemplates();
    }
    setDeleteId(null);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Document Templates"
        description={`${templates.length} template(s) saved`}
        action={
          <Button onClick={() => navigate('/documents/templates/upload')} className="gap-2 rounded-xl shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> Upload Template
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : templates.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-1">No templates yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Upload a DOCX file with red-colored dynamic fields to get started</p>
          <Button onClick={() => navigate('/documents/templates/upload')} className="rounded-xl">
            <Plus className="w-4 h-4 mr-2" /> Upload First Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map(template => (
            <div key={template.id} className="glass-card-hover rounded-2xl p-5 space-y-3 group">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{template.name}</h3>
                    <p className="text-[11px] text-muted-foreground">{template.original_file_name}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 rounded-lg text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setDeleteId(template.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {template.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
              )}

              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-info/10 text-info">
                  <Tag className="w-3 h-3" /> {template.fields.length} field(s)
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-muted text-muted-foreground">
                  <Calendar className="w-3 h-3" /> {format(new Date(template.created_at), 'MMM dd, yyyy')}
                </span>
              </div>

              {template.fields.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.fields.slice(0, 4).map((f, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-destructive/10 text-destructive font-mono">
                      {f.placeholder}
                    </span>
                  ))}
                  {template.fields.length > 4 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                      +{template.fields.length - 4} more
                    </span>
                  )}
                </div>
              )}

              <Button
                onClick={() => navigate(`/documents/templates/${template.id}/generate`)}
                className="w-full rounded-xl h-9 text-xs gap-2 shadow-sm shadow-primary/10"
              >
                <Play className="w-3.5 h-3.5" /> Generate Document
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Delete Template</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete this template. Continue?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-xl">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
