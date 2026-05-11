import { isSupabaseConfigured, createSupabaseClient } from './supabase';
import { AUTH_STORAGE_KEY, type AuthUser } from './auth-types';

/**
 * Check if the app is connected to a backend.
 * After Supabase migration, this checks Supabase config instead of GAS URL.
 */
export function isConnected(): boolean {
  return isSupabaseConfigured();
}

// ─── AI Extraction (Supabase Edge Function + Gemini 2.5 Flash Lite) ─────────

export interface ReadStrukResult {
  alat?: string;
  tanggal?: string;
  lot?: string;
  level?: string;
  PT?: number | null;
  APTT?: number | null;
  INR?: number | null;
  Na?: number | null;
  K?: number | null;
  Cl?: number | null;
  GDA?: number | null;
  NORMAL?: { Na?: number | null; K?: number | null; Cl?: number | null };
  HIGH?: { Na?: number | null; K?: number | null; Cl?: number | null };
  CTRL0?: { GDA?: number | null };
  CTRL1?: { GDA?: number | null };
  CTRL2?: { GDA?: number | null };
  parseError?: boolean;
}

interface AIExtractionResponse {
  success: boolean;
  data?: {
    tanggal: string;
    alat: string;
    level: string;
    lot: string;
    params: Record<string, number>;
  };
  error?: string;
  remaining_scans?: number;
}

/**
 * Read QC struk via AI (Supabase Edge Function + Gemini 2.5 Flash Lite).
 * Requires authentication. Rate limited to 20 scans/user/day.
 */
export async function readStruk(image: string, mediaType: string, alat: string): Promise<{
  status: string;
  data?: ReadStrukResult;
  raw?: string;
  message?: string;
}> {
  // Get auth user from localStorage
  const authJson = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!authJson) {
    throw new Error('Not authenticated');
  }

  let authUser: AuthUser;
  try {
    authUser = JSON.parse(authJson);
  } catch {
    throw new Error('Not authenticated');
  }

  const sessionToken = authUser.token;
  
  console.log('[AI] Session token:', sessionToken ? `${sessionToken.substring(0, 8)}...` : 'null');
  
  if (!sessionToken) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL not configured');
  }

  const functionUrl = `${supabaseUrl}/functions/v1/extract-qc`;

  // Remove data URL prefix if present
  const imageBase64 = image.replace(/^data:image\/\w+;base64,/, '');

  console.log('[AI] Calling Edge Function:', functionUrl);
  console.log('[AI] Image size:', imageBase64.length, 'chars');

  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${sessionToken}`
    },
    body: JSON.stringify({ imageBase64 })
  });

  console.log('[AI] Response status:', res.status);

  const aiResponse: AIExtractionResponse = await res.json();
  
  console.log('[AI] Response:', aiResponse);

  if (!res.ok || !aiResponse.success) {
    const errorMsg = aiResponse.error || `HTTP ${res.status}`;
    console.error('[AI] Error:', errorMsg);
    return {
      status: 'error',
      message: errorMsg,
      raw: JSON.stringify(aiResponse)
    };
  }

  // Transform AI response to match existing ReadStrukResult format
  const data = aiResponse.data;
  if (!data) {
    return {
      status: 'error',
      message: 'No data in AI response'
    };
  }

  const result: ReadStrukResult = {
    alat: data.alat,
    tanggal: data.tanggal,
    lot: data.lot,
    level: data.level,
    ...data.params
  };

  return {
    status: 'success',
    data: result,
    raw: JSON.stringify(aiResponse)
  };
}

/**
 * Get remaining AI scans for current user today.
 * Returns 0 if not authenticated or error.
 */
export async function getRemainingAIScans(): Promise<number> {
  const authJson = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!authJson) return 0;

  let authUser: AuthUser;
  try {
    authUser = JSON.parse(authJson);
  } catch {
    return 0;
  }

  const sessionToken = authUser.token;
  if (!sessionToken) return 0;

  try {
    const supabase = createSupabaseClient(sessionToken);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .rpc('get_remaining_ai_scans', { p_user_id: user.id, p_limit: 20 });

    if (error) {
      console.error('Failed to get remaining scans:', error);
      return 0;
    }

    return data ?? 0;
  } catch (error) {
    console.error('Error getting remaining scans:', error);
    return 0;
  }
}
