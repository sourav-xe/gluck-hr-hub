import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl, saveStoredAuth } from '@/lib/api';
import { Eye, EyeOff, LogIn, Building2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({ title: 'Please enter email and password', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        token?: string;
        user?: {
          id: string;
          name: string;
          email: string;
          role: string;
          employeeId?: string;
          onboardingComplete?: boolean | null;
          needsOnboarding?: boolean;
        };
      } = {};
      try {
        if (raw) data = JSON.parse(raw) as typeof data;
      } catch {
        /* proxy/HTML error page */
      }
      setLoading(false);
      if (!res.ok) {
        const apiMsg = data.error;
        const proxyDown =
          !apiMsg &&
          (res.status === 500 || res.status === 502 || res.status === 503 || res.status === 504);
        toast({
          title: proxyDown ? 'API not running' : 'Login failed',
          description:
            apiMsg ||
            (proxyDown
              ? 'Nothing is listening on port 3001. Usually the [api] process exited because MongoDB failed to connect. In Atlas → Network Access, add your IP (or 0.0.0.0/0 for dev), then restart npm run dev:all and watch for [HR API] MongoDB connected.'
              : res.statusText),
          variant: 'destructive',
        });
        return;
      }
      const token = data.token;
      const user = data.user;
      if (!token || !user) {
        toast({ title: 'Invalid server response', variant: 'destructive' });
        return;
      }
      saveStoredAuth({ token, user });
      const role = String(user.role || '').toLowerCase();
      const selfServiceRole = role === 'employee' || role === 'freelancer_intern' || role === 'reporting_manager';
      const shouldCompleteProfile = Boolean(user.needsOnboarding) || (selfServiceRole && user.onboardingComplete !== true);
      window.location.href = shouldCompleteProfile ? '/complete-profile' : '/';
    } catch {
      setLoading(false);
      toast({
        title: 'Cannot reach API',
        description:
          'Start the backend on port 3001. Easiest: stop this tab, then run npm run dev:all (starts API + this site).',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-accent/80 items-center justify-center p-12">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full bg-white/5 blur-2xl" />

        <div className="relative z-10 text-center space-y-8 max-w-md">
          <div className="w-24 h-24 rounded-3xl bg-white/15 backdrop-blur-xl mx-auto flex items-center justify-center border border-white/20 shadow-2xl">
            <Building2 className="w-12 h-12 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Gluck Global</h1>
            <p className="text-white/70 mt-3 text-lg font-light">International Staffing & Training</p>
          </div>
          <div className="space-y-4 text-left">
            {['Complete HR Management System', 'Employee & Freelancer Tracking', 'Automated Payroll & Documents'].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-white/80">
                <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                <span className="text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
          <p className="text-white/40 text-xs pt-8">Peradeniya Road, Kandy, Sri Lanka</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[420px] space-y-8">
          <div className="lg:hidden text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center shadow-lg shadow-primary/20 mb-3">
              <Building2 className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Gluck Global</h1>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-1.5 text-sm">Sign in to your HR portal (MongoDB backend)</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gluckglobal.com"
                className="rounded-xl h-12 bg-secondary/50 border-border/50 focus:bg-background transition-colors"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-xl h-12 pr-11 bg-secondary/50 border-border/50 focus:bg-background transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl text-sm font-semibold shadow-lg shadow-primary/25 gap-2.5 mt-2"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            Run <code className="text-foreground">npm run dev:all</code> — if login fails, check the terminal:{' '}
            <code className="text-foreground">[api]</code> must show <strong>MongoDB connected</strong> (Atlas → Network Access → allow your IP).
            Seed users: <code className="text-foreground">npm run seed</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
