import { isSupabaseConfigured } from './supabase';

/**
 * Check if the app is connected to a backend.
 * After Supabase migration, this checks Supabase config instead of GAS URL.
 */
export function isConnected(): boolean {
  return isSupabaseConfigured();
}

// ─── AI Extraction (still via Google Apps Script) ───────────────────────────

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

/**
 * Read QC struk via AI (Google Apps Script + Gemini Vision).
 * This is the only GAS endpoint still in use after Supabase migration.
 */
export async function readStruk(image: string, mediaType: string, alat: string): Promise<{
  status: string;
  data?: ReadStrukResult;
  raw?: string;
  message?: string;
}> {
  const gasAiUrl = import.meta.env.VITE_GAS_AI_URL;
  
  if (!gasAiUrl) {
    throw new Error('VITE_GAS_AI_URL not configured');
  }

  const res = await fetch(gasAiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      action: 'readStruk',
      image,
      mediaType,
      alat,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
