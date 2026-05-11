import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client factory with session token injection.
 * 
 * For authenticated requests, pass the session token from localStorage.
 * The token is sent via x-session-token header for RLS policy evaluation.
 */
export function createSupabaseClient(sessionToken?: string): SupabaseClient {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: sessionToken ? { 'x-session-token': sessionToken } : {},
    },
  });
}

/**
 * Unauthenticated Supabase client (for login only).
 * Do not use this for authenticated operations.
 */
export const supabase = createSupabaseClient();

/**
 * Check if Supabase is configured.
 */
export function isSupabaseConfigured(): boolean {
  return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}
