export type UserRole = 'admin' | 'petugas' | 'viewer' | 'developer';

/**
 * Peran yang boleh mengubah/menghapus data operasional (QC, Transfusi, dsb).
 *
 * `viewer` hanya membaca; `admin`, `petugas`, dan `developer` boleh mengelola.
 * Dipakai terpusat agar aturan role tidak berbeda-beda antar modul.
 */
const MODIFY_ROLES: readonly UserRole[] = ['admin', 'petugas', 'developer'];

export function canModifyRecords(role: UserRole | undefined | null): boolean {
  return !!role && MODIFY_ROLES.includes(role);
}

export interface AuthUser {
  id: string;        // uuid from profiles table
  username: string;
  nama: string;
  role: UserRole;
  token: string;     // uuid from sessions table
  loginAt: number;   // timestamp
}

export interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  message?: string;
}

export interface User {
  username: string;
  nama: string;
  role: UserRole;
  isActive: boolean;
}

export interface CreateUserRequest {
  username: string;
  nama: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  username: string;
  nama?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface ResetPasswordRequest {
  username: string;
  newPassword: string;
}

export const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 jam dalam ms
export const AUTH_STORAGE_KEY = 'lab-portal-auth';

// Removed: AUTH_URL_KEY (no longer needed with Supabase)
