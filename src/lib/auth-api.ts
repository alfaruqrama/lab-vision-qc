import bcrypt from 'bcryptjs';
import {
  AuthUser,
  LoginResponse,
  User,
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordRequest,
  SESSION_DURATION,
  AUTH_STORAGE_KEY,
} from './auth-types';
import { supabase, createSupabaseClient, isSupabaseConfigured } from './supabase';

// ─── Storage ─────────────────────────────────────────────────────────────────

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

export function isSessionTimeValid(): boolean {
  const auth = getStoredAuth();
  if (!auth) return false;
  return (Date.now() - auth.loginAt) < SESSION_DURATION;
}

// ─── Auth Actions ────────────────────────────────────────────────────────────

/**
 * Login: verify username + password, create session token.
 */
export async function login(username: string, password: string): Promise<LoginResponse> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase belum dikonfigurasi. Hubungi admin.' };
  }

  try {
    // Query user by username (case-insensitive via ilike)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, username, nama, role, password_hash, is_active')
      .ilike('username', username)
      .single();

    if (profileError || !profile) {
      return { success: false, message: 'Username atau password salah' };
    }

    if (!profile.is_active) {
      return { success: false, message: 'Akun tidak aktif. Hubungi admin.' };
    }

    // Verify password (case-insensitive)
    const passwordMatch = await bcrypt.compare(password.toLowerCase(), profile.password_hash);
    if (!passwordMatch) {
      return { success: false, message: 'Username atau password salah' };
    }

    // Create session token
    const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({ user_id: profile.id, expires_at: expiresAt })
      .select('token')
      .single();

    if (sessionError || !session) {
      return { success: false, message: 'Gagal membuat session' };
    }

    const authUser: AuthUser = {
      id: profile.id,
      username: profile.username,
      nama: profile.nama,
      role: profile.role,
      token: session.token,
      loginAt: Date.now(),
    };

    storeAuth(authUser);
    return { success: true, user: authUser };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, message: 'Gagal terhubung ke server' };
  }
}

/**
 * Logout: delete session token from database.
 */
export async function logout(token: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    clearAuth();
    return;
  }

  try {
    const client = createSupabaseClient(token);
    await client.from('sessions').delete().eq('token', token);
  } catch (error) {
    console.error('Logout error:', error);
  }
  clearAuth();
}

/**
 * Validate token: check if session exists and not expired.
 */
export async function validateToken(token: string): Promise<AuthUser | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const client = createSupabaseClient(token);
    const { data: session, error } = await client
      .from('sessions')
      .select(`
        token,
        expires_at,
        profiles:user_id (
          id,
          username,
          nama,
          role,
          is_active
        )
      `)
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !session || !session.profiles) {
      return null;
    }

    const profile = Array.isArray(session.profiles) ? session.profiles[0] : session.profiles;

    if (!profile.is_active) {
      return null;
    }

    return {
      id: profile.id,
      username: profile.username,
      nama: profile.nama,
      role: profile.role,
      token: session.token,
      loginAt: Date.now(), // Refresh loginAt on validation
    };
  } catch (error) {
    console.error('Validate token error:', error);
    return null;
  }
}

// ─── User Management (Admin) ─────────────────────────────────────────────────

/**
 * Get all users (admin only).
 */
export async function getUsers(token: string): Promise<User[]> {
  if (!isSupabaseConfigured()) return [];

  try {
    const client = createSupabaseClient(token);
    const { data, error } = await client
      .from('profiles')
      .select('username, nama, role, is_active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get users error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Get users error:', error);
    return [];
  }
}

/**
 * Create new user (admin only).
 */
export async function createUser(token: string, userData: CreateUserRequest): Promise<LoginResponse> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase belum dikonfigurasi' };
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, 10);

    const client = createSupabaseClient(token);
    const { error } = await client.from('profiles').insert({
      username: userData.username,
      nama: userData.nama,
      role: userData.role,
      password_hash: passwordHash,
      is_active: true,
    });

    if (error) {
      if (error.code === '23505') {
        return { success: false, message: 'Username sudah digunakan' };
      }
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Create user error:', error);
    return { success: false, message: 'Gagal membuat user' };
  }
}

/**
 * Update user (admin only).
 */
export async function updateUser(token: string, userData: UpdateUserRequest): Promise<LoginResponse> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase belum dikonfigurasi' };
  }

  try {
    const client = createSupabaseClient(token);
    const updateData: Record<string, unknown> = {};

    if (userData.nama !== undefined) updateData.nama = userData.nama;
    if (userData.role !== undefined) updateData.role = userData.role;
    if (userData.isActive !== undefined) updateData.is_active = userData.isActive;

    const { error } = await client
      .from('profiles')
      .update(updateData)
      .eq('username', userData.username);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Update user error:', error);
    return { success: false, message: 'Gagal mengupdate user' };
  }
}

/**
 * Reset password (admin only).
 */
export async function resetPassword(token: string, resetData: ResetPasswordRequest): Promise<LoginResponse> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase belum dikonfigurasi' };
  }

  try {
    // Hash new password
    const passwordHash = await bcrypt.hash(resetData.newPassword, 10);

    const client = createSupabaseClient(token);
    const { error } = await client
      .from('profiles')
      .update({ password_hash: passwordHash })
      .eq('username', resetData.username);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Reset password error:', error);
    return { success: false, message: 'Gagal reset password' };
  }
}

/**
 * Delete user (admin only).
 */
export async function deleteUser(token: string, username: string): Promise<LoginResponse> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase belum dikonfigurasi' };
  }

  try {
    const client = createSupabaseClient(token);
    const { error } = await client
      .from('profiles')
      .delete()
      .eq('username', username);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Delete user error:', error);
    return { success: false, message: 'Gagal menghapus user' };
  }
}
