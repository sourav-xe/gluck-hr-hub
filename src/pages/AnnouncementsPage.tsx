import { useEffect, useRef, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { fetchAnnouncementSettings, putAnnouncementSettings, triggerAnnouncement } from '@/lib/hrApi';
import {
  Send, Plus, Trash2, Pencil, Check, X, MoreVertical,
  UserRound, PartyPopper, ArrowRight, Cake, Sparkles, Save,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────────────────────────── */

function monthDayToInputDate(md: string): string {
  if (!md || !/^\d{2}-\d{2}$/.test(md)) return '';
  return `${new Date().getFullYear()}-${md}`;
}
function inputDateToMonthDay(v: string): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '';
  return v.slice(5);
}
function timeAgo(ms: number) {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

interface HistoryItem { id: number; label: string; sub: string; ts: number; kind: 'manual' | 'birthday' | 'festival' }

/* ── main component ──────────────────────────────────────────────────────────── */

export default function AnnouncementsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<'manual' | 'templates'>('manual');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);

  /* manual */
  const [manualText, setManualText] = useState('');
  const [birthdayName, setBirthdayName] = useState('');
  const [birthdayTplIdx, setBirthdayTplIdx] = useState('auto');
  const [festivalTplIdx, setFestivalTplIdx] = useState('auto');

  /* settings */
  const [settings, setSettings] = useState({
    birthdayTemplates: ['Happy Birthday {name}! 🎂 Wishing you a wonderful year ahead from the Gluck Global family.'],
    festivalTemplates: ['Happy {festivalName}! ✨ Wishing everyone joy, health, and success.'],
    birthdayTemplate: '',
    festivalTemplate: '',
    festivalName: '',
    festivalMonthDay: '',
    autoBirthdayEnabled: true,
    autoFestivalEnabled: false,
    lastBirthdayRunOn: '',
    lastFestivalRunOn: '',
  });
  const originalSettings = useRef(settings);

  /* template names (display-only, session-scoped) */
  const [bdayNames, setBdayNames] = useState<string[]>(['Standard Birthday Wish']);
  const [festNames, setFestNames] = useState<string[]>(['Global Festive Greeting']);

  /* inline editing in templates tab */
  const [editingBday, setEditingBday] = useState<number | null>(null);
  const [editingFest, setEditingFest] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState({ name: '', msg: '' });

  /* history (session-only) */
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const historyIdRef = useRef(0);

  function pushHistory(item: Omit<HistoryItem, 'id'>) {
    setHistory((h) => [{ ...item, id: ++historyIdRef.current }, ...h].slice(0, 20));
  }

  /* ── load settings ────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchAnnouncementSettings();
        if (!cancelled) {
          const next = {
            ...s,
            birthdayTemplates: s.birthdayTemplates?.length ? s.birthdayTemplates : [s.birthdayTemplate],
            festivalTemplates: s.festivalTemplates?.length ? s.festivalTemplates : [s.festivalTemplate],
          };
          setSettings((p) => ({ ...p, ...next }));
          originalSettings.current = { ...settings, ...next };
          /* seed display names */
          setBdayNames((prev) => {
            const arr = next.birthdayTemplates.map((_, i) => prev[i] ?? `Template #${i + 1}`);
            return arr;
          });
          setFestNames((prev) => {
            const arr = next.festivalTemplates.map((_, i) => prev[i] ?? `Template #${i + 1}`);
            return arr;
          });
        }
      } catch {
        if (!cancelled) toast({ title: 'Failed to load settings', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── save ──────────────────────────────────────────────────────────────────── */
  async function saveTemplates() {
    setSaving(true);
    try {
      const saved = await putAnnouncementSettings({
        birthdayTemplates: settings.birthdayTemplates,
        festivalTemplates: settings.festivalTemplates,
        birthdayTemplate: settings.birthdayTemplates[0] || '',
        festivalTemplate: settings.festivalTemplates[0] || '',
        festivalName: settings.festivalName,
        festivalMonthDay: settings.festivalMonthDay,
        autoBirthdayEnabled: settings.autoBirthdayEnabled,
        autoFestivalEnabled: settings.autoFestivalEnabled,
      });
      setSettings((p) => ({
        ...p, ...saved,
        birthdayTemplates: saved.birthdayTemplates?.length ? saved.birthdayTemplates : p.birthdayTemplates,
        festivalTemplates: saved.festivalTemplates?.length ? saved.festivalTemplates : p.festivalTemplates,
      }));
      originalSettings.current = settings;
      toast({ title: 'Saved', description: 'Announcement templates saved successfully.' });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function discardChanges() {
    setSettings(originalSettings.current);
  }

  /* ── trigger ───────────────────────────────────────────────────────────────── */
  async function trigger(mode: 'manual' | 'birthday' | 'festival') {
    setSending(true);
    try {
      const payload =
        mode === 'manual'
          ? { mode, message: manualText }
          : mode === 'birthday'
          ? { mode, name: birthdayName, templateIndex: birthdayTplIdx === 'auto' ? undefined : Number(birthdayTplIdx) }
          : { mode, festivalName: settings.festivalName, templateIndex: festivalTplIdx === 'auto' ? undefined : Number(festivalTplIdx) };
      const r = await triggerAnnouncement(payload);
      if (!r.ok) {
        toast({ title: 'Send failed', description: r.error, variant: 'destructive' });
        return;
      }
      const usedName = mode === 'birthday'
        ? bdayNames[r.usedTemplateIndex ?? 0] ?? `Template #${(r.usedTemplateIndex ?? 0) + 1}`
        : mode === 'festival'
        ? festNames[r.usedTemplateIndex ?? 0] ?? `Template #${(r.usedTemplateIndex ?? 0) + 1}`
        : '';

      if (mode === 'manual') {
        pushHistory({ label: 'Manual Message Sent', sub: 'To: #general-channel', ts: Date.now(), kind: 'manual' });
      } else if (mode === 'birthday') {
        pushHistory({ label: `Birthday Trigger${birthdayName ? `: ${birthdayName}` : ''}`, sub: `Template: ${usedName}`, ts: Date.now(), kind: 'birthday' });
      } else {
        pushHistory({ label: `Festival Trigger: ${settings.festivalName || 'Festival'}`, sub: `Template: ${usedName}`, ts: Date.now(), kind: 'festival' });
      }
      toast({ title: 'Sent!', description: `${r.sentCount ?? 1} message(s) delivered to Google Chat.` });
    } finally {
      setSending(false);
    }
  }

  /* ── template helpers ──────────────────────────────────────────────────────── */
  function startEditBday(idx: number) {
    setEditBuf({ name: bdayNames[idx] ?? `Template #${idx + 1}`, msg: settings.birthdayTemplates[idx] ?? '' });
    setEditingBday(idx);
    setEditingFest(null);
  }
  function commitEditBday(idx: number) {
    setBdayNames((p) => { const n = [...p]; n[idx] = editBuf.name || `Template #${idx + 1}`; return n; });
    setSettings((p) => ({ ...p, birthdayTemplates: p.birthdayTemplates.map((t, i) => i === idx ? editBuf.msg : t) }));
    setEditingBday(null);
  }
  function startEditFest(idx: number) {
    setEditBuf({ name: festNames[idx] ?? `Template #${idx + 1}`, msg: settings.festivalTemplates[idx] ?? '' });
    setEditingFest(idx);
    setEditingBday(null);
  }
  function commitEditFest(idx: number) {
    setFestNames((p) => { const n = [...p]; n[idx] = editBuf.name || `Template #${idx + 1}`; return n; });
    setSettings((p) => ({ ...p, festivalTemplates: p.festivalTemplates.map((t, i) => i === idx ? editBuf.msg : t) }));
    setEditingFest(null);
  }
  function addBdayTemplate() {
    setSettings((p) => ({ ...p, birthdayTemplates: [...p.birthdayTemplates, 'Happy Birthday {name}! 🎂'] }));
    setBdayNames((p) => [...p, `Template #${p.length + 1}`]);
  }
  function addFestTemplate() {
    setSettings((p) => ({ ...p, festivalTemplates: [...p.festivalTemplates, 'Happy {festivalName}! ✨'] }));
    setFestNames((p) => [...p, `Template #${p.length + 1}`]);
  }
  function removeBday(idx: number) {
    if (settings.birthdayTemplates.length <= 1) return;
    setSettings((p) => { const n = p.birthdayTemplates.filter((_, i) => i !== idx); return { ...p, birthdayTemplates: n }; });
    setBdayNames((p) => p.filter((_, i) => i !== idx));
  }
  function removeFest(idx: number) {
    if (settings.festivalTemplates.length <= 1) return;
    setSettings((p) => { const n = p.festivalTemplates.filter((_, i) => i !== idx); return { ...p, festivalTemplates: n }; });
    setFestNames((p) => p.filter((_, i) => i !== idx));
  }

  const automationEnabled = settings.autoBirthdayEnabled || settings.autoFestivalEnabled;

  /* ── render ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Announcements"
        description="Send manual and template-based Google Chat announcements to your global workspace."
      />

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/30 border border-border/50 rounded-xl p-1 w-fit">
        {(['manual', 'templates'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              tab === t
                ? 'bg-foreground text-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── MANUAL TAB ─────────────────────────────────────────────────────────── */}
      {tab === 'manual' && (
        <div className="space-y-5">
          {/* Manual Announcement */}
          <SectionCard title="Manual Announcement">
            <div className="space-y-3">
              <div className="relative">
                <Textarea
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value.slice(0, 1000))}
                  rows={5}
                  placeholder="Type your global announcement here... Use @name to tag specific departments."
                  className="resize-none bg-muted/20 border-border/50 rounded-xl text-sm placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{manualText.length} / 1000 characters</span>
                <Button
                  onClick={() => void trigger('manual')}
                  disabled={sending || !manualText.trim()}
                  size="sm"
                  className="gap-2 rounded-lg"
                >
                  <Send className="w-3.5 h-3.5" /> Send Manual Message
                </Button>
              </div>
            </div>
          </SectionCard>

          {/* System Triggers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <SectionLabel title="System Triggers" />
              {automationEnabled && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  Automation Enabled
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Birthday Trigger Card */}
              <TriggerCard
                icon={<UserRound className="w-5 h-5" />}
                title="Birthday Trigger"
                topLabel="EMPLOYEE NAME"
                topSlot={
                  <Input
                    value={birthdayName}
                    onChange={(e) => setBirthdayName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    className="h-9 bg-muted/20 border-border/50 rounded-lg text-sm"
                  />
                }
                bottomLabel="SELECT TEMPLATE"
                bottomSlot={
                  <Select value={birthdayTplIdx} onValueChange={setBirthdayTplIdx}>
                    <SelectTrigger className="h-9 bg-muted/20 border-border/50 rounded-lg text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (next in rotation)</SelectItem>
                      {settings.birthdayTemplates.map((_, i) => (
                        <SelectItem key={i} value={String(i)}>{bdayNames[i] ?? `Template #${i + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
                button={
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-lg text-sm gap-2 border-border/50"
                    onClick={() => void trigger('birthday')}
                    disabled={sending}
                  >
                    <Cake className="w-4 h-4" /> Trigger Birthday
                  </Button>
                }
              />

              {/* Festival Trigger Card */}
              <TriggerCard
                icon={<PartyPopper className="w-5 h-5" />}
                title="Festival Trigger"
                topLabel="ACTIVE OCCASION"
                topSlot={
                  <div className="flex items-center gap-2 h-9 px-3 bg-muted/20 border border-border/50 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <Input
                      value={settings.festivalName}
                      onChange={(e) => setSettings((p) => ({ ...p, festivalName: e.target.value }))}
                      placeholder="e.g. Lunar New Year 2024"
                      className="h-7 border-0 bg-transparent p-0 text-sm focus-visible:ring-0"
                    />
                  </div>
                }
                bottomLabel="SELECT TEMPLATE"
                bottomSlot={
                  <Select value={festivalTplIdx} onValueChange={setFestivalTplIdx}>
                    <SelectTrigger className="h-9 bg-muted/20 border-border/50 rounded-lg text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (next in rotation)</SelectItem>
                      {settings.festivalTemplates.map((_, i) => (
                        <SelectItem key={i} value={String(i)}>{festNames[i] ?? `Template #${i + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
                button={
                  <Button
                    variant="outline"
                    className="w-full h-9 rounded-lg text-sm gap-2 border-border/50"
                    onClick={() => void trigger('festival')}
                    disabled={sending}
                  >
                    <Sparkles className="w-4 h-4" /> Trigger Festival
                  </Button>
                }
              />
            </div>
          </div>

          {/* Bottom row: History + Pro Tip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Recent History */}
            <div className="md:col-span-2 rounded-xl border border-border/50 bg-card/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">Recent History</span>
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">View All</button>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No messages sent yet in this session.</p>
              ) : (
                <div className="space-y-2">
                  {history.slice(0, 5).map((h) => (
                    <div key={h.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0">
                      <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        h.kind === 'manual' ? 'bg-blue-400' : h.kind === 'birthday' ? 'bg-rose-400' : 'bg-amber-400'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none">{h.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{h.sub}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground flex-shrink-0">{timeAgo(h.ts)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pro Tip */}
            <div className="rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/20 p-4 flex flex-col justify-between">
              <div>
                <p className="text-sm font-bold text-blue-300 mb-2">Pro Tip</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Templates with dynamic variables like <code className="text-blue-300">{'{name}'}</code> and{' '}
                  <code className="text-blue-300">{'{department}'}</code> see 40% higher engagement on Google Chat.
                </p>
              </div>
              <button
                onClick={() => setTab('templates')}
                className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
              >
                Manage Templates <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATES TAB ──────────────────────────────────────────────────────── */}
      {tab === 'templates' && (
        <div className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading templates…</p>
          ) : (
            <>
              {/* Birthday Templates */}
              <TemplateSection
                title="Birthday Templates"
                subtitle="Manage automated messages for employee birthdays."
                onAdd={addBdayTemplate}
                names={bdayNames}
                templates={settings.birthdayTemplates}
                editingIdx={editingBday}
                editBuf={editBuf}
                setEditBuf={setEditBuf}
                onStartEdit={startEditBday}
                onCommitEdit={commitEditBday}
                onCancelEdit={() => setEditingBday(null)}
                onRemove={removeBday}
              />

              {/* Festival Templates */}
              <TemplateSection
                title="Festival Templates"
                subtitle="Seasonal and cultural celebration announcements."
                onAdd={addFestTemplate}
                names={festNames}
                templates={settings.festivalTemplates}
                editingIdx={editingFest}
                editBuf={editBuf}
                setEditBuf={setEditBuf}
                onStartEdit={startEditFest}
                onCommitEdit={commitEditFest}
                onCancelEdit={() => setEditingFest(null)}
                onRemove={removeFest}
              />

              {/* Auto Triggers + Festival Config */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Left: Auto Triggers */}
                <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
                  <p className="text-sm font-semibold">Auto Triggers</p>
                  <ToggleRow
                    label="Auto Birthday Trigger"
                    checked={settings.autoBirthdayEnabled}
                    onChange={(v) => setSettings((p) => ({ ...p, autoBirthdayEnabled: v }))}
                    dot="bg-blue-400"
                  />
                  <ToggleRow
                    label="Auto Festival Trigger"
                    checked={settings.autoFestivalEnabled}
                    onChange={(v) => setSettings((p) => ({ ...p, autoFestivalEnabled: v }))}
                    dot="bg-muted-foreground/40"
                  />
                </div>

                {/* Right: Festival Name + Date */}
                <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Festival Name</Label>
                    <Input
                      value={settings.festivalName}
                      onChange={(e) => setSettings((p) => ({ ...p, festivalName: e.target.value }))}
                      placeholder="e.g. Founder's Day"
                      className="h-10 bg-muted/20 border-border/50 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Festival Date</Label>
                    <Input
                      type="date"
                      value={monthDayToInputDate(settings.festivalMonthDay)}
                      onChange={(e) => setSettings((p) => ({ ...p, festivalMonthDay: inputDateToMonthDay(e.target.value) }))}
                      className="h-10 bg-muted/20 border-border/50 rounded-lg pr-10 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/10 px-5 py-3.5">
                <p className="text-xs text-muted-foreground">
                  {settings.lastBirthdayRunOn
                    ? `Last auto run: ${settings.lastBirthdayRunOn} — 09:00 AM`
                    : 'Auto announcements have not run yet.'}
                </p>
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" className="rounded-lg text-sm" onClick={discardChanges} disabled={saving}>
                    Discard Changes
                  </Button>
                  <Button size="sm" className="rounded-lg gap-2 text-sm" onClick={() => void saveTemplates()} disabled={saving}>
                    <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Templates'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── shared sub-components ───────────────────────────────────────────────────── */

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-1 h-4 rounded-full bg-primary" />
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3">
      <SectionLabel title={title} />
      {children}
    </div>
  );
}

function TriggerCard({
  icon, title, topLabel, topSlot, bottomLabel, bottomSlot, button,
}: {
  icon: React.ReactNode;
  title: string;
  topLabel: string;
  topSlot: React.ReactNode;
  bottomLabel: string;
  bottomSlot: React.ReactNode;
  button: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
        <button className="text-muted-foreground hover:text-foreground transition-colors p-1">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      <p className="font-semibold text-sm">{title}</p>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{topLabel}</p>
        {topSlot}
      </div>
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{bottomLabel}</p>
        {bottomSlot}
      </div>
      {button}
    </div>
  );
}

function ToggleRow({ label, checked, onChange, dot }: { label: string; checked: boolean; onChange: (v: boolean) => void; dot: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${checked ? dot : 'bg-muted-foreground/30'}`} />
        <span className="text-sm">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function TemplateSection({
  title, subtitle, onAdd, names, templates, editingIdx, editBuf, setEditBuf,
  onStartEdit, onCommitEdit, onCancelEdit, onRemove,
}: {
  title: string;
  subtitle: string;
  onAdd: () => void;
  names: string[];
  templates: string[];
  editingIdx: number | null;
  editBuf: { name: string; msg: string };
  setEditBuf: React.Dispatch<React.SetStateAction<{ name: string; msg: string }>>;
  onStartEdit: (i: number) => void;
  onCommitEdit: (i: number) => void;
  onCancelEdit: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border/40 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-8 rounded-lg flex-shrink-0" onClick={onAdd}>
          <Plus className="w-3.5 h-3.5" /> Add Template
        </Button>
      </div>

      {/* Table */}
      <div className="w-full">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20">
              <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-5 py-2.5 w-44">Template Name</th>
              <th className="text-left text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-2.5">Message Preview</th>
              <th className="text-right text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-5 py-2.5 w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((tpl, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                {editingIdx === i ? (
                  <>
                    <td className="px-5 py-3 align-top">
                      <Input
                        value={editBuf.name}
                        onChange={(e) => setEditBuf((b) => ({ ...b, name: e.target.value }))}
                        className="h-8 text-xs bg-muted/30 border-border/60 rounded-lg"
                        placeholder="Template name"
                      />
                    </td>
                    <td className="px-3 py-3 align-top">
                      <Textarea
                        value={editBuf.msg}
                        onChange={(e) => setEditBuf((b) => ({ ...b, msg: e.target.value }))}
                        rows={2}
                        className="text-xs bg-muted/30 border-border/60 rounded-lg resize-none"
                      />
                    </td>
                    <td className="px-5 py-3 align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onCommitEdit(i)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-emerald-400 hover:bg-emerald-400/10 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={onCancelEdit}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted/40 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 font-medium text-sm align-middle">
                      {names[i] ?? `Template #${i + 1}`}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-xs align-middle max-w-0">
                      <p className="truncate">{tpl}</p>
                    </td>
                    <td className="px-5 py-3 align-middle">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onStartEdit(i)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onRemove(i)}
                          disabled={templates.length <= 1}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
