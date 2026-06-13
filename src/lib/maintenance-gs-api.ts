import type { MaintenanceRecord, UjiFungsiRecord, LaporanValidasi } from './maintenance-types';

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
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Maintenance Records ─────────────────────────────────────────────────

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

// ─── Uji Fungsi Records ──────────────────────────────────────────────────

export interface GsFetchUjiFungsiResponse {
  success: boolean;
  data: UjiFungsiRecord[];
  error?: string;
}

export async function fetchUjiFungsi(
  alat: string,
  bulan: string,
): Promise<UjiFungsiRecord[]> {
  const action = `getUjiFungsi&alat=${encodeURIComponent(alat)}&bulan=${encodeURIComponent(bulan)}`;
  const data: GsFetchUjiFungsiResponse = await gsGet(action);
  if (!data.success) throw new Error(data.error || 'Gagal mengambil data uji fungsi');
  return data.data || [];
}

export interface GsSaveUjiFungsiResponse {
  success: boolean;
  count: number;
  deleted: number;
  error?: string;
}

export async function saveUjiFungsiBulk(
  alat: string,
  bulan: string,
  data: { id: string; tanggal: string; fungsi: 'baik' | 'rusak'; petugas: string; keterangan: string }[],
): Promise<{ count: number; deleted: number }> {
  const res: GsSaveUjiFungsiResponse = await gsPost('saveUjiFungsi', {
    alat,
    bulan,
    data,
  });
  if (!res.success) throw new Error(res.error || 'Gagal menyimpan data uji fungsi');
  return { count: res.count, deleted: res.deleted };
}

export async function deleteUjiFungsi(id: string): Promise<void> {
  const data = await gsPost('deleteUjiFungsi', { id });
  if (!data.success) throw new Error(data.error || 'Gagal menghapus data uji fungsi');
}

// ─── Laporan Validasi ────────────────────────────────────────────────────

export interface GsFetchLaporanValidasiResponse {
  success: boolean;
  data: LaporanValidasi[];
  error?: string;
}

export async function fetchLaporanValidasi(
  alat: string,
  bulan: string,
  tipe?: string,
): Promise<LaporanValidasi[]> {
  let action = `getLaporanValidasi&alat=${encodeURIComponent(alat)}&bulan=${encodeURIComponent(bulan)}`;
  if (tipe) action += `&tipe=${encodeURIComponent(tipe)}`;
  const data: GsFetchLaporanValidasiResponse = await gsGet(action);
  if (!data.success) throw new Error(data.error || 'Gagal mengambil data validasi');
  return data.data || [];
}

export async function saveLaporanValidasi(
  validasi: { id: string; alat: string; tipe: string; bulan: string; pic_alat: string; ka_lab: string },
): Promise<string> {
  const res = await gsPost('saveLaporanValidasi', {
    id: validasi.id,
    alat: validasi.alat,
    tipe: validasi.tipe,
    bulan: validasi.bulan,
    pic_alat: validasi.pic_alat,
    ka_lab: validasi.ka_lab,
  });
  if (!res.success) throw new Error(res.error || 'Gagal menyimpan validasi');
  return res.id;
}
