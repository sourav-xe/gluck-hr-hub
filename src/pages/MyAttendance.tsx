import { useState } from 'react';
import { attendanceRecords, defaultAttendanceSettings } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import StatCard from '@/components/shared/StatCard';
import StatusBadge from '@/components/shared/StatusBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarCheck, CalendarOff, Laptop, Clock, LogIn, LogOut, MapPin, Wifi } from 'lucide-react';

export default function MyAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const myRecords = attendanceRecords.filter(a => a.employeeId === user.employeeId).slice(0, 30);
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);
  const [showClockDialog, setShowClockDialog] = useState(false);
  const [dialogAction, setDialogAction] = useState<'in' | 'out'>('in');

  const present = myRecords.filter(a => a.status === 'P').length;
  const leave = myRecords.filter(a => a.status === 'L').length;
  const wfh = myRecords.filter(a => a.status === 'WFH').length;
  const halfDay = myRecords.filter(a => a.status === 'HD').length;

  const currentTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const currentDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const handleClockAction = (action: 'in' | 'out') => {
    setDialogAction(action);
    setShowClockDialog(true);
  };

  const confirmClock = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (dialogAction === 'in') {
      if (defaultAttendanceSettings.ipRestrictionEnabled) {
        toast({ title: '📍 IP Verified', description: `Clock-in from approved location at ${timeStr}` });
      } else {
        toast({ title: '✅ Clocked In', description: `You clocked in at ${timeStr}` });
      }
      setClockedIn(true);
      setClockInTime(timeStr);
    } else {
      const hours = clockInTime ? '8.5' : '0';
      toast({ title: '✅ Clocked Out', description: `You clocked out at ${timeStr}. Total: ${hours} hours` });
      setClockedIn(false);
      setClockInTime(null);
    }
    setShowClockDialog(false);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="My Attendance" description="Your personal attendance & clock-in/out" />

      {/* Clock In/Out Card */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-2xl font-bold">{currentTime}</p>
            <p className="text-sm text-muted-foreground">{currentDate}</p>
            {clockedIn && clockInTime && (
              <div className="flex items-center gap-2 mt-2">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-success font-medium">Clocked in since {clockInTime}</span>
              </div>
            )}
          </div>
          <div className="flex gap-3">
            {!clockedIn ? (
              <Button onClick={() => handleClockAction('in')} className="gap-2 rounded-xl shadow-md shadow-success/20 bg-success hover:bg-success/90 text-success-foreground">
                <LogIn className="w-4 h-4" /> Clock In
              </Button>
            ) : (
              <Button onClick={() => handleClockAction('out')} variant="outline" className="gap-2 rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10">
                <LogOut className="w-4 h-4" /> Clock Out
              </Button>
            )}
          </div>
        </div>
        {defaultAttendanceSettings.ipRestrictionEnabled && (
          <div className="flex items-center gap-2 mt-4 p-3 rounded-xl bg-info/10 border border-info/20">
            <Wifi className="w-4 h-4 text-info" />
            <span className="text-xs text-info font-medium">IP restriction is enabled — you can only clock in from approved networks</span>
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
            {myRecords.map((a, i) => (
              <TableRow key={i} className="border-border/30">
                <TableCell className="text-sm font-mono">{a.date}</TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground">{a.clockIn || '—'}</TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground">{a.clockOut || '—'}</TableCell>
                <TableCell className="text-sm font-mono">{a.totalHours ? `${a.totalHours}h` : '—'}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Clock Confirmation Dialog */}
      <Dialog open={showClockDialog} onOpenChange={setShowClockDialog}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {dialogAction === 'in' ? '🟢 Confirm Clock In' : '🔴 Confirm Clock Out'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Current Time</p>
                <p className="text-sm font-semibold">{currentTime}</p>
              </div>
            </div>
            {defaultAttendanceSettings.ipRestrictionEnabled && dialogAction === 'in' && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-info/10 border border-info/20">
                <MapPin className="w-4 h-4 text-info" />
                <div>
                  <p className="text-xs text-info">IP Address Check</p>
                  <p className="text-sm font-semibold text-info">Verified ✓</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClockDialog(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={confirmClock} className="rounded-xl">
              {dialogAction === 'in' ? 'Clock In' : 'Clock Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
