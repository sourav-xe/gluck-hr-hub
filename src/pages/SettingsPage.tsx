import { useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Bell, Mail, MessageSquare, Save, Zap } from 'lucide-react';

export default function SettingsPage() {
  const { toast } = useToast();

  const [company, setCompany] = useState({
    name: 'Gluck Global',
    address: 'Srimavo Bandaranayaka Mawatha, Peradeniya Road, Kandy, Sri Lanka',
    email: 'info@gluckglobal.com',
    website: 'www.gluckglobal.com',
  });

  const [leavePolicy, setLeavePolicy] = useState({ annual: 14, sick: 7, casual: 5 });

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

  const requestBrowserPermission = async () => {
    if (!('Notification' in window)) {
      toast({ title: 'Not supported', description: 'Browser notifications are not supported.' , variant: 'destructive' });
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

  const saveNotificationSettings = () => {
    toast({ title: '✅ Settings saved', description: 'Notification preferences updated successfully.' });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Configure system settings" />

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="rounded-xl bg-muted/50 p-1">
          <TabsTrigger value="company" className="rounded-lg text-xs font-semibold">Company Profile</TabsTrigger>
          <TabsTrigger value="leave" className="rounded-lg text-xs font-semibold">Leave Policy</TabsTrigger>
          <TabsTrigger value="salary" className="rounded-lg text-xs font-semibold">Salary Settings</TabsTrigger>
          <TabsTrigger value="notifications" className="rounded-lg text-xs font-semibold">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <div className="glass-card rounded-2xl p-6 space-y-5 max-w-2xl">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company Name</Label>
              <Input value={company.name} onChange={e => setCompany(p => ({ ...p, name: e.target.value }))} className="mt-1.5 rounded-xl h-10" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</Label>
              <Textarea value={company.address} onChange={e => setCompany(p => ({ ...p, address: e.target.value }))} className="mt-1.5 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <Button onClick={() => toast({ title: '✅ Settings saved', description: 'Company profile updated successfully.' })} className="rounded-xl gap-2">
              <Save className="w-4 h-4" /> Save Changes
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="leave">
          <div className="glass-card rounded-2xl p-6 space-y-5 max-w-lg">
            <h3 className="font-bold text-sm">Leave Days Per Year (Default)</h3>
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
            <Button onClick={() => toast({ title: '✅ Policy saved', description: 'Leave policy updated successfully.' })} className="rounded-xl gap-2">
              <Save className="w-4 h-4" /> Save Policy
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="salary">
          <div className="glass-card rounded-2xl p-6 space-y-5 max-w-lg">
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
            <Button onClick={() => toast({ title: '✅ Saved', description: 'Salary settings updated.' })} className="rounded-xl gap-2">
              <Save className="w-4 h-4" /> Save
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="space-y-6 max-w-3xl">
            {/* Notification Channels */}
            <div className="glass-card rounded-2xl p-6">
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
                      <p className="text-xs text-muted-foreground">Send email notifications (requires backend)</p>
                    </div>
                  </div>
                  <Switch checked={notifications.emailNotifications} onCheckedChange={v => setNotifications(p => ({ ...p, emailNotifications: v }))} />
                </div>
              </div>
            </div>

            {/* Notification Triggers */}
            <div className="glass-card rounded-2xl p-6">
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

            {/* Email Templates */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="font-bold text-sm mb-5 flex items-center gap-2"><Mail className="w-4 h-4 text-info" /> Email Templates</h3>
              <div className="space-y-5">
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
                <Button onClick={saveNotificationSettings} className="rounded-xl gap-2">
                  <Save className="w-4 h-4" /> Save All Settings
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

