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
    toast({ title: `${actionDialog.action === 'approve' ? '✅' : '❌'} Leave ${action}`, description: `Leave request has been ${action.toLowerCase()}.` });
    setActionDialog(null);
    setNote('');
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Leave Management"
        description={`${leaveRequests.length} total requests`}
        action={<Button onClick={() => navigate('/leaves/new')} className="gap-2 rounded-xl shadow-md shadow-primary/20"><Plus className="w-4 h-4" /> New Request</Button>}
      />

      <div className="flex gap-3 mb-5">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 rounded-xl h-10"><SelectValue /></SelectTrigger>
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
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No leave requests found</TableCell></TableRow>
            ) : filtered.map(leave => {
              const emp = employees.find(e => e.id === leave.employeeId);
              return (
                <TableRow key={leave.id} className="border-border/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary text-[11px] font-bold">
                        {emp?.fullName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <span className="font-semibold text-sm">{emp?.fullName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{leave.leaveType}</TableCell>
                  <TableCell className="text-sm hidden sm:table-cell font-mono text-muted-foreground">{leave.fromDate} - {leave.toDate}</TableCell>
                  <TableCell className="text-sm font-bold">{leave.days}</TableCell>
                  <TableCell><StatusBadge status={leave.status} /></TableCell>
                  <TableCell>
                    {leave.status === 'Pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-success border-success/20 hover:bg-success/10" onClick={() => setActionDialog({ id: leave.id, action: 'approve' })}>Approve</Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => setActionDialog({ id: leave.id, action: 'reject' })}>Reject</Button>
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
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{actionDialog?.action === 'approve' ? 'Approve' : 'Reject'} Leave Request</DialogTitle>
          </DialogHeader>
          <Textarea placeholder="Add a note (optional)..." value={note} onChange={e => setNote(e.target.value)} className="rounded-xl" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleAction} className="rounded-xl">{actionDialog?.action === 'approve' ? 'Approve' : 'Reject'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
