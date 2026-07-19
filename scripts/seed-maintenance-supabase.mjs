/**
 * Seed maintenance records into Supabase for 2026.
 * Skips records that already exist (by id or by alat+tipe+tanggal key).
 * Usage: node scripts/seed-maintenance-supabase.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Load env ────────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env.local');
  const env = {};
  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
      }
    }
  } catch { /* ignore, will use defaults */ }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Activity Templates ───────────────────────────────────────────────────────

const DAILY_ACTIVITIES = {
  BC6800: ['Rinse Probe', 'Washing Block', 'Clean Cuvette', 'Check SRV', 'Check Flow Cell', 'Check Aperture'],
  BC760: ['Probe Cleaner', 'Aperture Cleaning'],
  CA500600: ['Bersihkan probe manual', 'Rinse probe', 'Rinse and prepare', 'Buang reaction tube bekas', 'Buang limbah', 'Paraf'],
  EasyLyte: ['Daily Cleanse', 'Conditioner'],
};

const WEEKLY_BC6800 = ['Clean Flow Cell', 'Clean SRV', 'Clean Aperture', 'Clean Cuvette'];
const MONTHLY_BC6800 = ['Clean Flow Cell', 'Clean SRV', 'Check Aperture', 'Check Valves', 'Check Waste'];

const DAILY_ALATS = Object.keys(DAILY_ACTIVITIES);
const UJI_FUNGSI_ALATS = ['BC6800', 'BC760', 'CA500600', 'EasyLyte'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDatesInRange(start, end) {
  const dates = [];
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

function getMondaysInRange(start, end) {
  return getDatesInRange(start, end).filter((d) => new Date(d + 'T00:00:00').getDay() === 1);
}

function getFirstOfMonths(start, end) {
  const months = [];
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

let counter = 0;
function makeId() {
  counter++;
  return `maint-seed-${Date.now()}-${counter}`;
}

// ─── Fetch Existing Records ──────────────────────────────────────────────────

async function fetchExistingMaintenanceKeys() {
  console.log('Fetching existing maintenance records...');
  const { data, error } = await supabase
    .from('maintenance_records')
    .select('alat, tipe, tanggal');

  if (error) {
    console.log(`  Warning: ${error.message}`);
    return new Set();
  }

  const keys = new Set();
  (data || []).forEach((r) => keys.add(`${r.alat}|${r.tipe}|${r.tanggal}`));
  console.log(`  Found ${keys.size} existing maintenance records`);
  return keys;
}

async function fetchExistingUjiFungsiKeys() {
  console.log('Fetching existing uji fungsi records...');
  const { data, error } = await supabase
    .from('uji_fungsi_records')
    .select('alat, tanggal');

  if (error) {
    console.log(`  Warning: ${error.message}`);
    return new Set();
  }

  const keys = new Set();
  (data || []).forEach((r) => keys.add(`${r.alat}|${r.tanggal}`));
  console.log(`  Found ${keys.size} existing uji fungsi records`);
  return keys;
}

// ─── Generate Records ────────────────────────────────────────────────────────

function generateMaintenanceInserts(existingKeys, allDays, mondays, firstOfMonths) {
  const records = [];
  let skipped = 0;

  // Daily for all instruments
  for (const alat of DAILY_ALATS) {
    const activities = DAILY_ACTIVITIES[alat];
    for (const tanggal of allDays) {
      const k = `${alat}|daily|${tanggal}`;
      if (existingKeys.has(k)) { skipped++; continue; }
      const aktivitas = {};
      activities.forEach((a) => { aktivitas[a] = true; });
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

  // Weekly BC6800
  for (const tanggal of mondays) {
    const k = `BC6800|weekly|${tanggal}`;
    if (existingKeys.has(k)) { skipped++; continue; }
    const aktivitas = {};
    WEEKLY_BC6800.forEach((a) => { aktivitas[a] = true; });
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

  // Monthly BC6800
  for (const tanggal of firstOfMonths) {
    const k = `BC6800|monthly|${tanggal}`;
    if (existingKeys.has(k)) { skipped++; continue; }
    const aktivitas = {};
    MONTHLY_BC6800.forEach((a) => { aktivitas[a] = true; });
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

  return { records, skipped };
}

function generateUjiFungsiInserts(existingUFKeys, allDays) {
  const records = [];
  let skipped = 0;

  for (const alat of UJI_FUNGSI_ALATS) {
    for (const tanggal of allDays) {
      const k = `${alat}|${tanggal}`;
      if (existingUFKeys.has(k)) { skipped++; continue; }
      records.push({
        id: makeId(),
        alat,
        tanggal,
        fungsi: 'baik',
        petugas: '',
        keterangan: '',
      });
    }
  }

  return { records, skipped };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const startDate = '2026-01-01';

  const allDays = getDatesInRange(startDate, today);
  const mondays = getMondaysInRange(startDate, today);
  const firstOfMonths = getFirstOfMonths(startDate, today);

  console.log(`Date range: ${startDate} – ${today} (${allDays.length} days, ${mondays.length} mondays, ${firstOfMonths.length} months)`);
  console.log('');

  // 1. Fetch existing records to avoid duplicates
  const existingKeys = await fetchExistingMaintenanceKeys();
  const existingUFKeys = await fetchExistingUjiFungsiKeys();

  // 2. Generate new records (skip existing)
  const { records: mrRecords, skipped: mrSkipped } = generateMaintenanceInserts(existingKeys, allDays, mondays, firstOfMonths);
  const { records: ufRecords, skipped: ufSkipped } = generateUjiFungsiInserts(existingUFKeys, allDays);

  console.log(`\nMaintenance records to insert: ${mrRecords.length} (${mrSkipped} already exist, skipped)`);
  console.log(`Uji Fungsi records to insert: ${ufRecords.length} (${ufSkipped} already exist, skipped)`);

  if (mrRecords.length === 0 && ufRecords.length === 0) {
    console.log('\n✅ All records already exist — nothing to do!');
    return;
  }

  // 3. Insert maintenance records in batches
  if (mrRecords.length > 0) {
    const BATCH = 50;
    let done = 0;
    let failed = 0;

    console.log('\nInserting maintenance records...');
    for (let i = 0; i < mrRecords.length; i += BATCH) {
      const batch = mrRecords.slice(i, i + BATCH);
      const { error } = await supabase.from('maintenance_records').insert(batch);
      if (error) {
        // Try one-by-one for error details
        for (const r of batch) {
          const { error: e } = await supabase.from('maintenance_records').insert(r);
          if (e) {
            console.error(`  FAIL: ${r.alat} ${r.tipe} ${r.tanggal}: ${e.message}`);
            failed++;
          } else {
            done++;
          }
        }
      } else {
        done += batch.length;
      }
      const pct = Math.round(Math.min(i + BATCH, mrRecords.length) / mrRecords.length * 100);
      console.log(`  ${pct}% — ${done}/${mrRecords.length} saved${failed > 0 ? ` (${failed} failed)` : ''}`);
    }
    console.log(`Maintenance: ${done} saved, ${failed} failed`);
  }

  // 4. Insert uji fungsi records in batches
  if (ufRecords.length > 0) {
    const BATCH = 100;
    let done = 0;
    let failed = 0;

    console.log('\nInserting uji fungsi records...');
    for (let i = 0; i < ufRecords.length; i += BATCH) {
      const batch = ufRecords.slice(i, i + BATCH);
      const { error } = await supabase.from('uji_fungsi_records').insert(batch);
      if (error) {
        for (const r of batch) {
          const { error: e } = await supabase.from('uji_fungsi_records').insert(r);
          if (e) {
            console.error(`  FAIL: ${r.alat} ${r.tanggal}: ${e.message}`);
            failed++;
          } else {
            done++;
          }
        }
      } else {
        done += batch.length;
      }
      const pct = Math.round(Math.min(i + BATCH, ufRecords.length) / ufRecords.length * 100);
      console.log(`  ${pct}% — ${done}/${ufRecords.length} saved${failed > 0 ? ` (${failed} failed)` : ''}`);
    }
    console.log(`Uji Fungsi: ${done} saved, ${failed} failed`);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
