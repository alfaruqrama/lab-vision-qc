import type { LotConfig, QCRecord, InstrumentType, WestgardStatus } from './types';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwPlZSmSuwVZFwjS_qEPWrWlTMqcEo9b4ehiVIts3c-oUMcbJ6d_v9yy4s7Uw0iuy912w/exec';

export function isConnected(): boolean {
  return APPS_SCRIPT_URL.length > 0;
}

// Mapping alat names between React types and Sheets format
const ALAT_TO_SHEETS: Record<InstrumentType, string> = {
  CA660: 'Sysmex CA-660',
  EASYLITE: 'Easylite',
  ONCALL: 'On Call Sure',
};

const SHEETS_TO_ALAT: Record<string, InstrumentType> = {
  'Sysmex CA-660': 'CA660',
  'Easylite': 'EASYLITE',
  'On Call Sure': 'ONCALL',
};

// Status mapping: Sheets uses 'ooc', React uses 'oos'
function statusFromSheets(s: string): WestgardStatus {
  if (s === 'ooc') return 'oos';
  if (s === 'warn' || s === 'warning') return 'warning';
  return 'ok';
}

function statusToSheets(s: WestgardStatus): string {
  if (s === 'oos') return 'ooc';
  if (s === 'warning') return 'warn';
  return 'ok';
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

// Use text/plain to bypass CORS preflight with Google Apps Script
async function post(action: string, payload: any): Promise<any> {
  if (!isConnected()) throw new Error('Demo mode');
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function mapRecordFromSheets(raw: any): QCRecord {
  const alatKey = SHEETS_TO_ALAT[raw.alat] || 'CA660';
  const mappedStatus: Partial<Record<string, WestgardStatus>> = {};
  if (raw.status) {
    for (const [k, v] of Object.entries(raw.status)) {
      if (v) mappedStatus[k] = statusFromSheets(v as string);
    }
  }
  return {
    id: raw.id || `qc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: raw.timestamp || '',
    tanggal: raw.tanggal || '',
    alat: alatKey,
    level: raw.level || 'Kontrol',
    lot: raw.lot || '',
    params: raw.params || {},
    status: mappedStatus as QCRecord['status'],
    analis: raw.analis || '',
    catatan: raw.catatan || '',
  };
}

function mapRecordToSheets(record: QCRecord): any {
  const mappedStatus: Record<string, string> = {};
  if (record.status) {
    for (const [k, v] of Object.entries(record.status)) {
      if (v) mappedStatus[k] = statusToSheets(v);
    }
  }
  return {
    timestamp: record.timestamp,
    tanggal: record.tanggal,
    alat: ALAT_TO_SHEETS[record.alat] || record.alat,
    level: record.level,
    lot: record.lot,
    params: record.params,
    status: mappedStatus,
    analis: record.analis,
    catatan: record.catatan,
  };
}

export async function fetchAllRecords(): Promise<QCRecord[]> {
  const json = await get('getAll');
  if (json.status === 'ok' && Array.isArray(json.data)) {
    return json.data.map(mapRecordFromSheets);
  }
  return [];
}

export async function fetchRecordsByMonth(month: string): Promise<QCRecord[]> {
  const json = await get('getByMonth', { month });
  if (json.status === 'ok' && Array.isArray(json.data)) {
    return json.data.map(mapRecordFromSheets);
  }
  return [];
}

export async function fetchConfig(): Promise<LotConfig> {
  const json = await get('getKonfig');
  if (json.status === 'ok' && json.data) {
    return json.data;
  }
  throw new Error('No config found');
}

export async function saveRecord(record: QCRecord): Promise<any> {
  const sheetsData = mapRecordToSheets(record);
  return post('save', { data: sheetsData });
}

export async function saveConfig(config: LotConfig): Promise<any> {
  return post('saveKonfig', { data: config });
}

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
  NORMAL?: { Na?: number | null; K?: number | null; Cl?: number | null };
  HIGH?: { Na?: number | null; K?: number | null; Cl?: number | null };
  parseError?: boolean;
}

export async function readStruk(image: string, mediaType: string, alat: string): Promise<{
  status: string;
  data?: ReadStrukResult;
  raw?: string;
  message?: string;
}> {
  if (!isConnected()) throw new Error('Demo mode');
  const res = await fetch(APPS_SCRIPT_URL, {
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
