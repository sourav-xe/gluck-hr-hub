import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
}

export default function StatCard({ title, value, icon, subtitle, trend }: StatCardProps) {
  return (
    <div className="bg-card rounded-lg border p-5 card-hover">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs mt-1 font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}
