import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchGeneratedDocuments, deleteGeneratedDocument } from '@/lib/hrApi';
import { fetchEmployees } from '@/lib/employeeService';
import { apiFetch } from '@/lib/api';
import type { Employee, GeneratedDocument } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Download, Eye, Trash2, FileText, Loader2, UserRound, Search } from 'lucide-react';

type OnboardingDoc = {
  id?: string;
  docType: string;
  label?: string;
  fileName: string;
  uploadedAt?: string;
};

function base64ToBlob(b64: string, mime: string): Blob {
  const byteStr = atob(b64);
  const arr = new Uint8Array(byteStr.length);
  for (let i = 0; i < byteStr.length; i += 1) arr[i] = byteStr.charCodeAt(i);
  return new Blob([arr], { type: mime || 'application/octet-stream' });
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasAccess } = useAuth();
  const canManageDocs = hasAccess(['super_admin', 'hr_manager']);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [docs, setDocs] = useState<GeneratedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedEmployeeDocs, setSelectedEmployeeDocs] = useState<OnboardingDoc[]>([]);
  const [loadingSelectedDocs, setLoadingSelectedDocs] = useState(false);
  const [downloadingDoc, setDownloadingDoc] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (canManageDocs) {
      const emps = await fetchEmployees();
      setEmployees(emps);
      const firstId = emps[0]?.id || '';
      setSelectedEmployeeId((prev) => prev || firstId);
    } else {
      const list = await fetchGeneratedDocuments();
      setDocs(list);
    }
    setLoading(false);
  }, [canManageDocs]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManageDocs || !selectedEmployeeId) {
      setSelectedEmployeeDocs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingSelectedDocs(true);
      try {
        const res = await apiFetch(`/api/onboarding/documents?employeeId=${encodeURIComponent(selectedEmployeeId)}`);
        if (!res.ok) {
          if (!cancelled) setSelectedEmployeeDocs([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setSelectedEmployeeDocs(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setSelectedEmployeeDocs([]);
      } finally {
        if (!cancelled) setLoadingSelectedDocs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canManageDocs, selectedEmployeeId]);

  async function downloadOnboardingDoc(docType: string) {
    if (!selectedEmployeeId) return;
    setDownloadingDoc(docType);
    try {
      const res = await apiFetch(
        `/api/onboarding/documents/${encodeURIComponent(docType)}/download?employeeId=${encodeURIComponent(selectedEmployeeId)}`
      );
      if (!res.ok) {
        toast({ title: 'Download failed', variant: 'destructive' });
        return;
      }
      const payload = await res.json() as { fileName?: string; mimeType?: string; data?: string };
      if (!payload?.data) {
        toast({ title: 'File not found', variant: 'destructive' });
        return;
      }
      const blob = base64ToBlob(payload.data, payload.mimeType || '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = payload.fileName || `${docType}.bin`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: 'Download failed', variant: 'destructive' });
    } finally {
      setDownloadingDoc(null);
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return;
    const ok = await deleteGeneratedDocument(deleteId);
    if (ok) {
      setDocs((prev) => prev.filter((d) => d.id !== deleteId));
      toast({ title: 'Document deleted', description: 'The document has been removed.' });
    } else {
      toast({ title: 'Delete failed', description: 'Could not remove the document.', variant: 'destructive' });
    }
    setDeleteId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading documents…
      </div>
    );
  }

  if (canManageDocs) {
    const filteredEmployees = employees.filter((e) => {
      const q = employeeSearch.trim().toLowerCase();
      if (!q) return true;
      return e.fullName.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
    });
    const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId) || null;

    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader
          title="Employee Documents"
          description="Select an employee to view uploaded onboarding documents"
          action={(
            <Button
              onClick={() => navigate('/documents/generate')}
              className="gap-2 rounded-xl shadow-md shadow-primary/20"
            >
              <Plus className="w-4 h-4" /> Generate Document
            </Button>
          )}
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          <div className="xl:col-span-5 glass-card rounded-2xl p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="Search employee by name or email..."
                className="pl-9 rounded-xl h-10"
              />
            </div>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Employee</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No employees found</TableCell>
                    </TableRow>
                  ) : filteredEmployees.map((emp) => (
                    <TableRow
                      key={emp.id}
                      className={`cursor-pointer border-border/40 ${selectedEmployeeId === emp.id ? 'bg-primary/8' : 'hover:bg-muted/30'}`}
                      onClick={() => setSelectedEmployeeId(emp.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                            <UserRound className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{emp.fullName}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{emp.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-[11px] text-muted-foreground">{emp.onboardingComplete === true ? 'Done' : 'Pending'}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="xl:col-span-7 glass-card rounded-2xl p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">
                {selectedEmployee ? `${selectedEmployee.fullName} - Uploaded Documents` : 'Uploaded Documents'}
              </h3>
              {selectedEmployee && (
                <p className="text-xs text-muted-foreground mt-0.5">{selectedEmployee.email}</p>
              )}
            </div>

            {loadingSelectedDocs ? (
              <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading employee documents...
              </div>
            ) : selectedEmployeeDocs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 py-12 text-center text-sm text-muted-foreground">
                No onboarding documents uploaded for this employee.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedEmployeeDocs.map((doc) => (
                  <div key={doc.id || `${doc.docType}-${doc.fileName}`} className="rounded-xl border border-border/50 bg-card/60 p-3 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-info/10 text-info flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{doc.label || doc.docType}</p>
                        <p className="text-xs text-muted-foreground truncate">{doc.fileName}</p>
                        {doc.uploadedAt && (
                          <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                            {new Date(doc.uploadedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border/50 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg text-xs gap-1.5"
                        onClick={() => void downloadOnboardingDoc(doc.docType)}
                        disabled={downloadingDoc === doc.docType}
                      >
                        {downloadingDoc === doc.docType ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={canManageDocs ? 'Documents & Letters' : 'My Documents'}
        description={canManageDocs ? `${docs.length} documents generated` : `${docs.length} documents linked to you`}
        action={canManageDocs ? (
          <Button
            onClick={() => navigate('/documents/generate')}
            className="gap-2 rounded-xl shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Generate Document
          </Button>
        ) : undefined}
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
            {docs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No documents generated yet
                </TableCell>
              </TableRow>
            ) : (
              docs.map((doc) => (
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
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="Preview">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 rounded-lg" title="Download">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                      {canManageDocs && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg text-destructive"
                          onClick={() => setDeleteId(doc.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={canManageDocs && !!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this document? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()} className="rounded-xl">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
