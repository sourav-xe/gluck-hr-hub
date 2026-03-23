import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
  gradient?: string;
  href?: string;
}

export default function StatCard({ title, value, icon, subtitle, trend, gradient, href }: StatCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className={`glass-card-hover rounded-2xl p-5 relative overflow-hidden transition-all duration-200 ${href ? 'cursor-pointer hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]' : ''}`}
      onClick={() => href && navigate(href)}
      role={href ? 'link' : undefined}
    >
      {gradient && (
        <div className={`absolute inset-0 opacity-[0.06] ${gradient}`} />
      )}
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-2 tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs mt-1.5 font-semibold ${trend.positive ? 'text-success' : 'text-destructive'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
    </div>
  );
}
