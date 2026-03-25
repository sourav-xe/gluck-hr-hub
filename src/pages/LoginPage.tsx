import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getApiBaseUrl, saveStoredAuth } from '@/lib/api';
import { Eye, EyeOff, LogIn, Zap, Shield, Users, BarChart3, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

const DEMO_USER = {
  token: 'demo-token-bypass',
  user: {
    id: 'demo-admin-001',
    name: 'Demo Admin',
    email: 'admin@demo.com',
    role: 'super_admin',
    employeeId: 'demo-emp-001',
    onboardingComplete: true,
    needsOnboarding: false,
  },
};

const features = [
  { icon: Users, label: 'Employee Management', desc: 'Full lifecycle tracking' },
  { icon: BarChart3, label: 'Analytics Dashboard', desc: 'Real-time insights' },
  { icon: FileText, label: 'Document Automation', desc: 'Smart generation' },
  { icon: Shield, label: 'Role-Based Access', desc: 'Secure by design' },
];

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
      let data: any = {};
      try { if (raw) data = JSON.parse(raw); } catch {}
      setLoading(false);
      if (!res.ok) {
        const apiMsg = data.error;
        const proxyDown = !apiMsg && [500, 502, 503, 504].includes(res.status);
        toast({
          title: proxyDown ? 'API not running' : 'Login failed',
          description: apiMsg || (proxyDown ? 'Backend is not reachable. Use Demo Login instead.' : res.statusText),
          variant: 'destructive',
        });
        return;
      }
      if (!data.token || !data.user) {
        toast({ title: 'Invalid server response', variant: 'destructive' });
        return;
      }
      saveStoredAuth({ token: data.token, user: data.user });
      const role = String(data.user.role || '').toLowerCase();
      const selfServiceRole = role === 'employee' || role === 'freelancer_intern' || role === 'reporting_manager';
      const shouldCompleteProfile = Boolean(data.user.needsOnboarding) || (selfServiceRole && data.user.onboardingComplete !== true);
      window.location.href = shouldCompleteProfile ? '/complete-profile' : '/';
    } catch {
      setLoading(false);
      toast({ title: 'Cannot reach API', description: 'Use Demo Login to explore without backend.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel — immersive brand */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden items-center justify-center">
        {/* Animated mesh background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70" />
        <div className="absolute inset-0">
          <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] rounded-full bg-accent/20 blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-20%] right-[-15%] w-[60%] h-[60%] rounded-full bg-info/15 blur-[100px]" />
          <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] rounded-full bg-white/5 blur-[60px]" />
        </div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 px-12 max-w-lg">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="space-y-10"
          >
            <div className="space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/15 mb-6">
                <span className="text-white font-extrabold text-lg">GG</span>
              </div>
              <h1 className="text-5xl font-extrabold text-white tracking-tight leading-[1.1]">
                Gluck Global
              </h1>
              <p className="text-white/50 text-lg font-light">
                International Staffing & Training
              </p>
            </div>

            <div className="space-y-3">
              {features.map((f, i) => (
                <motion.div
                  key={f.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1, duration: 0.5 }}
                  className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.06] border border-white/[0.08] backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <f.icon className="w-5 h-5 text-white/80" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.label}</p>
                    <p className="text-xs text-white/40">{f.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <p className="text-white/25 text-xs">Peradeniya Road, Kandy, Sri Lanka</p>
          </motion.div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-[400px] space-y-8"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary mx-auto flex items-center justify-center shadow-lg shadow-primary/25 mb-3">
              <span className="text-primary-foreground font-extrabold text-sm">GG</span>
            </div>
            <h1 className="text-lg font-bold">Gluck Global</h1>
          </div>

          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-2 text-sm">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Email address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gluckglobal.com"
                className="rounded-xl h-12 bg-muted/50 border-border/50 focus:bg-card transition-all focus:shadow-lg focus:shadow-primary/5"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="rounded-xl h-12 pr-11 bg-muted/50 border-border/50 focus:bg-card transition-all focus:shadow-lg focus:shadow-primary/5"
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
              className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 gap-2.5"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">or</span></div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 rounded-xl text-sm font-bold gap-2.5 border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all"
              onClick={() => {
                saveStoredAuth(DEMO_USER);
                window.location.href = '/';
              }}
            >
              <Zap className="w-4 h-4 text-primary" />
              Demo Login
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground/60">
            Demo mode works without backend · Full features require local server
          </p>
        </motion.div>
      </div>
    </div>
  );
}
