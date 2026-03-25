import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function MyProfilePage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user.employeeId) {
      navigate(`/employees/${user.employeeId}`, { replace: true });
    }
  }, [isLoading, isAuthenticated, user.employeeId, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading profile...
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!user.employeeId) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <h2 className="text-xl font-semibold">Profile not linked</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Your account is not linked to an employee profile yet. Please contact HR.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
      <Loader2 className="w-5 h-5 animate-spin" /> Redirecting to your profile...
    </div>
  );
}

