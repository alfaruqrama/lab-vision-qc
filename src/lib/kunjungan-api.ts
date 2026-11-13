// Kunjungan Google Sheets API integration
import { type KunjunganData, normalizeMonthKeys } from './kunjungan-types';

// Dibaca saat dipanggil, bukan saat module load: Vite menanam nilainya di build,
// sedangkan test perlu bisa mengganti env per-kasus.
export function getGsUrl(): string {
  return import.meta.env.VITE_GAS_KUNJUNGAN_URL || '';
}

export function isKunjunganConnected(): boolean {
  return getGsUrl().length > 0;
}

async function gsGet(action: string): Promise<any> {
  const url = getGsUrl();
  if (!url) throw new Error('GS_URL not configured');
  const fullUrl = `${url}?action=${encodeURIComponent(action)}`;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

export async function ping(): Promise<boolean> {
  try {
    const data = await gsGet('ping');
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

export interface GsSummaryResponse {
  lastUpdated: string;
  currentMonth: string;
  allOmzet: Record<string, any[]>;
  allKunjungan: Record<string, any[]>;
  allMcu: Record<string, any[]>;
  error?: string;
}

function assertIsSummary(data: any): asserts data is GsSummaryResponse {
  const url = getGsUrl();
  if (data?.error) throw new Error(`${data.error} (${url})`);

  // Skrip GAS lain (mis. Input Harian) membalas {status:'ok',service:'...'} untuk action
  // yang tidak dikenal, bukan {error}. Cek keberadaan field kontrak, bukan sekadar typeof,
  // supaya {} tidak bisa lolos sebagai "dashboard tanpa data".
  const misconfigured = !data || typeof data !== 'object'
    || !('allOmzet' in data) || !('allKunjungan' in data);
  if (misconfigured) {
    const service = data?.service ? ` — endpoint ini melayani "${data.service}"` : '';
    throw new Error(
      `Respons bukan dari skrip Dashboard GAS${service}. Cek VITE_GAS_KUNJUNGAN_URL: ${url}`,
    );
  }

  for (const key of ['allOmzet', 'allKunjungan', 'allMcu'] as const) {
    const v = (data as any)[key];
    if (v !== undefined && (typeof v !== 'object' || v === null)) {
      throw new Error(`Field ${key} bukan object (${url})`);
    }
  }
}

export async function fetchSummary(): Promise<KunjunganData & { lastUpdated: string; currentMonth: string }> {
  const data: any = await gsGet('getSummary');
  assertIsSummary(data);

  // Spread, bukan literal ber-field: data mentah dari GAS bisa memuat field ekstra
  // (mis. row tanpa key `inhealth` seperti data embedded lama) yang bikin tsc protes.
  return {
    ...data,
    omzet: normalizeMonthKeys(data.allOmzet || {}),
    kunjungan: normalizeMonthKeys(data.allKunjungan || {}),
    mcu: normalizeMonthKeys(data.allMcu || {}),
  };
}

export async function fetchKumulatif(): Promise<any> {
  return gsGet('getKumulatif');
}
