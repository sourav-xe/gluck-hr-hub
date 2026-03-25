import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAttendanceRecords, fetchAttendanceSettings, postAttendanceBulk } from '@/lib/hrApi';
import { defaultAttendanceSettings } from '@/lib/defaults';
import type { AttendanceSettings } from '@/types/hr';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarCheck, CalendarOff, Laptop, Clock, LogIn, LogOut, MapPin, Wifi, Loader2, AlertCircle } from 'lucide-react';

interface AttendanceEntry {
  date: string;
  clockIn: string;
  clockOut: string | null;
  totalHours: number | null;
  status: string;
}

function isClockedOut(clockOut: string | null | undefined): boolean {
  return !!(clockOut && clockOut !== '—');
}

export default function MyAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showClockDialog, setShowClockDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState<'in' | 'out'>('in');
  const [settings, setSettings] = useState<AttendanceSettings>(defaultAttendanceSettings);
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) setLoading(true);
      try {
        const s = await fetchAttendanceSettings();
        setSettings(s);
      } catch {
        setSettings(defaultAttendanceSettings);
      }
      try {
        const all = await fetchAttendanceRecords();
        const mine = user.employeeId
          ? all.filter((a) => String(a.employeeId) === String(user.employeeId))
          : [];
        const mapped = mine.slice(0, 120).map((a) => ({
          date: a.date,
          clockIn: a.clockIn || '—',
          clockOut: a.clockOut && a.clockOut.trim() ? a.clockOut : null,
          totalHours: a.totalHours ?? null,
          status: a.status,
        }));
        mapped.sort((a, b) => {
          const [da, ma, ya] = a.date.split('/').map(Number);
          const [db, mb, yb] = b.date.split('/').map(Number);
          const ta = new Date(ya, ma - 1, da).getTime();
          const tb = new Date(yb, mb - 1, db).getTime();
          return tb - ta;
        });
        setEntries(mapped);
      } catch {
        setEntries([]);
      } finally {
        if (!opts?.quiet) setLoading(false);
      }
    },
    [user.employeeId]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load({ quiet: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const currentDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const activeClock = entries.find((e) => e.date === todayStr && !isClockedOut(e.clockOut));

  const present = entries.filter((a) => a.status === 'P').length;
  const leave = entries.filter((a) => a.status === 'L').length;
  const wfh = entries.filter((a) => a.status === 'WFH').length;
  const halfDay = entries.filter((a) => a.status === 'HD').length;

  const handleClockAction = (action: 'in' | 'out') => {
    setDialogAction(action);
    setShowClockDialog(true);
  };

  const parseTime = (t: string): number => {
    const match = t.match(/(\d+):(\d+)(?::(\d+))?\s*(AM|PM)/i);
    if (!match) return 0;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const period = match[4].toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const confirmClock = async () => {
    if (!user.employeeId) {
      toast({ title: 'Cannot save attendance', description: 'Your account is not linked to an employee profile.', variant: 'destructive' });
      setShowClockDialog(false);
      return;
    }

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    const empId = String(user.employeeId);

    setSyncing(true);
    try {
      if (dialogAction === 'in') {
        const ok = await postAttendanceBulk([
          {
            employeeId: empId,
            date: todayStr,
            status: 'P',
            clockIn: timeStr,
            clockOut: '',
          },
        ]);
        if (!ok) {
          toast({ title: 'Clock-in failed', description: 'Could not save to the server.', variant: 'destructive' });
          return;
        }
        if (settings.ipRestrictionEnabled) {
          toast({ title: 'Clocked in', description: `Recorded at ${timeStr} (IP restriction is on in settings).` });
        } else {
          toast({ title: 'Clocked in', description: `Recorded at ${timeStr}.` });
        }
      } else {
        const open = entries.find((e) => e.date === todayStr && !isClockedOut(e.clockOut));
        if (!open || open.clockIn === '—') {
          toast({ title: 'Nothing to clock out', description: 'No open clock-in found for today.', variant: 'destructive' });
          return;
        }
        const inParts = parseTime(open.clockIn);
        const outParts = parseTime(timeStr);
        const totalMinutes = outParts - inParts;
        const hours = Math.round((totalMinutes / 60) * 10) / 10;
        const status = hours < settings.halfDayThresholdHours ? 'HD' : 'P';
        const ok = await postAttendanceBulk([
          {
            employeeId: empId,
            date: todayStr,
            status,
            clockIn: open.clockIn,
            clockOut: timeStr,
            totalHours: hours > 0 ? hours : 0,
          },
        ]);
        if (!ok) {
          toast({ title: 'Clock-out failed', description: 'Could not save to the server.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Clocked out', description: `Recorded at ${timeStr}` });
      }
      await load({ quiet: true });
    } finally {
      setSyncing(false);
      setShowClockDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="My Attendance" description="Your personal attendance & clock-in/out" />

      {!user.employeeId && (
        <Alert variant="destructive" className="mb-6 rounded-xl">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Profile not linked</AlertTitle>
          <AlertDescription>Your login is not linked to an employee record. Ask HR to fix your account before you can save attendance.</AlertDescription>
        </Alert>
      )}

      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-bold">{currentTime}</p>
            <p className="text-sm text-muted-foreground">{currentDate}</p>
            {activeClock && (
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-success font-medium">Clocked in since {activeClock.clockIn}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {!activeClock ? (
              <Button
                onClick={() => handleClockAction('in')}
                disabled={syncing || !user.employeeId}
                className="gap-2 rounded-xl shadow-md shadow-success/20 bg-success hover:bg-success/90 text-success-foreground"
              >
                {syncing && dialogAction === 'in' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                Clock In
              </Button>
            ) : (
              <Button
                onClick={() => handleClockAction('out')}
                disabled={syncing}
                variant="outline"
                className="gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                {syncing && dialogAction === 'out' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                Clock Out
              </Button>
            )}
          </div>
        </div>
        {settings.ipRestrictionEnabled && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-info/10 border border-info/20">
            <Wifi className="w-4 h-4 text-info" />
            <span className="text-xs text-info font-medium">IP restriction is enabled — configure allowed IPs in Settings</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Present" value={present} icon={<CalendarCheck className="w-5 h-5" />} gradient="bg-gradient-to-br from-success to-info" />
        <StatCard title="Leave Days" value={leave} icon={<CalendarOff className="w-5 h-5" />} gradient="bg-gradient-to-br from-destructive to-warning" />
        <StatCard title="WFH Days" value={wfh} icon={<Laptop className="w-5 h-5" />} gradient="bg-gradient-to-br from-info to-primary" />
        <StatCard title="Half Days" value={halfDay} icon={<Clock className="w-5 h-5" />} gradient="bg-gradient-to-br from-warning to-accent" />
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead>Date</TableHead>
              <TableHead>Clock In</TableHead>
              <TableHead>Clock Out</TableHead>
              <TableHead>Hours</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                  No attendance records
                </TableCell>
              </TableRow>
            ) : (
              entries.map((a, i) => (
                <TableRow
                  key={`${a.date}-${a.clockIn}-${i}`}
                  className={`border-border/30 ${a.date === todayStr && !isClockedOut(a.clockOut) ? 'bg-success/5' : ''}`}
                >
                  <TableCell className="text-sm font-mono">{a.date}</TableCell>
                  <TableCell className="text-sm font-mono text-success">{a.clockIn}</TableCell>
                  <TableCell className="text-sm font-mono">
                    {isClockedOut(a.clockOut) ? (
                      <span className="text-destructive">{a.clockOut}</span>
                    ) : (
                      <span className="text-warning animate-pulse font-medium">— Active</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm font-mono">{a.totalHours != null ? `${a.totalHours}h` : '—'}</TableCell>
                  <TableCell>
                    <StatusBadge status={a.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showClockDialog} onOpenChange={setShowClockDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{dialogAction === 'in' ? '🟢 Confirm Clock In' : '🔴 Confirm Clock Out'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Current Time</p>
                <p className="text-sm font-semibold">{currentTime}</p>
              </div>
            </div>
            {settings.ipRestrictionEnabled && dialogAction === 'in' && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-info/10 border border-info/20">
                <MapPin className="w-4 h-4 text-info" />
                <div>
                  <p className="text-xs text-info">IP Address Check</p>
                  <p className="text-sm font-semibold text-info">Demo verify ✓</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClockDialog(false)} className="rounded-xl" disabled={syncing}>
              Cancel
            </Button>
            <Button onClick={() => void confirmClock()} className="rounded-xl" disabled={syncing}>
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : dialogAction === 'in' ? 'Clock In' : 'Clock Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
