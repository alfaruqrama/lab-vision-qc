export type UserRole = 'admin' | 'petugas' | 'viewer';

export interface AuthUser {
  username: string;
  nama: string;
  role: UserRole;
  token: string;
  loginAt: number; // timestamp
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
export const AUTH_URL_KEY = 'gs-url-auth';
