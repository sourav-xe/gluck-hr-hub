import { useCallback, useEffect, useState } from 'react';
import { fetchEmployees } from '@/lib/employeeService';
import {
  fetchRegularizationRequests,
  patchRegularizationRequest,
  postRegularizationRequest,
} from '@/lib/hrApi';
import { useAuth } from '@/contexts/AuthContext';
import type { AttendanceStatus, Employee, RegularizationRequest } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, ShieldCheck } from 'lucide-react';

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ['P', 'L', 'WFH', 'HD', 'A'];

export default function RegularizationPage() {
  const { user, hasAccess } = useAuth();
  const { toast } = useToast();
  const isReviewer = hasAccess(['super_admin', 'hr_manager', 'reporting_manager']);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rows, setRows] = useState<RegularizationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [openNew, setOpenNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const [form, setForm] = useState({
    date: '',
    requestedStatus: 'P' as AttendanceStatus,
    requestedClockIn: '',
    requestedClockOut: '',
    reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, reqs] = await Promise.all([fetchEmployees(), fetchRegularizationRequests()]);
    setEmployees(emps);
    setRows(reqs);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = isReviewer ? rows : rows.filter((r) => r.employeeId === user.employeeId);
  const filtered = visible.filter((r) => statusFilter === 'all' || r.status === statusFilter);

  function getRoleName() {
    switch (user.role) {
      case 'super_admin':
        return 'Super Admin';
      case 'hr_manager':
        return 'HR Manager';
      case 'reporting_manager':
        return 'Manager';
      default:
        return '';
    }
  }

  async function handleSubmitRequest() {
    if (!form.date || !form.reason.trim()) {
      toast({ title: 'Date and reason required', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const created = await postRegularizationRequest({
        employeeId: user.employeeId || '',
        date: form.date,
        requestedStatus: form.requestedStatus,
        requestedClockIn: form.requestedClockIn || '',
        requestedClockOut: form.requestedClockOut || '',
        reason: form.reason.trim(),
      });
      if (!created) {
        toast({ title: 'Could not submit request', variant: 'destructive' });
        return;
      }
      setRows((prev) => [created, ...prev]);
      setForm({ date: '', requestedStatus: 'P', requestedClockIn: '', requestedClockOut: '', reason: '' });
      setOpenNew(false);
      toast({ title: 'Regularization request submitted' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview() {
    if (!reviewDialog) return;
    const status = reviewDialog.action === 'approve' ? 'Approved' : 'Rejected';
    const updated = await patchRegularizationRequest(reviewDialog.id, {
      status,
      note: reviewNote || undefined,
      approvedBy: user.id,
      approvedByName: `${user.name} (${getRoleName()})`,
    });
    if (!updated) {
      toast({ title: 'Failed to update request', variant: 'destructive' });
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    toast({ title: `Request ${status.toLowerCase()}` });
    setReviewDialog(null);
    setReviewNote('');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={isReviewer ? 'Regularization Requests' : 'My Regularization Requests'}
        description={isReviewer ? `${rows.length} total requests` : `${visible.length} request(s) raised by you`}
        action={(
          <Button onClick={() => setOpenNew(true)} className="gap-2 rounded-xl shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> New Request
          </Button>
        )}
      />

      <div className="flex gap-3 mb-5">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 rounded-xl h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              {isReviewer && <TableHead>Employee</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead className="hidden sm:table-cell">Requested</TableHead>
              <TableHead className="hidden md:table-cell">Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{isReviewer ? 'Action' : 'Reviewed By'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isReviewer ? 6 : 5} className="text-center py-12 text-muted-foreground">
                  No regularization requests found
                </TableCell>
              </TableRow>
            ) : filtered.map((r) => {
              const emp = employees.find((e) => e.id === r.employeeId);
              return (
                <TableRow key={r.id} className="border-border/50">
                  {isReviewer && (
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold">
                          {(emp?.fullName || '?').split(' ').map((n) => n[0]).join('')}
                        </div>
                        <span className="font-semibold text-sm">{emp?.fullName || 'Unknown'}</span>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="font-mono text-sm">{r.date}</TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">
                    <span className="font-medium">{r.requestedStatus || '—'}</span>
                    {(r.requestedClockIn || r.requestedClockOut) ? (
                      <span className="text-muted-foreground"> · {r.requestedClockIn || '--:--'} - {r.requestedClockOut || '--:--'}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground max-w-[320px] truncate">{r.reason}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell>
                    {isReviewer && r.status === 'Pending' ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs rounded-lg text-success border-success/20 hover:bg-success/10"
                          onClick={() => setReviewDialog({ id: r.id, action: 'approve' })}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs rounded-lg text-destructive border-destructive/20 hover:bg-destructive/10"
                          onClick={() => setReviewDialog({ id: r.id, action: 'reject' })}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : r.approvedByName ? (
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{r.approvedByName}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-warning font-medium">Awaiting review</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New Regularization Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Date</Label>
              <Input type="date" className="rounded-xl mt-1.5" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} />
            </div>
            <div>
              <Label>Requested Status</Label>
              <Select value={form.requestedStatus} onValueChange={(v) => setForm((p) => ({ ...p, requestedStatus: v as AttendanceStatus }))}>
                <SelectTrigger className="rounded-xl mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTENDANCE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Clock In (optional)</Label>
                <Input type="time" className="rounded-xl mt-1.5" value={form.requestedClockIn} onChange={(e) => setForm((p) => ({ ...p, requestedClockIn: e.target.value }))} />
              </div>
              <div>
                <Label>Clock Out (optional)</Label>
                <Input type="time" className="rounded-xl mt-1.5" value={form.requestedClockOut} onChange={(e) => setForm((p) => ({ ...p, requestedClockOut: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                className="rounded-xl mt-1.5"
                placeholder="Explain why this attendance correction is needed..."
                value={form.reason}
                onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setOpenNew(false)}>Cancel</Button>
            <Button className="rounded-xl" onClick={() => void handleSubmitRequest()} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{reviewDialog?.action === 'approve' ? 'Approve' : 'Reject'} Request</DialogTitle>
          </DialogHeader>
          <Textarea
            className="rounded-xl"
            placeholder="Add a note (optional)"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setReviewDialog(null)}>Cancel</Button>
            <Button className="rounded-xl" onClick={() => void handleReview()}>
              {reviewDialog?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
