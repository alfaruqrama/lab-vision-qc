import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { UserRole } from '@/lib/auth-types';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!isLoading && isAuthenticated && allowedRoles && user) {
      if (!allowedRoles.includes(user.role)) {
        toast({
          title: 'Akses ditolak',
          description: 'Anda tidak memiliki izin untuk mengakses halaman ini',
          variant: 'destructive',
        });
      }
    }
  }, [isLoading, isAuthenticated, allowedRoles, user, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0F6E56]" />
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
