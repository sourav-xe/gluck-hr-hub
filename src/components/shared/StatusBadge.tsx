import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
  variant?: 'default';
}

const statusConfig: Record<string, { className: string }> = {
  Active: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  Inactive: { className: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100' },
  'On Leave': { className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' },
  Pending: { className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' },
  Approved: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  Rejected: { className: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100' },
  Paid: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  Unpaid: { className: 'bg-red-100 text-red-600 border-red-200 hover:bg-red-100' },
  P: { className: 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  L: { className: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100' },
  WFH: { className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' },
  HD: { className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100' },
  A: { className: 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { className: 'bg-muted text-muted-foreground' };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className}`}>
      {status}
    </Badge>
  );
}
