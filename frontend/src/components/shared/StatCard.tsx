import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
  gradient?: string;
  glowColor?: string;
  href?: string;
  index?: number;
}

export default function StatCard({ title, value, icon, subtitle, trend, gradient, glowColor, href, index = 0 }: StatCardProps) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
      className={`group relative rounded-2xl p-5 overflow-hidden bg-card border border-border/50 ${href ? 'cursor-pointer' : ''}`}
      onClick={() => href && navigate(href)}
      role={href ? 'link' : undefined}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl -z-10"
        style={{ background: glowColor || 'hsl(var(--primary) / 0.12)', transform: 'scale(1.3)' }}
      />

      {/* Top accent line */}
      <div
        className="absolute top-0 left-4 right-4 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, transparent, ${glowColor || 'hsl(var(--primary))'}, transparent)` }}
      />

      <div className="relative flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-extrabold tracking-tight">{value}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-bold ${trend.positive ? 'text-success' : 'text-destructive'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-primary-foreground shrink-0"
          style={{ background: glowColor ? glowColor.replace('/ 0.25', '') : undefined }}
        >
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${gradient || 'bg-primary/10'} text-primary`}>
            {icon}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
