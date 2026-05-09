import type { LotConfig, QCRecord, InstrumentType, WestgardStatus } from './types';
import { validateQCRecord, validateLotConfig, safeJSONParse, LotConfigSchema } from './validation';
import { sanitizeQCRecord } from './sanitization';
import { NetworkError, ServerError, ValidationError, handleFetchError, handleAPIError } from './error-handler';
import { z } from 'zod';

const APPS_SCRIPT_URL = import.meta.env.VITE_GAS_QC_URL || '';

export function isConnected(): boolean {
  return APPS_SCRIPT_URL.length > 0;
}

// Mapping alat names between React types and Sheets format
const ALAT_TO_SHEETS: Record<InstrumentType, string> = {
  CA660: 'Sysmex CA-660',
  EASYLITE: 'Easylite',
  ONCALL1: 'On Call Sure 1',
  ONCALL2: 'On Call Sure 2',
};

const SHEETS_TO_ALAT: Record<string, InstrumentType> = {
  'Sysmex CA-660': 'CA660',
  'Easylite': 'EASYLITE',
  'On Call Sure 1': 'ONCALL1',
  'On Call Sure 2': 'ONCALL2',
  'On Call Sure': 'ONCALL1', // legacy fallback
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
  if (!isConnected()) {
    throw new NetworkError('Demo mode - GAS URL not configured');
  }
  
  try {
    const url = new URL(APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    
    const res = await fetch(url.toString());
    
    if (!res.ok) {
      handleAPIError(res);
    }
    
    const text = await res.text();
    
    // Safe JSON parse
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Invalid JSON response from GAS:', text.slice(0, 200));
      throw new ServerError('Invalid response from server');
    }
  } catch (error) {
    handleFetchError(error);
  }
}

// Use text/plain to bypass CORS preflight with Google Apps Script
async function post(action: string, payload: any): Promise<any> {
  if (!isConnected()) {
    throw new NetworkError('Demo mode - GAS URL not configured');
  }
  
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action, ...payload }),
    });
    
    if (!res.ok) {
      handleAPIError(res);
    }
    
    const text = await res.text();
    
    // Safe JSON parse with validation
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error('Invalid JSON response from GAS:', text.slice(0, 200));
      throw new ServerError('Invalid response from server');
    }
  } catch (error) {
    handleFetchError(error);
  }
}

function mapRecordFromSheets(raw: any): QCRecord {
  const alatKey = SHEETS_TO_ALAT[raw.alat] || 'CA660';
  const mappedStatus: Partial<Record<string, WestgardStatus>> = {};
  if (raw.status) {
    for (const [k, v] of Object.entries(raw.status)) {
      if (v) mappedStatus[k] = statusFromSheets(v as string);
    }
  }
  
  const record: QCRecord = {
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
  
  // Validate record structure
  const validation = validateQCRecord(record);
  if (!validation.valid) {
    console.warn('Invalid QC record from server:', validation.errors);
    // Return record anyway but log warning
  }
  
  return record;
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
    // Validate config structure
    const validation = safeJSONParse(JSON.stringify(json.data), LotConfigSchema);
    if (!validation.success) {
      console.warn('Invalid lot config from server:', validation.error);
      // Return data anyway but log warning
    }
    return json.data;
  }
  throw new ServerError('No config found');
}

export async function saveRecord(record: QCRecord): Promise<any> {
  // Sanitize input before validation
  const sanitized = sanitizeQCRecord(record);
  
  // Validate record
  const validation = validateQCRecord(sanitized);
  if (!validation.valid) {
    console.error('QC record validation failed:', validation.errors);
    throw new ValidationError('Invalid QC record data. Please check all fields.');
  }
  
  const sheetsData = mapRecordToSheets(sanitized);
  return post('save', { data: sheetsData });
}

export async function saveConfig(config: LotConfig): Promise<any> {
  // Validate lot config for each instrument
  const errors: string[] = [];
  
  // Validate CA660 configs
  for (const cfg of config.CA660) {
    const validation = validateLotConfig('CA660', cfg);
    if (!validation.valid && validation.errors) {
      errors.push(`CA660: ${validation.errors.errors[0]?.message}`);
    }
  }
  
  // Validate EASYLITE configs
  for (const cfg of config.EASYLITE) {
    const validation = validateLotConfig('EASYLITE', cfg);
    if (!validation.valid && validation.errors) {
      errors.push(`EASYLITE: ${validation.errors.errors[0]?.message}`);
    }
  }
  
  // Validate ONCALL1 configs
  for (const cfg of config.ONCALL1) {
    const validation = validateLotConfig('ONCALL1', cfg);
    if (!validation.valid && validation.errors) {
      errors.push(`ONCALL1: ${validation.errors.errors[0]?.message}`);
    }
  }
  
  // Validate ONCALL2 configs
  for (const cfg of config.ONCALL2) {
    const validation = validateLotConfig('ONCALL2', cfg);
    if (!validation.valid && validation.errors) {
      errors.push(`ONCALL2: ${validation.errors.errors[0]?.message}`);
    }
  }
  
  if (errors.length > 0) {
    console.error('Lot config validation failed:', errors);
    throw new ValidationError(`Invalid lot configuration: ${errors[0]}`);
  }
  
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
  GDA?: number | null;
  NORMAL?: { Na?: number | null; K?: number | null; Cl?: number | null };
  HIGH?: { Na?: number | null; K?: number | null; Cl?: number | null };
  CTRL0?: { GDA?: number | null };
  CTRL1?: { GDA?: number | null };
  CTRL2?: { GDA?: number | null };
  parseError?: boolean;
}

export async function readStruk(image: string, mediaType: string, alat: string): Promise<{
  status: string;
  data?: ReadStrukResult;
  raw?: string;
  message?: string;
}> {
  if (!isConnected()) {
    throw new NetworkError('Demo mode - GAS URL not configured');
  }
  
  try {
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
    
    if (!res.ok) {
      handleAPIError(res);
    }
    
    return res.json();
  } catch (error) {
    handleFetchError(error);
  }
}
