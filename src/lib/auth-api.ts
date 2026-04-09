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

// ─── Transport Layer ───
// POST text/plain — untuk sensitive actions (password, create user, dll)
// Tidak memicu CORS preflight karena Content-Type text/plain = "simple request"
async function gasPost(url: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('GAS response bukan JSON:', text.slice(0, 200));
    throw new Error('Response dari server tidak valid');
  }
}

// GET — untuk read-only actions (validate token, get users)
// Tidak ada data sensitif di query string
async function gasGet(url: string, payload: Record<string, unknown>): Promise<any> {
  const fullUrl = `${url}?payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const res = await fetch(fullUrl);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error('GAS response bukan JSON:', text.slice(0, 200));
    throw new Error('Response dari server tidak valid');
  }
}

// ─── Storage ───

export function storeAuth(user: AuthUser): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
}

export function getStoredAuth(): AuthUser | null {
  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    return null;
  }
}

export function clearAuth(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

// Cek waktu session di client (quick check sebelum server validation)
export function isSessionTimeValid(): boolean {
  const auth = getStoredAuth();
  if (!auth) return false;
  return (Date.now() - auth.loginAt) < SESSION_DURATION;
}

// ─── Auth Actions ───

// Login — POST (password di body, tidak di URL)
export async function login(username: string, password: string): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) {
    return { success: false, message: 'URL GAS auth belum dikonfigurasi. Simpan di localStorage dengan key "gs-url-auth"' };
  }

  try {
    const data = await gasPost(url, { action: 'login', username, password });
    
    if (data.success && data.user) {
      const authUser: AuthUser = { ...data.user, loginAt: Date.now() };
      storeAuth(authUser);
      return { success: true, user: authUser };
    }
    
    return { success: false, message: data.message || 'Login gagal' };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Gagal terhubung ke server' };
  }
}

// Logout — POST (menghapus token di server)
export async function logout(token: string): Promise<void> {
  const url = getAuthUrl();
  if (url) {
    try {
      await gasPost(url, { action: 'logout', token });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  clearAuth();
}

// Validate token — GET (token bukan rahasia, hanya session ID)
// Dipanggil saat app mount untuk verifikasi ke server
export async function validateToken(token: string): Promise<AuthUser | null> {
  const url = getAuthUrl();
  if (!url) return null;

  try {
    const data = await gasGet(url, { action: 'validateToken', token });
    if (data.success && data.user) {
      return data.user;
    }
    return null;
  } catch (error) {
    console.error('Validate token error:', error);
    return null;
  }
}

// ─── User Management (Admin) ───

// Get users — GET (read-only, no sensitive data)
export async function getUsers(token: string): Promise<User[]> {
  const url = getAuthUrl();
  if (!url) return [];

  try {
    const data = await gasGet(url, { action: 'getUsers', token });
    return data.success && data.users ? data.users : [];
  } catch (error) {
    console.error('Get users error:', error);
    return [];
  }
}

// Create user — POST (password di body)
export async function createUser(token: string, userData: CreateUserRequest): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) return { success: false, message: 'URL GAS auth belum dikonfigurasi' };

  try {
    return await gasPost(url, { action: 'createUser', token, ...userData });
  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, message: 'Gagal membuat user' };
  }
}

// Update user — POST (mengubah data)
export async function updateUser(token: string, userData: UpdateUserRequest): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) return { success: false, message: 'URL GAS auth belum dikonfigurasi' };

  try {
    return await gasPost(url, { action: 'updateUser', token, ...userData });
  } catch (error) {
    console.error('Update user error:', error);
    return { success: false, message: 'Gagal mengupdate user' };
  }
}

// Reset password — POST (password baru di body)
export async function resetPassword(token: string, resetData: ResetPasswordRequest): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) return { success: false, message: 'URL GAS auth belum dikonfigurasi' };

  try {
    return await gasPost(url, { action: 'resetPassword', token, ...resetData });
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, message: 'Gagal reset password' };
  }
}

// Delete user — POST (mengubah data)
export async function deleteUser(token: string, username: string): Promise<LoginResponse> {
  const url = getAuthUrl();
  if (!url) return { success: false, message: 'URL GAS auth belum dikonfigurasi' };

  try {
    return await gasPost(url, { action: 'deleteUser', token, username });
  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false, message: 'Gagal menghapus user' };
  }
}
