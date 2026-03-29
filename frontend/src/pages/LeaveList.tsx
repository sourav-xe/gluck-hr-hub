import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchEmployees } from '@/lib/employeeService';
import { fetchLeaveRequests, patchLeaveRequest } from '@/lib/hrApi';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, ShieldCheck, Loader2 } from 'lucide-react';
import { Employee, LeaveRequest } from '@/types/hr';

export default function LeaveList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, hasAccess } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionDialog, setActionDialog] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [localLeaves, setLocalLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [emps, leaves] = await Promise.all([fetchEmployees(), fetchLeaveRequests()]);
    setEmployees(emps);
    setLocalLeaves(leaves);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isAdmin = hasAccess(['super_admin', 'hr_manager', 'reporting_manager']);

  const visibleLeaves = isAdmin ? localLeaves : localLeaves.filter((l) => l.employeeId === user.employeeId);

  const filtered = visibleLeaves.filter((l) => statusFilter === 'all' || l.status === statusFilter);

  const getRoleName = () => {
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
  };

  const handleAction = async () => {
    if (!actionDialog) return;
    const status = actionDialog.action === 'approve' ? 'Approved' : 'Rejected';
    const updated = await patchLeaveRequest(actionDialog.id, {
      status,
      note: note || undefined,
      approvedBy: user.id,
      approvedByName: `${user.name} (${getRoleName()})`,
    });
    if (updated) {
      setLocalLeaves((prev) => prev.map((l) => (l.id === actionDialog.id ? updated : l)));
      toast({
        title: `Leave ${status}`,
        description: `Leave request has been ${status.toLowerCase()}.`,
      });
    } else {
      toast({ title: 'Update failed', variant: 'destructive' });
    }
    setActionDialog(null);
    setNote('');
  };

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
        title={isAdmin ? 'Leave Management' : 'My Leave Requests'}
        description={isAdmin ? `${visibleLeaves.length} total requests` : `You have ${visibleLeaves.length} leave requests`}
        action={
          <Button onClick={() => navigate('/leaves/new')} className="gap-2 rounded-xl shadow-md shadow-primary/20">
            <Plus className="w-4 h-4" /> New Request
          </Button>
        }
      />

      <div className="flex gap-3 mb-5">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 rounded-xl h-10">
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
              {isAdmin && <TableHead>Employee</TableHead>}
              <TableHead>Type</TableHead>
              <TableHead className="hidden sm:table-cell">Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>{isAdmin ? 'Action' : 'Reviewed By'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-12 text-muted-foreground">
                  No leave requests found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((leave) => {
                const emp = employees.find((e) => e.id === leave.employeeId);
                return (
                  <TableRow key={leave.id} className="border-border/50">
                    {isAdmin && (
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold">
                            {emp?.fullName.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <span className="font-semibold text-sm">{emp?.fullName}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-sm">{leave.leaveType}</TableCell>
                    <TableCell className="text-sm hidden sm:table-cell font-mono text-muted-foreground">
                      {leave.fromDate} — {leave.toDate}
                    </TableCell>
                    <TableCell className="text-sm font-bold">{leave.days}</TableCell>
                    <TableCell>
                      <StatusBadge status={leave.status} />
                    </TableCell>
                    <TableCell>
                      {isAdmin && leave.status === 'Pending' ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs rounded-lg text-success border-success/20 hover:bg-success/10"
                            onClick={() => setActionDialog({ id: leave.id, action: 'approve' })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs rounded-lg text-destructive border-destructive/20 hover:bg-destructive/10"
                            onClick={() => setActionDialog({ id: leave.id, action: 'reject' })}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : leave.approvedByName ? (
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{leave.approvedByName}</span>
                        </div>
                      ) : leave.status === 'Pending' ? (
                        <span className="text-xs text-warning font-medium">Awaiting review</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{actionDialog?.action === 'approve' ? 'Approve' : 'Reject'} Leave Request</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Add a note (optional)..." value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={() => void handleAction()} className="rounded-xl">
              {actionDialog?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
