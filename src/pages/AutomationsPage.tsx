import { useState } from 'react';
import { automations } from '@/data/mockData';
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

export default function AutomationsPage() {
  const [items, setItems] = useState(automations);

  const toggle = (id: string) => {
    setItems(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Automations" description="Configure automated notifications and reminders" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(auto => (
          <div key={auto.id} className="bg-card rounded-lg border p-5 card-hover">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${auto.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {iconMap[auto.id] || <Zap className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{auto.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{auto.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={auto.active ? 'default' : 'secondary'} className="text-[10px]">
                      {auto.active ? 'Active' : 'Inactive'}
                    </Badge>
                    {auto.lastTriggered && (
                      <span className="text-[10px] text-muted-foreground">Last: {auto.lastTriggered}</span>
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
