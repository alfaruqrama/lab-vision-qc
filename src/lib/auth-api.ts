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
  return localStorage.getItem(AUTH_URL_KEY) || 
         import.meta.env.VITE_GAS_AUTH_URL || 
         null;
}

// Helper: POST ke GAS tanpa CORS preflight
// GAS tidak support OPTIONS request, jadi kita pakai text/plain
// agar browser tidak kirim preflight request
// Kirim request ke GAS via GET (query params) — paling reliable, no CORS issue
// Semua data dikirim sebagai query parameter `payload` (JSON string encoded)
async function postToGAS(url: string, payload: Record<string, unknown>): Promise<any> {
  const fullUrl = `${url}?payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const response = await fetch(fullUrl);

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('GAS response bukan JSON:', text.slice(0, 200));
    throw new Error('Response dari server tidak valid');
  }
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
    const data = await postToGAS(url, { action: 'login', username, password });
    
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
    await postToGAS(url, { action: 'logout', token });
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
    const data = await postToGAS(url, { action: 'validateToken', token });
    
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
    const data = await postToGAS(url, { action: 'getUsers', token });
    
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
    return { success: false, message: 'URL GAS auth belum dikonfigurasi' };
  }

  try {
    const data = await postToGAS(url, { action: 'createUser', token, ...userData });
    return data;
  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, message: 'Gagal membuat user' };
  }
}

// Update user (admin only)
export async function updateUser(token: string, userData: UpdateUserRequest): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) {
    return { success: false, message: 'URL GAS auth belum dikonfigurasi' };
  }

  try {
    const data = await postToGAS(url, { action: 'updateUser', token, ...userData });
    return data;
  } catch (error) {
    console.error('Update user error:', error);
    return { success: false, message: 'Gagal mengupdate user' };
  }
}

// Reset password (admin only)
export async function resetPassword(token: string, resetData: ResetPasswordRequest): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) {
    return { success: false, message: 'URL GAS auth belum dikonfigurasi' };
  }

  try {
    const data = await postToGAS(url, { action: 'resetPassword', token, ...resetData });
    return data;
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, message: 'Gagal reset password' };
  }
}

// Delete user (admin only)
export async function deleteUser(token: string, username: string): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) {
    return { success: false, message: 'URL GAS auth belum dikonfigurasi' };
  }

  try {
    const data = await postToGAS(url, { action: 'deleteUser', token, username });
    return data;
  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false, message: 'Gagal menghapus user' };
  }
}
