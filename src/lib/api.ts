import type { LotConfig, QCRecord } from './types';

const APPS_SCRIPT_URL = '';

export function isConnected(): boolean {
  return APPS_SCRIPT_URL.length > 0;
}

async function get(action: string, params: Record<string, string> = {}): Promise<any> {
  if (!isConnected()) throw new Error('Demo mode');
  const url = new URL(APPS_SCRIPT_URL);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function post(action: string, data: any): Promise<any> {
  if (!isConnected()) throw new Error('Demo mode');
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, data }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchAllRecords(): Promise<QCRecord[]> {
  return get('getAll');
}

export async function fetchRecordsByMonth(month: string): Promise<QCRecord[]> {
  return get('getByMonth', { month });
}

export async function fetchConfig(): Promise<LotConfig> {
  return get('getKonfig');
}

export async function saveRecord(record: QCRecord): Promise<any> {
  return post('save', record);
}

export async function saveConfig(config: LotConfig): Promise<any> {
  return post('saveKonfig', config);
}

export async function readStruk(image: string, mediaType: string, alat: string): Promise<any> {
  return post('readStruk', { image, mediaType, alat });
}
