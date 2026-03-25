import { useState, useEffect, useCallback } from 'react';
import { fetchAutomations, patchAutomation } from '@/lib/hrApi';
import type { Automation } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { Zap, Bell, UserPlus, CalendarCheck, Clock, DollarSign, Mail, Loader2, FileText, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

const iconComponents: LucideIcon[] = [Bell, UserPlus, CalendarCheck, Clock, Clock, DollarSign, Mail];

const gradientCycle = [
  'from-accent/20 to-warning/10',
  'from-success/20 to-info/10',
  'from-primary/20 to-info/10',
  'from-warning/20 to-destructive/10',
  'from-info/20 to-primary/10',
  'from-success/20 to-accent/10',
  'from-primary/20 to-accent/10',
];

export default function AutomationsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchAutomations();
    setItems(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (id: string, current: boolean) => {
    const updated = await patchAutomation(id, { active: !current });
    if (updated) {
      setItems((prev) => prev.map((a) => (a.id === id ? updated : a)));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading automations…
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-10">
      <PageHeader title="Automations" description="Configure automated notifications and reminders" />

      <div className="glass-card-hover rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex gap-3 items-start">
          <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">HR document automation</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
              Three steps: name and upload Word → AI reads red text as dynamic fields, you click Generate template → fill fields and Make document for Word + PDF in the same layout.
            </p>
          </div>
        </div>
        <Button type="button" className="rounded-xl shrink-0" onClick={() => navigate('/automations/documents/templates')}>
          Open document automation
        </Button>
      </div>

      <div>
      <h3 className="font-bold text-sm mb-3 text-muted-foreground">Notification automations</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8">No automations yet. Run <code className="text-xs bg-muted px-1 rounded">npm run seed</code> to create defaults.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((auto, index) => {
            const IconEl = iconComponents[index % iconComponents.length] ?? Zap;
            return (
            <div key={auto.id} className="glass-card-hover rounded-2xl p-5 relative overflow-hidden">
              <div
                className={`absolute inset-0 bg-gradient-to-br ${gradientCycle[index % gradientCycle.length]} opacity-50`}
              />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${
                      auto.active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <IconEl className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{auto.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{auto.description}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge
                        variant={auto.active ? 'default' : 'secondary'}
                        className={`text-[10px] font-semibold rounded-lg ${auto.active ? 'bg-success/10 text-success border-success/20' : ''}`}
                      >
                        {auto.active ? '● Active' : 'Inactive'}
                      </Badge>
                      {auto.lastTriggered && (
                        <span className="text-[10px] text-muted-foreground font-mono">Last: {auto.lastTriggered}</span>
                      )}
                    </div>
                  </div>
                </div>
                <Switch checked={auto.active} onCheckedChange={() => void toggle(auto.id, auto.active)} />
              </div>
            </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
