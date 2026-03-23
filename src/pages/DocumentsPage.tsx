import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatedDocuments } from '@/data/mockData';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Download, Eye, Trash2, FileText } from 'lucide-react';

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    toast({ title: '🗑️ Document deleted', description: 'The document has been removed.' });
    setDeleteId(null);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Documents & Letters"
        description={`${generatedDocuments.length} documents generated`}
        action={<Button onClick={() => navigate('/documents/generate')} className="gap-2 rounded-xl shadow-md shadow-primary/20"><Plus className="w-4 h-4" /> Generate Document</Button>}
      />

      <div className="glass-card rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden sm:table-cell">Linked To</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {generatedDocuments.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No documents generated yet</TableCell></TableRow>
            ) : generatedDocuments.map(doc => (
              <TableRow key={doc.id} className="border-border/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center text-info">
                      <FileText className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-sm">{doc.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{doc.type}</TableCell>
                <TableCell className="text-sm hidden sm:table-cell">{doc.linkedTo}</TableCell>
                <TableCell className="text-sm hidden md:table-cell font-mono text-muted-foreground">{doc.date}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg"><Eye className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg"><Download className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg text-destructive" onClick={() => setDeleteId(doc.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle>Delete Document</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this document? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} className="rounded-xl">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
