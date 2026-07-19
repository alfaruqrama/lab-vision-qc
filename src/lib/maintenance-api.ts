import { getStoredAuth } from './auth-api';
import { createSupabaseClient } from './supabase';
import { isConnected } from './api';
import type { MaintenanceRecord, UjiFungsiRecord, LaporanValidasi } from './maintenance-types';

/**
 * Maintenance API — Supabase backend with localStorage fallback.
 * Replaces the Google Sheets (GAS) API layer.
 */

// ─── Maintenance Records ─────────────────────────────────────────────────

export async function fetchRecords(
  alat?: string,
  bulan?: string,
): Promise<MaintenanceRecord[]> {
  if (!isConnected()) throw new Error('Not connected');

  const auth = getStoredAuth();
  if (!auth) return [];

  const client = createSupabaseClient(auth.token);

  let query = client
    .from('maintenance_records')
    .select('*')
    .order('tanggal', { ascending: false });

  if (alat) query = query.eq('alat', alat);
  if (bulan) {
    const start = `${bulan}-01`;
    const [y, m] = bulan.split('-').map(Number);
    const end = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    query = query.gte('tanggal', start).lt('tanggal', end);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Fetch maintenance records error:', error);
    return [];
  }

  return (data || []) as MaintenanceRecord[];
}

export async function saveRecord(record: MaintenanceRecord): Promise<string> {
  if (!isConnected()) throw new Error('Not connected');

  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');

  const client = createSupabaseClient(auth.token);

  const { error } = await client.from('maintenance_records').upsert({
    id: record.id,
    alat: record.alat,
    tipe: record.tipe,
    tanggal: record.tanggal,
    aktivitas: record.aktivitas,
    catatan: record.catatan || {},
    catatan_umum: record.catatan_umum || '',
    petugas: record.petugas || '',
    created_by: auth.id,
  });

  if (error) {
    console.error('Save maintenance record error:', error);
    throw new Error(error.message);
  }

  return record.id;
}

export async function deleteRecord(id: string): Promise<void> {
  if (!isConnected()) throw new Error('Not connected');

  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');

  const client = createSupabaseClient(auth.token);

  const { error } = await client.from('maintenance_records').delete().eq('id', id);

  if (error) {
    console.error('Delete maintenance record error:', error);
    throw new Error(error.message);
  }
}

// ─── Uji Fungsi Records ──────────────────────────────────────────────────

export async function fetchUjiFungsi(
  alat: string,
  bulan: string,
): Promise<UjiFungsiRecord[]> {
  if (!isConnected()) throw new Error('Not connected');

  const auth = getStoredAuth();
  if (!auth) return [];

  const client = createSupabaseClient(auth.token);

  const start = `${bulan}-01`;
  const [y, m] = bulan.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${bulan}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await client
    .from('uji_fungsi_records')
    .select('*')
    .eq('alat', alat)
    .gte('tanggal', start)
    .lte('tanggal', end)
    .order('tanggal', { ascending: true });

  if (error) {
    console.error('Fetch uji fungsi error:', error);
    return [];
  }

  return (data || []) as UjiFungsiRecord[];
}

export async function saveUjiFungsiBulk(
  alat: string,
  bulan: string,
  data: { id: string; tanggal: string; fungsi: 'baik' | 'rusak'; petugas: string; keterangan: string }[],
): Promise<{ count: number; deleted: number }> {
  if (!isConnected()) throw new Error('Not connected');

  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');

  const client = createSupabaseClient(auth.token);

  const start = `${bulan}-01`;
  const [y, m] = bulan.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${bulan}-${String(lastDay).padStart(2, '0')}`;

  // Delete existing records for this alat + bulan
  const { error: deleteError, count: deletedCount } = await client
    .from('uji_fungsi_records')
    .delete({ count: 'exact' })
    .eq('alat', alat)
    .gte('tanggal', start)
    .lte('tanggal', end);

  if (deleteError) {
    console.error('Delete uji fungsi (bulk) error:', deleteError);
    throw new Error(deleteError.message);
  }

  // Insert new records
  const rows = data.map((d) => ({
    id: d.id,
    alat,
    tanggal: d.tanggal,
    fungsi: d.fungsi,
    petugas: d.petugas || '',
    keterangan: d.keterangan || '',
    created_by: auth.id,
  }));

  const { error: insertError } = await client.from('uji_fungsi_records').insert(rows);

  if (insertError) {
    console.error('Insert uji fungsi (bulk) error:', insertError);
    throw new Error(insertError.message);
  }

  return { count: data.length, deleted: deletedCount || 0 };
}

export async function deleteUjiFungsi(id: string): Promise<void> {
  if (!isConnected()) throw new Error('Not connected');

  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');

  const client = createSupabaseClient(auth.token);

  const { error } = await client.from('uji_fungsi_records').delete().eq('id', id);

  if (error) {
    console.error('Delete uji fungsi error:', error);
    throw new Error(error.message);
  }
}

// ─── Laporan Validasi ────────────────────────────────────────────────────

export async function fetchLaporanValidasi(
  alat: string,
  bulan: string,
  tipe?: string,
): Promise<LaporanValidasi[]> {
  if (!isConnected()) throw new Error('Not connected');

  const auth = getStoredAuth();
  if (!auth) return [];

  const client = createSupabaseClient(auth.token);

  let query = client
    .from('laporan_validasi')
    .select('*')
    .eq('alat', alat)
    .eq('bulan', bulan);

  if (tipe) query = query.eq('tipe', tipe);

  const { data, error } = await query;

  if (error) {
    console.error('Fetch laporan validasi error:', error);
    return [];
  }

  return (data || []) as LaporanValidasi[];
}

export async function saveLaporanValidasi(
  validasi: { id: string; alat: string; tipe: string; bulan: string; pic_alat: string; ka_lab: string },
): Promise<string> {
  if (!isConnected()) throw new Error('Not connected');

  const auth = getStoredAuth();
  if (!auth) throw new Error('Not authenticated');

  const client = createSupabaseClient(auth.token);

  const { error } = await client.from('laporan_validasi').upsert({
    id: validasi.id,
    alat: validasi.alat,
    tipe: validasi.tipe,
    bulan: validasi.bulan,
    pic_alat: validasi.pic_alat,
    ka_lab: validasi.ka_lab,
  });

  if (error) {
    console.error('Save laporan validasi error:', error);
    throw new Error(error.message);
  }

  return validasi.id;
}
