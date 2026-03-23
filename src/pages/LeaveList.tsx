import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employees, leaveRequests } from '@/data/mockData';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

export default function LeaveList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionDialog, setActionDialog] = useState<{ id: string; action: 'approve' | 'reject' } | null>(null);
  const [note, setNote] = useState('');

  const filtered = leaveRequests.filter(l => statusFilter === 'all' || l.status === statusFilter);

  const handleAction = () => {
    if (!actionDialog) return;
    const action = actionDialog.action === 'approve' ? 'Approved' : 'Rejected';
    toast({ title: `Leave ${action}`, description: `Leave request has been ${action.toLowerCase()}.` });
    setActionDialog(null);
    setNote('');
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Leave Management"
        description={`${leaveRequests.length} total requests`}
        action={<Button onClick={() => navigate('/leaves/new')} className="gap-2"><Plus className="w-4 h-4" /> New Request</Button>}
      />

      <div className="flex gap-3 mb-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="hidden sm:table-cell">Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No leave requests found</TableCell></TableRow>
            ) : filtered.map(leave => {
              const emp = employees.find(e => e.id === leave.employeeId);
              return (
                <TableRow key={leave.id}>
                  <TableCell className="font-medium text-sm">{emp?.fullName}</TableCell>
                  <TableCell className="text-sm">{leave.leaveType}</TableCell>
                  <TableCell className="text-sm hidden sm:table-cell">{leave.fromDate} - {leave.toDate}</TableCell>
                  <TableCell className="text-sm">{leave.days}</TableCell>
                  <TableCell><StatusBadge status={leave.status} /></TableCell>
                  <TableCell>
                    {leave.status === 'Pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setActionDialog({ id: leave.id, action: 'approve' })}>Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setActionDialog({ id: leave.id, action: 'reject' })}>Reject</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog?.action === 'approve' ? 'Approve' : 'Reject'} Leave Request</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Add a note (optional)..." value={note} onChange={e => setNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button onClick={handleAction}>{actionDialog?.action === 'approve' ? 'Approve' : 'Reject'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
