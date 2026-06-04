import type { MaintenanceRecord } from './maintenance-types';

const GS_URL = import.meta.env.VITE_GAS_MAINTENANCE_URL || '';

export function getGsUrl(): string {
  return GS_URL;
}

export function isMaintenanceConnected(): boolean {
  return GS_URL.length > 0;
}

async function gsGet(action: string): Promise<any> {
  const url = getGsUrl();
  if (!url) throw new Error('GAS Maintenance URL not configured');
  const fullUrl = `${url}?action=${encodeURIComponent(action)}`;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function gsPost(action: string, body: Record<string, unknown>): Promise<any> {
  const url = getGsUrl();
  if (!url) throw new Error('GAS Maintenance URL not configured');
  const fullUrl = `${url}?action=${encodeURIComponent(action)}`;
  const res = await fetch(fullUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface GsFetchRecordsResponse {
  success: boolean;
  data: MaintenanceRecord[];
  error?: string;
}

export async function fetchRecords(
  alat?: string,
  bulan?: string,
): Promise<MaintenanceRecord[]> {
  let action = 'getRecords';
  if (alat) action += `&alat=${encodeURIComponent(alat)}`;
  if (bulan) action += `&bulan=${encodeURIComponent(bulan)}`;

  const data: GsFetchRecordsResponse = await gsGet(action);
  if (!data.success) throw new Error(data.error || 'Gagal mengambil data');
  return data.data || [];
}

export interface GsSaveResponse {
  success: boolean;
  id?: string;
  error?: string;
}

export async function saveRecord(record: MaintenanceRecord): Promise<string> {
  const data: GsSaveResponse = await gsPost('saveRecord', {
    id: record.id,
    alat: record.alat,
    tipe: record.tipe,
    tanggal: record.tanggal,
    aktivitas: record.aktivitas,
    catatan: record.catatan,
    catatan_umum: record.catatan_umum,
    petugas: record.petugas,
  });

  if (!data.success) throw new Error(data.error || 'Gagal menyimpan data');
  return data.id || record.id;
}

export async function deleteRecord(id: string): Promise<void> {
  const data = await gsPost('deleteRecord', { id });
  if (!data.success) throw new Error(data.error || 'Gagal menghapus data');
}
