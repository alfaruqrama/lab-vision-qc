// Kunjungan Google Sheets API integration
import { type KunjunganData, normalizeMonthKeys } from './kunjungan-types';

const GS_URL = 'https://script.google.com/macros/s/AKfycbw3obd6r4nhhXJDNu-anTwnYeG8Bzy7DQR5oWf4kyqm-Fpgzxj1CJNNEEeI-8LPKf0saQ/exec';

export function getGsUrl(): string {
  return GS_URL;
}

export function isKunjunganConnected(): boolean {
  return GS_URL.length > 0;
}

async function gsGet(action: string): Promise<any> {
  const url = getGsUrl();
  if (!url) throw new Error('GS_URL not configured');
  const fullUrl = `${url}?action=${encodeURIComponent(action)}`;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

export async function fetchSummary(): Promise<KunjunganData & { lastUpdated: string; currentMonth: string }> {
  const data: GsSummaryResponse = await gsGet('getSummary');

  if (data.error) throw new Error(data.error);

  return {
    omzet: normalizeMonthKeys(data.allOmzet || {}),
    kunjungan: normalizeMonthKeys(data.allKunjungan || {}),
    mcu: normalizeMonthKeys(data.allMcu || {}),
    lastUpdated: data.lastUpdated,
    currentMonth: data.currentMonth,
  };
}

export async function fetchKumulatif(): Promise<any> {
  return gsGet('getKumulatif');
}
