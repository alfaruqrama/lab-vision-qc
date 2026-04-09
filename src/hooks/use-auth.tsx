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

  // TEMPORARY: bypass login — revert saat GAS backend fixed
  // Auto-login sebagai admin mock supaya portal bisa diakses tanpa GAS.
  // Original session check & periodic server validation di-disable sementara.
  useEffect(() => {
    const bypassUser: AuthUser = {
      username: 'bypass',
      nama: 'Bypass User',
      role: 'admin',
      token: 'bypass-token',
      loginAt: Date.now(),
    };
    setUser(bypassUser);
    setIsLoading(false);
  }, []);

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
