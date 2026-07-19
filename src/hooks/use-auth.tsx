import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AuthUser, UserRole } from '@/lib/auth-types';
import { 
  login as apiLogin, 
  logout as apiLogout, 
  validateToken as apiValidateToken,
  getStoredAuth, 
  storeAuth,
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

// DEV bypass: auto-login as admin in development mode
// Can be disabled by setting VITE_DISABLE_AUTH_BYPASS=true in .env.local
const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_DISABLE_AUTH_BYPASS !== 'true';
const DEV_USER: AuthUser = {
  id: 'dev-bypass-id',
  username: 'dev-admin',
  nama: 'Developer (Bypass)',
  role: 'admin',
  token: 'dev-bypass-token',
  loginAt: Date.now(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(DEV_BYPASS_AUTH ? DEV_USER : null);
  const [isLoading, setIsLoading] = useState(DEV_BYPASS_AUTH ? false : true);

  // Check session on mount — validate token with server
  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    const checkSession = async () => {
      const storedAuth = getStoredAuth();
      
      if (!storedAuth) {
        setIsLoading(false);
        return;
      }

      // Server validation: check token with Supabase
      try {
        const serverUser = await apiValidateToken(storedAuth.token);
        
        if (serverUser) {
          // Token valid — update user data from server
          storeAuth(serverUser);
          setUser(serverUser);
        } else {
          // Token invalid — clear session
          apiClearAuth();
          setUser(null);
        }
      } catch (error) {
        // Server unreachable — fallback to cached session
        console.warn('Server validation failed, using cached session:', error);
        setUser(storedAuth);
      }
      
      setIsLoading(false);
    };

    checkSession();
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
      'suhu': ['admin'],
      'qc': ['admin', 'petugas', 'viewer'],
      'input-qc': ['admin', 'petugas'],
      'admin-users': ['admin'],
      'b3': ['admin'],
      'b3-input': ['admin', 'petugas'],
      'maintenance': ['admin', 'petugas', 'viewer'],
      'maintenance-input': ['admin', 'petugas'],
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
