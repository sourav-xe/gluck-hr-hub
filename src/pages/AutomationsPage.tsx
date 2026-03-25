import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAutomations, patchAutomation, fetchAnnouncementSettings, putAnnouncementSettings } from '@/lib/hrApi';
import type { Automation } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Zap, Bell, UserPlus, CalendarCheck, Clock, DollarSign, Mail,
  Loader2, FileText, Cake, PartyPopper, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const notifIcons: LucideIcon[] = [Bell, UserPlus, CalendarCheck, Clock, Clock, DollarSign, Mail];

interface AnnouncementSettings {
  autoBirthdayEnabled: boolean;
  autoFestivalEnabled: boolean;
  festivalName: string;
  festivalMonthDay: string;
  lastBirthdayRunOn: string;
  lastFestivalRunOn: string;
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${active ? 'bg-success' : 'bg-muted-foreground/40'}`} />
  );
}

function AutoCard({
  icon: Icon,
  gradient,
  title,
  description,
  active,
  onToggle,
  meta,
  saving,
}: {
  icon: LucideIcon;
  gradient: string;
  title: string;
  description: string;
  active: boolean;
  onToggle: () => void;
  meta?: string;
  saving?: boolean;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 relative overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-40 pointer-events-none`} />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-primary/15 text-primary' : 'bg-muted/60 text-muted-foreground'}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm">{title}</h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${active ? 'bg-success/10 text-success border-success/25' : 'bg-muted text-muted-foreground border-border/50'}`}>
                <StatusDot active={active} />{active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
            {meta && <p className="text-[11px] text-muted-foreground/70 mt-1.5 font-mono">{meta}</p>}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          <Switch checked={active} onCheckedChange={onToggle} disabled={saving} />
        </div>
      </div>
    </div>
  );
}

export default function AutomationsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loadingAutomations, setLoadingAutomations] = useState(true);
  const [annoSettings, setAnnoSettings] = useState<AnnouncementSettings | null>(null);
  const [loadingAnno, setLoadingAnno] = useState(true);
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [savingFestival, setSavingFestival] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    setLoadingAutomations(true);
    setLoadingAnno(true);

    const [list, settings] = await Promise.all([
      fetchAutomations(),
      fetchAnnouncementSettings().catch(() => null),
    ]);

    setAutomations(list);
    setLoadingAutomations(false);

    if (settings) {
      setAnnoSettings({
        autoBirthdayEnabled: settings.autoBirthdayEnabled,
        autoFestivalEnabled: settings.autoFestivalEnabled,
        festivalName: settings.festivalName || '',
        festivalMonthDay: settings.festivalMonthDay || '',
        lastBirthdayRunOn: settings.lastBirthdayRunOn || '',
        lastFestivalRunOn: settings.lastFestivalRunOn || '',
      });
    }
    setLoadingAnno(false);
  }, []);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const toggleBirthday = async () => {
    if (!annoSettings || savingBirthday) return;
    const next = !annoSettings.autoBirthdayEnabled;
    setSavingBirthday(true);
    try {
      const updated = await putAnnouncementSettings({ autoBirthdayEnabled: next });
      setAnnoSettings(prev => prev ? { ...prev, autoBirthdayEnabled: updated.autoBirthdayEnabled } : prev);
      toast({ title: next ? 'Birthday trigger enabled' : 'Birthday trigger disabled' });
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingBirthday(false);
    }
  };

  const toggleFestival = async () => {
    if (!annoSettings || savingFestival) return;
    const next = !annoSettings.autoFestivalEnabled;
    setSavingFestival(true);
    try {
      const updated = await putAnnouncementSettings({ autoFestivalEnabled: next });
      setAnnoSettings(prev => prev ? { ...prev, autoFestivalEnabled: updated.autoFestivalEnabled } : prev);
      toast({ title: next ? 'Festival trigger enabled' : 'Festival trigger disabled' });
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingFestival(false);
    }
  };

  const toggleAutomation = async (id: string, current: boolean) => {
    if (savingIds.has(id)) return;
    setSavingIds(prev => new Set(prev).add(id));
    const updated = await patchAutomation(id, { active: !current });
    if (updated) {
      setAutomations(prev => prev.map(a => a.id === id ? updated : a));
      toast({ title: updated.active ? `"${updated.name}" enabled` : `"${updated.name}" disabled` });
    } else {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
    setSavingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  };

  const isLoading = loadingAutomations || loadingAnno;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading automations…
      </div>
    );
  }

  const festivalDesc = annoSettings?.festivalName
    ? `Auto-send "${annoSettings.festivalName}" wishes${annoSettings.festivalMonthDay ? ` on ${annoSettings.festivalMonthDay.replace('-', '/')} every year` : ''}. Configure date & message in Announcements.`
    : 'Auto-send festival wishes on the configured date every year. Set festival name & date in Announcements.';

  return (
    <div className="animate-fade-in space-y-8">
      <PageHeader
        title="Automations"
        description="Manage all automated triggers — toggle any automation on or off in one click"
      />

      {/* ── Google Chat Announcement Triggers ─────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Google Chat Announcement Triggers</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AutoCard
            icon={Cake}
            gradient="from-accent/20 to-warning/10"
            title="Birthday Auto-Trigger"
            description="Automatically sends a birthday wish message to the Google Chat space every day for any employee whose birthday falls on that date."
            active={annoSettings?.autoBirthdayEnabled ?? false}
            onToggle={toggleBirthday}
            saving={savingBirthday}
            meta={annoSettings?.lastBirthdayRunOn ? `Last ran: ${annoSettings.lastBirthdayRunOn}` : 'Not yet triggered'}
          />
          <AutoCard
            icon={PartyPopper}
            gradient="from-success/20 to-info/10"
            title="Festival Auto-Trigger"
            description={festivalDesc}
            active={annoSettings?.autoFestivalEnabled ?? false}
            onToggle={toggleFestival}
            saving={savingFestival}
            meta={annoSettings?.lastFestivalRunOn ? `Last ran: ${annoSettings.lastFestivalRunOn}` : 'Not yet triggered'}
          />
        </div>
        <p className="text-xs text-muted-foreground pl-1">
          Manage message templates, festival name & date in{' '}
          <button className="underline underline-offset-2 hover:text-foreground transition-colors" onClick={() => navigate('/announcements')}>
            Announcements
          </button>
          .
        </p>
      </section>

      {/* ── Notification Automations (DB) ────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Notification Automations</h2>
        </div>
        {automations.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center text-sm text-muted-foreground">
            No automations yet. Run{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded-md">npm run seed</code>{' '}
            to create defaults.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {automations.map((auto, index) => {
              const IconEl = notifIcons[index % notifIcons.length] ?? Zap;
              const gradients = [
                'from-primary/20 to-info/10',
                'from-warning/20 to-destructive/10',
                'from-info/20 to-primary/10',
                'from-success/20 to-accent/10',
                'from-primary/20 to-accent/10',
              ];
              return (
                <AutoCard
                  key={auto.id}
                  icon={IconEl}
                  gradient={gradients[index % gradients.length]}
                  title={auto.name}
                  description={auto.description}
                  active={auto.active}
                  onToggle={() => void toggleAutomation(auto.id, auto.active)}
                  saving={savingIds.has(auto.id)}
                  meta={auto.lastTriggered ? `Last triggered: ${auto.lastTriggered}` : undefined}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* ── HR Document Automation ──────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">HR Document Automation</h2>
        </div>
        <div className="glass-card rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="flex gap-3 items-start">
            <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Document templates & generation</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                Upload a Word (.docx) template with red-colored placeholders → system detects dynamic fields → fill values → download a generated document instantly.
              </p>
            </div>
          </div>
          <Button type="button" className="rounded-xl shrink-0 shadow-md shadow-primary/20" onClick={() => navigate('/documents/templates')}>
            Open Auto-Docs
          </Button>
        </div>
      </section>
    </div>
  );
}
