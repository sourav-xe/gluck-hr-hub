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
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.23, 1, 0.32, 1] }}
      whileHover={{ 
        y: -6, 
        scale: 1.03,
        transition: { duration: 0.3, ease: 'easeOut' }
      }}
      whileTap={{ scale: 0.97 }}
      className={`group relative rounded-2xl p-5 overflow-hidden ${href ? 'cursor-pointer' : ''}`}
      onClick={() => href && navigate(href)}
      role={href ? 'link' : undefined}
    >
      {/* Animated glow background */}
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl -z-10"
        style={{ 
          background: glowColor || 'hsl(var(--primary) / 0.15)',
          transform: 'scale(1.2)',
        }}
      />
      
      {/* Persistent subtle glow in dark mode */}
      <div 
        className="absolute inset-0 opacity-0 dark:opacity-40 transition-opacity duration-500 blur-3xl -z-10"
        style={{ 
          background: glowColor || 'hsl(var(--primary) / 0.08)',
          transform: 'scale(1.5)',
        }}
      />

      {/* Glass card background */}
      <div className="absolute inset-0 glass-card rounded-2xl" />
      
      {/* Gradient overlay */}
      {gradient && (
        <div className={`absolute inset-0 opacity-[0.05] dark:opacity-[0.1] ${gradient} rounded-2xl transition-opacity duration-300 group-hover:opacity-[0.12] dark:group-hover:opacity-[0.18]`} />
      )}

      {/* Top border glow line */}
      <motion.div 
        className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ 
          background: `linear-gradient(90deg, transparent, ${glowColor || 'hsl(var(--primary))'}, transparent)`,
        }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em]">{title}</p>
          <motion.p 
            className="text-2xl font-bold mt-2 tracking-tight"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.08 + 0.3 }}
          >
            {value}
          </motion.p>
          {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
          {trend && (
            <p className={`text-xs mt-1.5 font-semibold ${trend.positive ? 'text-success' : 'text-destructive'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <motion.div 
          className="w-11 h-11 rounded-xl bg-primary/10 dark:bg-primary/15 flex items-center justify-center text-primary backdrop-blur-sm border border-primary/10"
          whileHover={{ rotate: 8, scale: 1.1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          {icon}
        </motion.div>
      </div>
    </motion.div>
  );
}
