import { useState } from 'react';
import { automations as initialAutomations } from '@/data/mockData';
import PageHeader from '@/components/shared/PageHeader';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Zap, Bell, UserPlus, CalendarCheck, Clock, DollarSign, Mail } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  A1: <Bell className="w-5 h-5" />,
  A2: <UserPlus className="w-5 h-5" />,
  A3: <CalendarCheck className="w-5 h-5" />,
  A4: <Clock className="w-5 h-5" />,
  A5: <Clock className="w-5 h-5" />,
  A6: <DollarSign className="w-5 h-5" />,
  A7: <Mail className="w-5 h-5" />,
};

const gradients: Record<string, string> = {
  A1: 'from-accent/20 to-warning/10',
  A2: 'from-success/20 to-info/10',
  A3: 'from-primary/20 to-info/10',
  A4: 'from-warning/20 to-destructive/10',
  A5: 'from-info/20 to-primary/10',
  A6: 'from-success/20 to-accent/10',
  A7: 'from-primary/20 to-accent/10',
};

export default function AutomationsPage() {
  const [items, setItems] = useState(initialAutomations);

  const toggle = (id: string) => {
    setItems(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Automations" description="Configure automated notifications and reminders" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(auto => (
          <div key={auto.id} className="glass-card-hover rounded-2xl p-5 relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${gradients[auto.id] || 'from-primary/10 to-accent/5'} opacity-50`} />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${auto.active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {iconMap[auto.id] || <Zap className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm">{auto.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{auto.description}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <Badge variant={auto.active ? 'default' : 'secondary'} className={`text-[10px] font-semibold rounded-lg ${auto.active ? 'bg-success/10 text-success border-success/20' : ''}`}>
                      {auto.active ? '● Active' : 'Inactive'}
                    </Badge>
                    {auto.lastTriggered && (
                      <span className="text-[10px] text-muted-foreground font-mono">Last: {auto.lastTriggered}</span>
                    )}
                  </div>
                </div>
              </div>
              <Switch checked={auto.active} onCheckedChange={() => toggle(auto.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
