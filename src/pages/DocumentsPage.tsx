import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { generatedDocuments } from '@/data/mockData';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Download, Eye, Trash2 } from 'lucide-react';

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = () => {
    toast({ title: 'Document deleted', description: 'The document has been removed.' });
    setDeleteId(null);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Documents & Letters"
        description={`${generatedDocuments.length} documents generated`}
        action={<Button onClick={() => navigate('/documents/generate')} className="gap-2"><Plus className="w-4 h-4" /> Generate Document</Button>}
      />

      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden sm:table-cell">Linked To</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {generatedDocuments.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No documents generated yet</TableCell></TableRow>
            ) : generatedDocuments.map(doc => (
              <TableRow key={doc.id}>
                <TableCell className="font-medium text-sm">{doc.name}</TableCell>
                <TableCell className="text-sm">{doc.type}</TableCell>
                <TableCell className="text-sm hidden sm:table-cell">{doc.linkedTo}</TableCell>
                <TableCell className="text-sm hidden md:table-cell">{doc.date}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><Eye className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0"><Download className="w-3.5 h-3.5" /></Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteId(doc.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Document</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this document? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
