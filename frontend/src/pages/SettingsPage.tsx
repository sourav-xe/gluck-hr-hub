import { useState, useEffect } from 'react';
import { defaultAttendanceSettings } from '@/lib/defaults';
import { fetchAnnouncementSettings, fetchAttendanceSettings, postGoogleChatMessage, putAnnouncementSettings, putAttendanceSettings, triggerAnnouncement } from '@/lib/hrApi';
import type { AttendanceSettings } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Bell,
  Mail,
  MessageSquare,
  Save,
  Zap,
  Shield,
  Wifi,
  Plus,
  X,
  Clock,
  Send,
  Building2,
  CalendarDays,
  Wallet,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function monthDayToInputDate(monthDay: string): string {
  if (!monthDay || !/^\d{2}-\d{2}$/.test(monthDay)) return '';
  const y = new Date().getFullYear();
  return `${y}-${monthDay}`;
}

function inputDateToMonthDay(input: string): string {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return '';
  return input.slice(5);
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { hasAccess } = useAuth();
  const canManageGChat = hasAccess(['super_admin']);

  const [company, setCompany] = useState({
    name: 'Gluck Global',
    address: 'Srimavo Bandaranayaka Mawatha, Peradeniya Road, Kandy, Sri Lanka',
    email: 'info@gluckglobal.com',
    website: 'www.gluckglobal.com',
  });

  const [leavePolicy, setLeavePolicy] = useState({ annual: 14, sick: 7, casual: 5 });

  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings>({ ...defaultAttendanceSettings });
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [newIP, setNewIP] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchAttendanceSettings();
        if (!cancelled) setAttendanceSettings(s);
      } catch {
        if (!cancelled) setAttendanceSettings({ ...defaultAttendanceSettings });
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [notifications, setNotifications] = useState({
    inAppToasts: true,
    browserNotifications: false,
    emailNotifications: true,
    birthdayNotify: true,
    leaveApproval: true,
    salaryPaid: true,
    attendanceReminder: true,
    welcomeMessage: true,
    preJoiningReminder: true,
    timesheetReminder: true,
  });

  const [templates, setTemplates] = useState({
    welcome: 'Dear {name}, Welcome to Gluck Global! We\'re excited to have you join our team. Your start date is {joiningDate}. Please report to {department} department.',
    salary: 'Dear {name}, Your salary for {month} {year} of LKR {amount} has been processed and credited to your account ending in {accountLast4}.',
    leaveApproval: 'Dear {name}, Your {leaveType} leave from {fromDate} to {toDate} has been {status}. {note}',
    attendanceReminder: 'Hi {name}, friendly reminder to mark your attendance for today. Please update your status before 10:00 AM.',
    birthday: 'Happy Birthday {name}! 🎂 Wishing you a wonderful year ahead from the Gluck Global family.',
  });

  const [gchatMode, setGchatMode] = useState<'birthday' | 'announcement' | 'custom'>('birthday');
  const [birthdayName, setBirthdayName] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [gchatSending, setGchatSending] = useState(false);
  const [announcementTab, setAnnouncementTab] = useState<'manual' | 'templates'>('manual');
  const [announcementSettings, setAnnouncementSettings] = useState({
    birthdayTemplate: templates.birthday,
    festivalTemplate: 'Happy {festivalName}! ✨ Wishing everyone joy, health, and success.',
    festivalName: '',
    festivalMonthDay: '',
    autoBirthdayEnabled: true,
    autoFestivalEnabled: false,
    lastBirthdayRunOn: '',
    lastFestivalRunOn: '',
  });
  const [announcementLoading, setAnnouncementLoading] = useState(true);
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [manualAnnouncementText, setManualAnnouncementText] = useState('');
  const [manualBirthdayName, setManualBirthdayName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await fetchAnnouncementSettings();
        if (!cancelled) {
          setAnnouncementSettings({
            birthdayTemplate: s.birthdayTemplate,
            festivalTemplate: s.festivalTemplate,
            festivalName: s.festivalName,
            festivalMonthDay: s.festivalMonthDay,
            autoBirthdayEnabled: s.autoBirthdayEnabled,
            autoFestivalEnabled: s.autoFestivalEnabled,
            lastBirthdayRunOn: s.lastBirthdayRunOn || '',
            lastFestivalRunOn: s.lastFestivalRunOn || '',
          });
          setTemplates((p) => ({ ...p, birthday: s.birthdayTemplate }));
        }
      } finally {
        if (!cancelled) setAnnouncementLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      toast({ title: 'Not supported', description: 'Browser notifications are not supported.', variant: 'destructive' });
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      setNotifications(p => ({ ...p, browserNotifications: true }));
      new Notification('Gluck Global HR', { body: 'Browser notifications enabled! 🔔', icon: '/favicon.ico' });
      toast({ title: '🔔 Enabled', description: 'Browser notifications are now active.' });
    } else {
      toast({ title: 'Permission denied', description: 'Please allow notifications in browser settings.', variant: 'destructive' });
    }
  };

  const sendTestToast = (type: string) => {
    const msgs: Record<string, { title: string; description: string }> = {
      birthday: { title: '🎂 Birthday Notification', description: templates.birthday.replace('{name}', 'Ashan Perera') },
      leave: { title: '📋 Leave Approved', description: templates.leaveApproval.replace('{name}', 'Dilini Fernando').replace('{leaveType}', 'Annual').replace('{fromDate}', '10/03/2025').replace('{toDate}', '12/03/2025').replace('{status}', 'Approved').replace('{note}', '') },
      salary: { title: '💰 Salary Paid', description: templates.salary.replace('{name}', 'Priya Jayasinghe').replace('{month}', 'March').replace('{year}', '2025').replace('{amount}', '55,000').replace('{accountLast4}', '2233') },
      attendance: { title: '⏰ Attendance Reminder', description: templates.attendanceReminder.replace('{name}', 'Team') },
      welcome: { title: '👋 Welcome Message', description: templates.welcome.replace('{name}', 'New Employee').replace('{joiningDate}', '01/04/2025').replace('{department}', 'HR') },
    };
    const msg = msgs[type] || { title: 'Test', description: 'Test notification' };
    toast(msg);

    if (notifications.browserNotifications && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(msg.title, { body: msg.description });
    }
  };

  const addIP = () => {
    if (newIP && !attendanceSettings.allowedIPs.includes(newIP)) {
      setAttendanceSettings(p => ({ ...p, allowedIPs: [...p.allowedIPs, newIP] }));
      setNewIP('');
    }
  };

  const removeIP = (ip: string) => {
    setAttendanceSettings(p => ({ ...p, allowedIPs: p.allowedIPs.filter(i => i !== ip) }));
  };

  const composeGoogleChatMessage = () => {
    if (gchatMode === 'birthday') {
      if (!birthdayName.trim()) return '';
      return templates.birthday.replace('{name}', birthdayName.trim());
    }
    if (gchatMode === 'announcement') {
      if (!announcementBody.trim()) return '';
      const title = announcementTitle.trim() || 'Announcement';
      return `📢 ${title}\n\n${announcementBody.trim()}`;
    }
    return customMessage.trim();
  };

  const handleSendGoogleChat = async () => {
    const text = composeGoogleChatMessage();
    if (!text) {
      toast({ title: 'Missing message', description: 'Please fill template values or message text.', variant: 'destructive' });
      return;
    }
    setGchatSending(true);
    try {
      const res = await postGoogleChatMessage(text);
      if (!res.ok) {
        toast({ title: 'Send failed', description: res.error || 'Could not send to Google Chat.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Message sent', description: 'Google Chat group received your message.' });
    } finally {
      setGchatSending(false);
    }
  };

  const saveAnnouncementTemplates = async () => {
    setAnnouncementSaving(true);
    try {
      const saved = await putAnnouncementSettings({
        birthdayTemplate: announcementSettings.birthdayTemplate,
        festivalTemplate: announcementSettings.festivalTemplate,
        festivalName: announcementSettings.festivalName,
        festivalMonthDay: announcementSettings.festivalMonthDay,
        autoBirthdayEnabled: announcementSettings.autoBirthdayEnabled,
        autoFestivalEnabled: announcementSettings.autoFestivalEnabled,
      });
      setAnnouncementSettings((p) => ({ ...p, ...saved }));
      setTemplates((p) => ({ ...p, birthday: saved.birthdayTemplate }));
      toast({ title: 'Saved', description: 'Announcement templates saved.' });
    } catch {
      toast({ title: 'Save failed', description: 'Could not save announcement templates.', variant: 'destructive' });
    } finally {
      setAnnouncementSaving(false);
    }
  };

  const runManualTrigger = async (mode: 'manual' | 'birthday' | 'festival') => {
    setAnnouncementSaving(true);
    try {
      const payload =
        mode === 'manual'
          ? { mode, message: manualAnnouncementText }
          : mode === 'birthday'
          ? { mode, name: manualBirthdayName }
          : { mode, festivalName: announcementSettings.festivalName };
      const r = await triggerAnnouncement(payload);
      if (!r.ok) {
        toast({ title: 'Send failed', description: r.error || 'Could not trigger message.', variant: 'destructive' });
        return;
      }
      toast({ title: 'Sent to Google Chat', description: `Delivered ${r.sentCount ?? 0} message(s).` });
    } finally {
      setAnnouncementSaving(false);
    }
  };

  return (
    <div className="animate-fade-in w-full min-w-0 space-y-6 pb-8">
      <PageHeader
        title="Settings"
        description="Company profile, HR policies, attendance, and notifications — use the full width below."
      />

      <Tabs defaultValue="organization" className="w-full min-w-0 space-y-6">
        <TabsList className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border/50 bg-muted/40 p-1.5 h-auto shadow-sm">
          <TabsTrigger value="organization" className="rounded-lg text-xs sm:text-sm font-semibold py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Organization
          </TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-lg text-xs sm:text-sm font-semibold py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Attendance
          </TabsTrigger>
          <TabsTrigger value="alerts" className="rounded-lg text-xs sm:text-sm font-semibold py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            Alerts &amp; Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="mt-0 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 items-start">
            <section className="glass-card rounded-2xl p-6 space-y-5 min-w-0 lg:col-span-1">
              <div className="flex items-center gap-2 pb-3 border-b border-border/40">
                <Building2 className="w-4 h-4 text-primary shrink-0" />
                <h3 className="font-semibold text-sm">Company profile</h3>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Name</Label>
                <Input value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} className="mt-1.5 rounded-xl h-10" />
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</Label>
                <Textarea value={company.address} onChange={e => setCompany(p => ({ ...p, address: e.target.value }))} className="mt-1.5 rounded-xl" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input value={company.email} onChange={e => setCompany(p => ({ ...p, email: e.target.value }))} className="mt-1.5 rounded-xl h-10" />
                </div>
                <div>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Website</Label>
                  <Input value={company.website} onChange={e => setCompany(p => ({ ...p, website: e.target.value }))} className="mt-1.5 rounded-xl h-10" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logo Upload</Label>
                <Input type="file" accept="image/*" className="mt-1.5 rounded-xl" />
              </div>
              <Button onClick={() => toast({ title: '✅ Saved', description: 'Company profile updated.' })} className="rounded-xl gap-2 w-full sm:w-auto">
                <Save className="w-4 h-4" /> Save company
              </Button>
            </section>

            <section className="glass-card rounded-2xl p-6 space-y-5 min-w-0">
              <div className="flex items-center gap-2 pb-3 border-b border-border/40">
                <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                <h3 className="font-semibold text-sm">Leave policy</h3>
              </div>
              <p className="text-xs text-muted-foreground -mt-2">Default leave days per year (reference for HR).</p>
              {[
                { label: 'Annual Leave Days', key: 'annual' as const },
                { label: 'Sick Leave Days', key: 'sick' as const },
                { label: 'Casual Leave Days', key: 'casual' as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
                  <Input type="number" value={leavePolicy[key]} onChange={e => setLeavePolicy(p => ({ ...p, [key]: Number(e.target.value) }))} className="mt-1.5 rounded-xl h-10" />
                </div>
              ))}
              <Button onClick={() => toast({ title: '✅ Policy saved', description: 'Leave policy updated.' })} className="rounded-xl gap-2 w-full sm:w-auto">
                <Save className="w-4 h-4" /> Save leave policy
              </Button>
            </section>

            <section className="glass-card rounded-2xl p-6 space-y-5 min-w-0">
              <div className="flex items-center gap-2 pb-3 border-b border-border/40">
                <Wallet className="w-4 h-4 text-primary shrink-0" />
                <h3 className="font-semibold text-sm">Payroll defaults</h3>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Default Pay Cycle</Label>
                <Select defaultValue="monthly">
                  <SelectTrigger className="mt-1.5 rounded-xl h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Currency</Label>
                <Input disabled value="LKR (Sri Lankan Rupee)" className="mt-1.5 rounded-xl h-10" />
              </div>
              <Button onClick={() => toast({ title: '✅ Saved', description: 'Salary settings updated.' })} className="rounded-xl gap-2 w-full sm:w-auto">
                <Save className="w-4 h-4" /> Save payroll
              </Button>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="attendance" className="mt-0 focus-visible:outline-none">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5 items-start">
            {attendanceLoading && (
              <p className="text-sm text-muted-foreground lg:col-span-2">Loading attendance settings…</p>
            )}
            <div className="glass-card rounded-2xl p-6 min-w-0">
              <h3 className="font-bold text-sm mb-5 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" /> IP-Based Location Restriction</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Wifi className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">Enable IP Restriction</p>
                      <p className="text-xs text-muted-foreground">Employees can only clock in from approved IP addresses/ranges</p>
                    </div>
                  </div>
                  <Switch
                    checked={attendanceSettings.ipRestrictionEnabled}
                    onCheckedChange={v => setAttendanceSettings(p => ({ ...p, ipRestrictionEnabled: v }))}
                  />
                </div>

                {attendanceSettings.ipRestrictionEnabled && (
                  <div className="space-y-3 pl-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allowed IP Addresses / Ranges</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newIP}
                        onChange={e => setNewIP(e.target.value)}
                        placeholder="e.g. 192.168.1.0/24 or 10.0.0.1"
                        className="rounded-xl h-9 text-sm"
                      />
                      <Button size="sm" onClick={addIP} className="rounded-xl h-9 gap-1">
                        <Plus className="w-3 h-3" /> Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {attendanceSettings.allowedIPs.map(ip => (
                        <div key={ip} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-mono">
                          {ip}
                          <button onClick={() => removeIP(ip)} className="hover:text-destructive transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 min-w-0">
              <h3 className="font-bold text-sm mb-5 flex items-center gap-2"><Clock className="w-4 h-4 text-accent" /> Clock-In/Out Rules</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Auto-mark Absent</p>
                    <p className="text-xs text-muted-foreground">Mark employees as absent if not clocked in by end of day</p>
                  </div>
                  <Switch
                    checked={attendanceSettings.autoMarkAbsent}
                    onCheckedChange={v => setAttendanceSettings(p => ({ ...p, autoMarkAbsent: v }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Half Day Threshold (hours)</Label>
                    <Input
                      type="number"
                      value={attendanceSettings.halfDayThresholdHours}
                      onChange={e => setAttendanceSettings(p => ({ ...p, halfDayThresholdHours: Number(e.target.value) }))}
                      className="mt-1.5 rounded-xl h-10"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Full Day Threshold (hours)</Label>
                    <Input
                      type="number"
                      value={attendanceSettings.fullDayThresholdHours}
                      onChange={e => setAttendanceSettings(p => ({ ...p, fullDayThresholdHours: Number(e.target.value) }))}
                      className="mt-1.5 rounded-xl h-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex lg:col-span-2">
              <Button
                disabled={attendanceLoading || attendanceSaving}
                onClick={async () => {
                  setAttendanceSaving(true);
                  try {
                    const s = await putAttendanceSettings(attendanceSettings);
                    setAttendanceSettings(s);
                    toast({ title: 'Saved', description: 'Attendance settings updated.' });
                  } catch {
                    toast({ title: 'Save failed', description: 'Could not save attendance settings.', variant: 'destructive' });
                  } finally {
                    setAttendanceSaving(false);
                  }
                }}
                className="rounded-xl gap-2"
              >
                <Save className="w-4 h-4" /> {attendanceSaving ? 'Saving…' : 'Save attendance settings'}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="mt-0 focus-visible:outline-none">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5 items-start">
            <div className="glass-card rounded-2xl p-6 min-w-0">
              <h3 className="font-bold text-sm mb-5 flex items-center gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Google Chat Sender</h3>
              {!canManageGChat && (
                <p className="text-sm text-muted-foreground">Only Super Admin can send Google Chat messages.</p>
              )}
              {canManageGChat && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Message Type</Label>
                    <Select value={gchatMode} onValueChange={(v) => setGchatMode(v as 'birthday' | 'announcement' | 'custom')}>
                      <SelectTrigger className="mt-1.5 rounded-xl h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="birthday">Birthday Wish</SelectItem>
                        <SelectItem value="announcement">Announcement</SelectItem>
                        <SelectItem value="custom">Custom Message</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {gchatMode === 'birthday' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee Name</Label>
                        <Input value={birthdayName} onChange={(e) => setBirthdayName(e.target.value)} className="mt-1.5 rounded-xl h-10" placeholder="e.g. Sourav" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Template</Label>
                        <Textarea value={templates.birthday} onChange={e => setTemplates(p => ({ ...p, birthday: e.target.value }))} rows={2} className="mt-1.5 rounded-xl text-sm" />
                      </div>
                    </div>
                  )}

                  {gchatMode === 'announcement' && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Announcement Title</Label>
                        <Input value={announcementTitle} onChange={(e) => setAnnouncementTitle(e.target.value)} className="mt-1.5 rounded-xl h-10" placeholder="Office Update" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Announcement Message</Label>
                        <Textarea value={announcementBody} onChange={(e) => setAnnouncementBody(e.target.value)} rows={3} className="mt-1.5 rounded-xl text-sm" placeholder="Write your announcement..." />
                      </div>
                    </div>
                  )}

                  {gchatMode === 'custom' && (
                    <div>
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Custom Message</Label>
                      <Textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} rows={4} className="mt-1.5 rounded-xl text-sm" placeholder="Type any message to send to Google Chat group..." />
                    </div>
                  )}

                  <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Preview</p>
                    <p className="text-sm whitespace-pre-wrap">{composeGoogleChatMessage() || 'Your message preview appears here...'}</p>
                  </div>

                  <Button onClick={handleSendGoogleChat} disabled={gchatSending} className="rounded-xl gap-2">
                    <Send className="w-4 h-4" /> {gchatSending ? 'Sending…' : 'Send to Google Chat'}
                  </Button>
                </div>
              )}
            </div>

            <div className="glass-card rounded-2xl p-6 min-w-0">
              <h3 className="font-bold text-sm mb-5 flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /> Notification Channels</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">In-App Toasts</p>
                      <p className="text-xs text-muted-foreground">Show toast notifications within the app</p>
                    </div>
                  </div>
                  <Switch checked={notifications.inAppToasts} onCheckedChange={v => setNotifications(p => ({ ...p, inAppToasts: v }))} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">Browser Notifications</p>
                      <p className="text-xs text-muted-foreground">Push notifications via browser API</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!notifications.browserNotifications && (
                      <Button size="sm" variant="outline" onClick={requestBrowserPermission} className="h-7 text-xs rounded-lg">Enable</Button>
                    )}
                    <Switch
                      checked={notifications.browserNotifications}
                      onCheckedChange={v => {
                        if (v) requestBrowserPermission();
                        else setNotifications(p => ({ ...p, browserNotifications: false }));
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-semibold">Email Notifications</p>
                      <p className="text-xs text-muted-foreground">Send email notifications (configure SMTP in production)</p>
                    </div>
                  </div>
                  <Switch checked={notifications.emailNotifications} onCheckedChange={v => setNotifications(p => ({ ...p, emailNotifications: v }))} />
                </div>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 min-w-0">
              <h3 className="font-bold text-sm mb-5 flex items-center gap-2"><Zap className="w-4 h-4 text-accent" /> Notification Triggers</h3>
              <div className="space-y-3">
                {[
                  { key: 'birthdayNotify' as const, label: 'Birthday Notifications', desc: 'Notify on employee birthdays', test: 'birthday' },
                  { key: 'leaveApproval' as const, label: 'Leave Approval/Rejection', desc: 'Notify when leave is approved or rejected', test: 'leave' },
                  { key: 'salaryPaid' as const, label: 'Salary Paid', desc: 'Notify when salary is marked as paid', test: 'salary' },
                  { key: 'attendanceReminder' as const, label: 'Attendance Reminder', desc: 'Remind if attendance not marked by 10am', test: 'attendance' },
                  { key: 'welcomeMessage' as const, label: 'Welcome Message', desc: 'Send welcome message to new employees', test: 'welcome' },
                  { key: 'preJoiningReminder' as const, label: 'Pre-joining Reminder', desc: '7 days before start date reminder', test: 'welcome' },
                  { key: 'timesheetReminder' as const, label: 'Timesheet Reminder', desc: 'Last 3 days of month reminder', test: 'attendance' },
                ].map(({ key, label, desc, test }) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-semibold">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg text-muted-foreground" onClick={() => sendTestToast(test)}>Test</Button>
                      <Switch checked={notifications[key]} onCheckedChange={v => setNotifications(p => ({ ...p, [key]: v }))} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 min-w-0 xl:col-span-2">
              <h3 className="font-bold text-sm mb-5 flex items-center gap-2"><Mail className="w-4 h-4 text-info" /> Email Templates</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {[
                  { key: 'welcome' as const, label: 'Welcome Email Template', vars: '{name}, {joiningDate}, {department}' },
                  { key: 'salary' as const, label: 'Salary Notification Template', vars: '{name}, {month}, {year}, {amount}, {accountLast4}' },
                  { key: 'leaveApproval' as const, label: 'Leave Approval Template', vars: '{name}, {leaveType}, {fromDate}, {toDate}, {status}, {note}' },
                  { key: 'attendanceReminder' as const, label: 'Attendance Reminder Template', vars: '{name}' },
                  { key: 'birthday' as const, label: 'Birthday Message Template', vars: '{name}' },
                ].map(({ key, label, vars }) => (
                  <div key={key}>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</Label>
                    <p className="text-[10px] text-muted-foreground mb-1.5">Variables: {vars}</p>
                    <Textarea
                      value={templates[key]}
                      onChange={e => setTemplates(p => ({ ...p, [key]: e.target.value }))}
                      rows={3}
                      className="rounded-xl text-sm"
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-5">
                <Button onClick={() => toast({ title: '✅ Saved', description: 'Notification settings saved.' })} className="rounded-xl gap-2">
                  <Save className="w-4 h-4" /> Save notification templates
                </Button>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 min-w-0 xl:col-span-2 space-y-5">
              <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                <Megaphone className="w-4 h-4 text-primary shrink-0" />
                <h3 className="font-semibold text-sm">Scheduled announcements (Google Chat)</h3>
              </div>
              {!canManageGChat && (
                <p className="text-sm text-muted-foreground">Only Super Admin can manage announcements.</p>
              )}
              {canManageGChat && (
                <>
                  <Tabs value={announcementTab} onValueChange={(v) => setAnnouncementTab(v as 'manual' | 'templates')}>
                    <TabsList className="rounded-xl bg-muted/50 p-1 h-auto w-full sm:w-auto grid grid-cols-2 sm:inline-flex">
                      <TabsTrigger value="manual" className="rounded-lg text-xs font-semibold">Manual send</TabsTrigger>
                      <TabsTrigger value="templates" className="rounded-lg text-xs font-semibold">Templates &amp; automation</TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual" className="pt-4 space-y-4 focus-visible:outline-none">
                      <div>
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Manual Announcement</Label>
                        <Textarea value={manualAnnouncementText} onChange={(e) => setManualAnnouncementText(e.target.value)} rows={4} className="mt-1.5 rounded-xl text-sm" placeholder="Type custom announcement..." />
                        <Button onClick={() => void runManualTrigger('manual')} disabled={announcementSaving} className="rounded-xl gap-2 mt-3">
                          <Send className="w-4 h-4" /> Send Manual Message
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-xl border border-border/50 p-3">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Birthday Trigger</Label>
                          <Input value={manualBirthdayName} onChange={(e) => setManualBirthdayName(e.target.value)} className="mt-1.5 rounded-xl h-10" placeholder="Optional name (blank = all today's birthdays)" />
                          <Button variant="outline" onClick={() => void runManualTrigger('birthday')} disabled={announcementSaving} className="rounded-xl mt-3 h-9 text-xs">Trigger Birthday Template</Button>
                        </div>
                        <div className="rounded-xl border border-border/50 p-3">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Festival Trigger</Label>
                          <Input value={announcementSettings.festivalName} onChange={(e) => setAnnouncementSettings((p) => ({ ...p, festivalName: e.target.value }))} className="mt-1.5 rounded-xl h-10" placeholder="Festival name" />
                          <Button variant="outline" onClick={() => void runManualTrigger('festival')} disabled={announcementSaving} className="rounded-xl mt-3 h-9 text-xs">Trigger Festival Template</Button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="templates" className="pt-4 space-y-4 focus-visible:outline-none">
                      {announcementLoading ? (
                        <p className="text-sm text-muted-foreground">Loading templates…</p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Birthday Template</Label>
                              <p className="text-[10px] text-muted-foreground mb-1">Variable: {'{name}'}</p>
                              <Textarea
                                value={announcementSettings.birthdayTemplate}
                                onChange={(e) => setAnnouncementSettings((p) => ({ ...p, birthdayTemplate: e.target.value }))}
                                rows={3}
                                className="rounded-xl text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Festival Template</Label>
                              <p className="text-[10px] text-muted-foreground mb-1">Variable: {'{festivalName}'}</p>
                              <Textarea
                                value={announcementSettings.festivalTemplate}
                                onChange={(e) => setAnnouncementSettings((p) => ({ ...p, festivalTemplate: e.target.value }))}
                                rows={3}
                                className="rounded-xl text-sm"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Festival Name</Label>
                              <Input value={announcementSettings.festivalName} onChange={(e) => setAnnouncementSettings((p) => ({ ...p, festivalName: e.target.value }))} className="mt-1.5 rounded-xl h-10" />
                            </div>
                            <div>
                              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Festival Date</Label>
                              <Input
                                type="date"
                                value={monthDayToInputDate(announcementSettings.festivalMonthDay)}
                                onChange={(e) => setAnnouncementSettings((p) => ({ ...p, festivalMonthDay: inputDateToMonthDay(e.target.value) }))}
                                className="mt-1.5 rounded-xl h-10 pr-10 [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
                              <div>
                                <p className="text-sm font-semibold">Auto Birthday Trigger</p>
                                <p className="text-xs text-muted-foreground">Runs daily and sends birthday wishes to GChat</p>
                              </div>
                              <Switch checked={announcementSettings.autoBirthdayEnabled} onCheckedChange={(v) => setAnnouncementSettings((p) => ({ ...p, autoBirthdayEnabled: v }))} />
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
                              <div>
                                <p className="text-sm font-semibold">Auto Festival Trigger</p>
                                <p className="text-xs text-muted-foreground">Runs on configured festival date and sends to GChat</p>
                              </div>
                              <Switch checked={announcementSettings.autoFestivalEnabled} onCheckedChange={(v) => setAnnouncementSettings((p) => ({ ...p, autoFestivalEnabled: v }))} />
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Last auto run — Birthday: {announcementSettings.lastBirthdayRunOn || 'never'}, Festival: {announcementSettings.lastFestivalRunOn || 'never'}
                          </div>
                          <Button onClick={() => void saveAnnouncementTemplates()} disabled={announcementSaving} className="rounded-xl gap-2">
                            <Save className="w-4 h-4" /> {announcementSaving ? 'Saving…' : 'Save announcement templates'}
                          </Button>
                        </>
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
