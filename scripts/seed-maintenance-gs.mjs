/**
 * Seed maintenance records to Google Sheets via GAS API.
 * Only inserts records that don't already exist (by alat+tipe+tanggal key).
 * Usage: node scripts/seed-maintenance-gs.mjs
 */
const GS_URL = 'https://script.google.com/macros/s/AKfycbx8B5ammXZH3-d7WKxMjuF7aSvwBrby98Ss2nK5vSxEEHoow6SirNn4pSloZX3fOfDosg/exec';

// ─── Templates ─────────────────────────────────────────────────────────────

const TEMPLATES = {
  BC6800: {
    daily: ['Rinse Probe', 'Washing Block', 'Clean Cuvette', 'Check SRV', 'Check Flow Cell', 'Check Aperture'],
    weekly: ['Clean Flow Cell', 'Clean SRV', 'Clean Aperture', 'Clean Cuvette'],
    monthly: ['Clean Flow Cell', 'Clean SRV', 'Check Aperture', 'Check Valves', 'Check Waste'],
  },
  BC760: {
    daily: ['Probe Cleaner', 'Aperture Cleaning'],
  },
  CA500600: {
    daily: ['Bersihkan probe manual', 'Rinse probe', 'Rinse and prepare', 'Buang reaction tube bekas', 'Buang limbah', 'Paraf'],
  },
  EasyLyte: {
    daily: ['Daily Cleanse', 'Conditioner'],
  },
};

const UJI_FUNGSI_ALATS = ['BC6800', 'BC760', 'CA500600', 'EasyLyte'];

// ─── Helpers ───────────────────────────────────────────────────────────────

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
  return getDatesInRange(start, end).filter((d) => new Date(d).getDay() === 1);
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

function key(alat, tipe, tanggal) {
  return `${alat}|${tipe}|${tanggal}`;
}

let counter = 0;
function makeId() {
  counter++;
  return `maint-seed-${Date.now()}-${counter}`;
}

// ─── GAS API ───────────────────────────────────────────────────────────────

async function gsGet(action) {
  const url = `${GS_URL}?action=${encodeURIComponent(action)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function gsPost(action, body) {
  const res = await fetch(GS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Fetch existing records ────────────────────────────────────────────────

async function fetchExistingKeys() {
  console.log('Fetching existing records from Google Sheets...');
  try {
    const data = await gsGet('getRecords');
    if (!data.success) {
      console.log('  Warning: could not fetch existing records, will insert all');
      return new Set();
    }
    const records = data.data || [];
    const keys = new Set();
    records.forEach((r) => keys.add(key(r.alat, r.tipe, r.tanggal)));
    console.log(`  Found ${records.length} existing records (${keys.size} unique keys)`);
    return keys;
  } catch (err) {
    console.log(`  Warning: ${err.message}, will insert all`);
    return new Set();
  }
}

async function fetchExistingUFKeys() {
  console.log('Fetching existing Uji Fungsi records...');
  const keys = new Set();
  for (const alat of UJI_FUNGSI_ALATS) {
    try {
      const data = await gsGet(`getUjiFungsi&alat=${alat}&bulan=2026-01`);
      if (data.success && data.data) {
        data.data.forEach((r) => keys.add(key(r.alat, 'uji_fungsi', r.tanggal)));
      }
    } catch {}
    // Also check other months quickly
    for (let m = 2; m <= 7; m++) {
      try {
        const bulan = `2026-${String(m).padStart(2, '0')}`;
        const data = await gsGet(`getUjiFungsi&alat=${alat}&bulan=${bulan}`);
        if (data.success && data.data) {
          data.data.forEach((r) => keys.add(key(r.alat, 'uji_fungsi', r.tanggal)));
        }
      } catch {}
    }
  }
  console.log(`  Found ${keys.size} existing Uji Fungsi records`);
  return keys;
}

// ─── Generate & filter records ─────────────────────────────────────────────

function generateNewRecords(existingKeys) {
  const records = [];
  const today = new Date().toISOString().slice(0, 10);
  const startDate = '2026-01-01';
  const allDays = getDatesInRange(startDate, today);
  const mondays = getMondaysInRange(startDate, today);
  const firstOfMonths = getFirstOfMonths(startDate, today);
  const alats = Object.keys(TEMPLATES);

  let skipped = 0;

  for (const alat of alats) {
    const tmpl = TEMPLATES[alat];
    if (!tmpl) continue;

    // Daily
    if (tmpl.daily) {
      for (const tanggal of allDays) {
        const k = key(alat, 'daily', tanggal);
        if (existingKeys.has(k)) { skipped++; continue; }
        const aktivitas = {};
        tmpl.daily.forEach((a) => { aktivitas[a] = true; });
        records.push({ id: makeId(), alat, tipe: 'daily', tanggal, aktivitas, catatan: {}, catatan_umum: '', petugas: '' });
      }
    }
  }

  // BC6800 weekly
  if (TEMPLATES.BC6800.weekly) {
    for (const tanggal of mondays) {
      const k = key('BC6800', 'weekly', tanggal);
      if (existingKeys.has(k)) { skipped++; continue; }
      const aktivitas = {};
      TEMPLATES.BC6800.weekly.forEach((a) => { aktivitas[a] = true; });
      records.push({ id: makeId(), alat: 'BC6800', tipe: 'weekly', tanggal, aktivitas, catatan: {}, catatan_umum: '', petugas: '' });
    }
  }

  // BC6800 monthly
  if (TEMPLATES.BC6800.monthly) {
    for (const tanggal of firstOfMonths) {
      const k = key('BC6800', 'monthly', tanggal);
      if (existingKeys.has(k)) { skipped++; continue; }
      const aktivitas = {};
      TEMPLATES.BC6800.monthly.forEach((a) => { aktivitas[a] = true; });
      records.push({ id: makeId(), alat: 'BC6800', tipe: 'monthly', tanggal, aktivitas, catatan: {}, catatan_umum: '', petugas: '' });
    }
  }

  return { records, allDays, skipped };
}

function generateNewUjiFungsi(existingUFKeys, allDays) {
  const byAlatBulan = {};
  let skipped = 0;

  for (const alat of UJI_FUNGSI_ALATS) {
    const byBulan = {};
    for (const tanggal of allDays) {
      const k = key(alat, 'uji_fungsi', tanggal);
      if (existingUFKeys.has(k)) { skipped++; continue; }
      const bulan = tanggal.slice(0, 7);
      if (!byBulan[bulan]) byBulan[bulan] = [];
      byBulan[bulan].push({
        id: `uf-seed-${Date.now()}-${++counter}`,
        tanggal,
        fungsi: 'baik',
        petugas: '',
        keterangan: '',
      });
    }
    byAlatBulan[alat] = byBulan;
  }
  return { byAlatBulan, skipped };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  // 1. Fetch existing records to avoid overwrites
  const existingKeys = await fetchExistingKeys();
  const existingUFKeys = await fetchExistingUFKeys();

  // 2. Generate new records (skip existing)
  const { records, allDays, skipped } = generateNewRecords(existingKeys);
  const { byAlatBulan, skipped: skippedUF } = generateNewUjiFungsi(existingUFKeys, allDays);

  console.log(`\nNew maintenance records to insert: ${records.length} (${skipped} already exist, skipped)`);
  let ufTotal = 0;
  for (const alat of UJI_FUNGSI_ALATS) {
    for (const data of Object.values(byAlatBulan[alat])) {
      ufTotal += data.length;
    }
  }
  console.log(`New Uji Fungsi records to insert: ${ufTotal} (${skippedUF} already exist, skipped)`);

  if (records.length === 0 && ufTotal === 0) {
    console.log('\n✅ All records already exist — nothing to do!');
    return;
  }

  // 3. Send maintenance records
  if (records.length > 0) {
    const BATCH = 8;
    let done = 0;
    let failed = 0;

    console.log('\nSending maintenance records...');
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (r) => {
        try {
          const res = await gsPost('saveRecord', {
            id: r.id, alat: r.alat, tipe: r.tipe, tanggal: r.tanggal,
            aktivitas: r.aktivitas, catatan: r.catatan || {}, catatan_umum: r.catatan_umum || '', petugas: r.petugas || '',
          });
          if (!res.success) throw new Error(res.error || 'Unknown');
          return true;
        } catch (err) {
          console.error(`  FAIL: ${r.alat} ${r.tipe} ${r.tanggal}: ${err.message}`);
          return false;
        }
      }));
      done += results.filter(Boolean).length;
      failed += results.filter((r) => !r).length;
      const pct = Math.round((i + batch.length) / records.length * 100);
      if (i % (BATCH * 10) === 0 || i >= records.length - BATCH) {
        console.log(`  ${pct}% — ${done}/${records.length} saved${failed > 0 ? ` (${failed} failed)` : ''}`);
      }
    }
    console.log(`Maintenance: ${done} saved, ${failed} failed`);
  }

  // 4. Send Uji Fungsi (bulk per alat+bulan)
  if (ufTotal > 0) {
    let ufDone = 0;
    console.log('\nSending Uji Fungsi records (bulk)...');
    for (const alat of UJI_FUNGSI_ALATS) {
      for (const [bulan, data] of Object.entries(byAlatBulan[alat])) {
        if (data.length === 0) continue;
        try {
          const res = await gsPost('saveUjiFungsi', { alat, bulan, data });
          if (res.success) {
            ufDone += data.length;
            console.log(`  ${alat} ${bulan}: ${data.length} records`);
          } else {
            console.error(`  FAIL: ${alat} ${bulan}: ${res.error}`);
          }
        } catch (err) {
          console.error(`  FAIL: ${alat} ${bulan}: ${err.message}`);
        }
      }
    }
    console.log(`Uji Fungsi: ${ufDone} saved`);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
