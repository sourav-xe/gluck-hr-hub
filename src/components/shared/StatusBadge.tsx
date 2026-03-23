import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { className: string }> = {
  Active: { className: 'bg-success/10 text-success border-success/20 hover:bg-success/15' },
  Inactive: { className: 'bg-muted text-muted-foreground border-border hover:bg-muted' },
  'On Leave': { className: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/15' },
  Pending: { className: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/15' },
  Approved: { className: 'bg-success/10 text-success border-success/20 hover:bg-success/15' },
  Rejected: { className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15' },
  Paid: { className: 'bg-success/10 text-success border-success/20 hover:bg-success/15' },
  Unpaid: { className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15' },
  'Full Time': { className: 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15' },
  Freelancer: { className: 'bg-info/10 text-info border-info/20 hover:bg-info/15' },
  Intern: { className: 'bg-accent/10 text-accent-foreground border-accent/20 hover:bg-accent/15' },
  P: { className: 'bg-success/10 text-success border-success/20 hover:bg-success/15' },
  L: { className: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/15' },
  WFH: { className: 'bg-info/10 text-info border-info/20 hover:bg-info/15' },
  HD: { className: 'bg-warning/10 text-warning border-warning/20 hover:bg-warning/15' },
  A: { className: 'bg-muted text-muted-foreground border-border hover:bg-muted' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { className: 'bg-muted text-muted-foreground' };
  return (
    <Badge variant="outline" className={`text-[11px] font-semibold rounded-lg px-2.5 py-0.5 ${config.className}`}>
      {status}
    </Badge>
  );
}
