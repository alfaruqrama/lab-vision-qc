/**
 * Generate mock maintenance records for 2026 (all checked/completed).
 * Used to seed the app when no maintenance data exists.
 */
import type { MaintenanceRecord, MaintenanceAlat, MaintenanceTipe, UjiFungsiRecord } from './maintenance-types';
import { MAINTENANCE_TEMPLATES } from '@/features/maintenance/lib/constants';

/** Get all dates in range (inclusive) */
function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    const d = String(current.getDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/** Get all Mondays in range */
function getMondaysInRange(start: string, end: string): string[] {
  const all = getDatesInRange(start, end);
  return all.filter((d) => new Date(d).getDay() === 1);
}

/** Get first day of each month in range */
function getFirstOfMonths(start: string, end: string): string[] {
  const months: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  const current = new Date(s.getFullYear(), s.getMonth(), 1);
  while (current <= e) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}-01`);
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

let _counter = 0;
function makeId(): string {
  _counter++;
  return `maint-seed-${Date.now()}-${_counter}`;
}

export function generateMaintenanceRecords(): MaintenanceRecord[] {
  const records: MaintenanceRecord[] = [];
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const startDate = '2026-01-01';

  const allDays = getDatesInRange(startDate, today);
  const mondays = getMondaysInRange(startDate, today);
  const firstOfMonths = getFirstOfMonths(startDate, today);

  // Instruments that have daily maintenance
  const dailyAlats: MaintenanceAlat[] = ['BC6800', 'BC760', 'CA500600', 'EasyLyte'];
  const ujiFungsiAlats: MaintenanceAlat[] = ['BC6800', 'BC760', 'CA500600', 'EasyLyte'];

  for (const alat of dailyAlats) {
    const dailyTemplate = MAINTENANCE_TEMPLATES.find((t) => t.alat === alat && t.tipe === 'daily');
    // Uji fungsi template
    const ufTemplate = MAINTENANCE_TEMPLATES.find((t) => t.alat === alat && t.tipe === 'uji_fungsi');

    // ── Daily ──
    if (dailyTemplate) {
      for (const tanggal of allDays) {
        const aktivitas: Record<string, boolean> = {};
        dailyTemplate.aktivitas.forEach((a) => { aktivitas[a] = true; });
        records.push({
          id: makeId(),
          alat,
          tipe: 'daily',
          tanggal,
          aktivitas,
          catatan: {},
          catatan_umum: '',
          petugas: '',
        });
      }
    }

    // ── Uji Fungsi ──
    if (ufTemplate) {
      for (const tanggal of allDays) {
        const aktivitas: Record<string, boolean> = {};
        ufTemplate.aktivitas.forEach((a) => { aktivitas[a] = true; });
        records.push({
          id: makeId(),
          alat,
          tipe: 'uji_fungsi',
          tanggal,
          aktivitas,
          catatan: {},
          catatan_umum: '',
          petugas: '',
        });
      }
    }
  }

  // ── Weekly (BC6800 only) ──
  const weeklyTemplate = MAINTENANCE_TEMPLATES.find((t) => t.alat === 'BC6800' && t.tipe === 'weekly');
  if (weeklyTemplate) {
    for (const tanggal of mondays) {
      const aktivitas: Record<string, boolean> = {};
      weeklyTemplate.aktivitas.forEach((a) => { aktivitas[a] = true; });
      records.push({
        id: makeId(),
        alat: 'BC6800',
        tipe: 'weekly',
        tanggal,
        aktivitas,
        catatan: {},
        catatan_umum: '',
        petugas: '',
      });
    }
  }

  // ── Monthly (BC6800 only) ──
  const monthlyTemplate = MAINTENANCE_TEMPLATES.find((t) => t.alat === 'BC6800' && t.tipe === 'monthly');
  if (monthlyTemplate) {
    for (const tanggal of firstOfMonths) {
      const aktivitas: Record<string, boolean> = {};
      monthlyTemplate.aktivitas.forEach((a) => { aktivitas[a] = true; });
      records.push({
        id: makeId(),
        alat: 'BC6800',
        tipe: 'monthly',
        tanggal,
        aktivitas,
        catatan: {},
        catatan_umum: '',
        petugas: '',
      });
    }
  }

  console.log(`[seed] Generated ${records.length} maintenance records (${startDate} – ${today})`);
  return records;
}

/** Generate Uji Fungsi records for 2026 (all "baik") */
export function generateUjiFungsiRecords(): UjiFungsiRecord[] {
  const records: UjiFungsiRecord[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const startDate = '2026-01-01';
  const allDays = getDatesInRange(startDate, today);
  const alats: MaintenanceAlat[] = ['BC6800', 'BC760', 'CA500600', 'EasyLyte'];

  let ufCounter = 0;
  for (const alat of alats) {
    for (const tanggal of allDays) {
      ufCounter++;
      records.push({
        id: `uf-seed-${Date.now()}-${ufCounter}`,
        alat,
        tanggal,
        fungsi: 'baik',
        petugas: '',
        keterangan: '',
        created_at: new Date().toISOString(),
      });
    }
  }

  console.log(`[seed] Generated ${records.length} uji fungsi records (${startDate} – ${today})`);
  return records;
}
