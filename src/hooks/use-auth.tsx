import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, UserRole } from '@/lib/auth-types';
import { 
  login as apiLogin, 
  logout as apiLogout, 
  validateToken as apiValidateToken,
  getStoredAuth, 
  storeAuth,
  isSessionTimeValid,
  clearAuth as apiClearAuth,
} from '@/lib/auth-api';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
  canAccess: (feature: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check session on mount — validasi ke server, bukan hanya localStorage
  useEffect(() => {
    const checkSession = async () => {
      const storedAuth = getStoredAuth();
      
      if (!storedAuth) {
        setIsLoading(false);
        return;
      }

      // Quick check: apakah waktu session masih valid di client
      if (!isSessionTimeValid()) {
        apiClearAuth();
        setUser(null);
        setIsLoading(false);
        return;
      }

      // Server validation: cek token ke GAS
      // Ini mencegah bypass via localStorage edit
      try {
        const serverUser = await apiValidateToken(storedAuth.token);
        
        if (serverUser) {
          // Token valid di server — update user data dari server (bukan localStorage)
          // Ini memastikan role yang dipakai adalah role dari server, bukan yang di-edit user
          const validatedUser: AuthUser = {
            username: serverUser.username,
            nama: serverUser.nama,
            role: serverUser.role,
            token: serverUser.token,
            loginAt: storedAuth.loginAt,
          };
          storeAuth(validatedUser);
          setUser(validatedUser);
        } else {
          // Token tidak valid di server — hapus session
          apiClearAuth();
          setUser(null);
        }
      } catch (error) {
        // Kalau server tidak bisa dihubungi, fallback ke localStorage
        // tapi tetap cek waktu session
        console.warn('Server validation failed, using cached session:', error);
        setUser(storedAuth);
      }
      
      setIsLoading(false);
    };

    checkSession();
  }, []);

  // Auto-check session setiap 60 detik
  // Cek waktu + validasi token ke server
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      if (!isSessionTimeValid()) {
        apiClearAuth();
        setUser(null);
        window.location.href = '/login';
        return;
      }

      // Periodic server validation — cek apakah token masih valid
      try {
        const serverUser = await apiValidateToken(user.token);
        if (!serverUser) {
          // Token di-revoke di server (misal admin hapus user, atau logout dari device lain)
          apiClearAuth();
          setUser(null);
          window.location.href = '/login';
        }
      } catch {
        // Network error — skip, coba lagi di interval berikutnya
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await apiLogin(username, password);
    
    if (result.success && result.user) {
      setUser(result.user);
      return { success: true };
    }
    
    return { 
      success: false, 
      message: result.message || 'Login gagal' 
    };
  }, []);

  const logout = useCallback(() => {
    if (user) {
      apiLogout(user.token);
    }
    setUser(null);
  }, [user]);

  const hasRole = useCallback((role: UserRole): boolean => {
    return user?.role === role;
  }, [user]);

  const canAccess = useCallback((feature: string): boolean => {
    if (!user) return false;

    const accessMap: Record<string, UserRole[]> = {
      'dashboard': ['admin', 'petugas', 'viewer'],
      'input-harian': ['admin', 'petugas'],
      'suhu': ['admin', 'petugas', 'viewer'],
      'qc': ['admin', 'petugas', 'viewer'],
      'input-qc': ['admin', 'petugas'],
      'admin-users': ['admin'],
    };

    const allowedRoles = accessMap[feature];
    if (!allowedRoles) return false;

    return allowedRoles.includes(user.role);
  }, [user]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    hasRole,
    canAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
