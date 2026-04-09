import {
  AuthUser,
  LoginResponse,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordRequest,
  SESSION_DURATION,
  AUTH_STORAGE_KEY,
  AUTH_URL_KEY,
} from './auth-types';

// Get GAS URL with hybrid approach (localStorage override > environment variable > null)
function getAuthUrl(): string | null {
  // Priority: localStorage override > environment variable > null
  return localStorage.getItem(AUTH_URL_KEY) || 
         import.meta.env.VITE_GAS_AUTH_URL || 
         null;
}

// Store auth data in localStorage
export function storeAuth(user: AuthUser): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

// Get stored auth data
export function getStoredAuth(): AuthUser | null {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;
  
  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

// Clear auth data
export function clearAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

// Validate session (check if token is still valid based on time)
export function validateSession(): boolean {
  const auth = getStoredAuth();
  if (!auth) return false;
  
  const now = Date.now();
  const elapsed = now - auth.loginAt;
  
  return elapsed < SESSION_DURATION;
}

// Login
export async function login(username: string, password: string): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) {
    return {
      success: false,
      message: 'URL GAS auth belum dikonfigurasi. Simpan di localStorage dengan key "gs-url-auth"',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'login',
        username,
        password,
      }),
    });

    const data = await response.json();
    
    if (data.success && data.user) {
      const authUser: AuthUser = {
        ...data.user,
        loginAt: Date.now(),
      };
      storeAuth(authUser);
      return { success: true, user: authUser };
    }
    
    return {
      success: false,
      message: data.message || 'Login gagal',
    };
  } catch (error) {
    console.error('Login error:', error);
    return {
      success: false,
      message: 'Gagal terhubung ke server',
    };
  }
}

// Logout
export async function logout(token: string): Promise<void> {
  const url = getAuthUrl();
  if (!url) {
    clearAuth();
    return;
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'logout',
        token,
      }),
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    clearAuth();
  }
}

// Validate token with server
export async function validateToken(token: string): Promise<AuthUser | null> {
  const url = getAuthUrl();
  if (!url) return null;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'validateToken',
        token,
      }),
    });

    const data = await response.json();
    
    if (data.success && data.user) {
      return data.user;
    }
    
    return null;
  } catch (error) {
    console.error('Validate token error:', error);
    return null;
  }
}

// Get all users (admin only)
export async function getUsers(token: string): Promise<User[]> {
  const url = getAuthUrl();
  if (!url) return [];

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'getUsers',
        token,
      }),
    });

    const data = await response.json();
    
    if (data.success && data.users) {
      return data.users;
    }
    
    return [];
  } catch (error) {
    console.error('Get users error:', error);
    return [];
  }
}

// Create user (admin only)
export async function createUser(token: string, userData: CreateUserRequest): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) {
    return {
      success: false,
      message: 'URL GAS auth belum dikonfigurasi',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'createUser',
        token,
        ...userData,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Create user error:', error);
    return {
      success: false,
      message: 'Gagal membuat user',
    };
  }
}

// Update user (admin only)
export async function updateUser(token: string, userData: UpdateUserRequest): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) {
    return {
      success: false,
      message: 'URL GAS auth belum dikonfigurasi',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateUser',
        token,
        ...userData,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Update user error:', error);
    return {
      success: false,
      message: 'Gagal mengupdate user',
    };
  }
}

// Reset password (admin only)
export async function resetPassword(token: string, resetData: ResetPasswordRequest): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) {
    return {
      success: false,
      message: 'URL GAS auth belum dikonfigurasi',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'resetPassword',
        token,
        ...resetData,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Reset password error:', error);
    return {
      success: false,
      message: 'Gagal reset password',
    };
  }
}

// Delete user (admin only)
export async function deleteUser(token: string, username: string): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) {
    return {
      success: false,
      message: 'URL GAS auth belum dikonfigurasi',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'deleteUser',
        token,
        username,
      }),
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Delete user error:', error);
    return {
      success: false,
      message: 'Gagal menghapus user',
    };
  }
}
