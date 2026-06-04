#!/usr/bin/env node
/**
 * Migrate historical QC data from Excel to Supabase.
 *
 * Usage: node scripts/migrate-excel-qc.cjs [--dry-run]
 *
 * Sources:
 *   /Users/rama/Downloads/QC EASYLYTE 2026.xlsx
 *   /Users/rama/Downloads/QC KOAGULASI 2026 (CA-660).xlsx
 */

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tpyocjcjoucyymsptbbw.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRweW9jamNqb3VjeXltc3B0YmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDAzOTMsImV4cCI6MjA5NDA3NjM5M30.d4HIKDyv5VtGPYc2yzVOexsWoU39MCAfGgk3L1ECziM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Parse control range "135-145" → {mean, sd} */
function parseControlRange(rangeStr) {
  if (!rangeStr) return null;
  const parts = String(rangeStr).replace(/\s/g, '').split('-');
  if (parts.length !== 2) return null;
  const min = parseFloat(parts[0]);
  const max = parseFloat(parts[1]);
  if (isNaN(min) || isNaN(max)) return null;
  return {
    mean: (min + max) / 2,
    sd: (max - min) / 4,
  };
}

/** Evaluate single Westgard rule */
function evalWestgard(value, config) {
  if (!config || config.sd === 0) return null;
  const z = Math.abs((value - config.mean) / config.sd);
  if (z > 3) return 'oos';
  if (z > 2) return 'warning';
  return 'ok';
}

/** Convert Excel serial number → YYYY-MM-DD string (UTC) */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30); // Dec 30, 1899

function excelSerialToDate(serial) {
  if (typeof serial !== 'number') return null;
  const d = new Date(EXCEL_EPOCH + serial * 86400000);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Fix known data typos */
function fixTypo(val) {
  if (val === undefined || val === null) return null;
  const s = String(val);
  // "1..14" → 1.14
  if (s.includes('..')) {
    const fixed = parseFloat(s.replace('..', '.'));
    return isNaN(fixed) ? null : fixed;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── Easylite LOT mapping ─────────────────────────────────────────────────────
const EASYLITE_LOTS = {
  'JAN 2026': { NORMAL: '224348', HIGH: '224348' },
  'FEB 2026': { NORMAL: '25119', HIGH: '25126' },
  'MAR 2026': { NORMAL: '25289', HIGH: '25294' },
  'APR 2026': { NORMAL: '25289', HIGH: '25294' },
};

// ─── CA-660 LOT mapping ───────────────────────────────────────────────────────
const CA660_LOTS = {
  'JAN 2026': '507920',
  'FEB 2026': '507929',
  'MAR 2026': '507929',
  'APR 2026': '507929',
};

// ─── Parse Easylite ───────────────────────────────────────────────────────────

function parseEasylite(filePath) {
  const wb = XLSX.readFile(filePath);
  const records = [];
  const months = ['JAN 2026', 'FEB 2026', 'MAR 2026', 'APR 2026'];

  for (const sheetName of months) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      console.warn(`  ⚠️  Sheet "${sheetName}" not found, skipping`);
      continue;
    }

    // Convert to array of arrays (skip first 4 header rows)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const lotMap = EASYLITE_LOTS[sheetName];
    if (!lotMap) {
      console.warn(`  ⚠️  No LOT mapping for ${sheetName}, skipping`);
      continue;
    }

    let count = 0;
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const rawDate = row[0];
      const tanggal = excelSerialToDate(rawDate);
      if (!tanggal) continue;

      const timestamp = tanggal + 'T00:00:00.000Z';

      // ── NORMAL ──
      const naVal = fixTypo(row[1]);
      const naRange = parseControlRange(row[2]);
      const kVal = fixTypo(row[3]);
      const kRange = parseControlRange(row[4]);
      const clVal = fixTypo(row[5]);
      const clRange = parseControlRange(row[6]);

      const normalParams = {};
      const normalStatus = {};
      if (naVal !== null) {
        normalParams.Na = naVal;
        const s = evalWestgard(naVal, naRange);
        if (s) normalStatus.Na = s;
      }
      if (kVal !== null) {
        normalParams.K = kVal;
        const s = evalWestgard(kVal, kRange);
        if (s) normalStatus.K = s;
      }
      if (clVal !== null) {
        normalParams.Cl = clVal;
        const s = evalWestgard(clVal, clRange);
        if (s) normalStatus.Cl = s;
      }

      if (Object.keys(normalParams).length > 0) {
        records.push({
          id: uuidv4(),
          timestamp,
          tanggal,
          alat: 'EASYLITE',
          level: 'NORMAL',
          lot: lotMap.NORMAL,
          params: normalParams,
          status: normalStatus,
          analis: '',
          catatan: row[13] ? String(row[13]).trim() : '',
        });
        count++;
      }

      // ── HIGH ──
      const naValH = fixTypo(row[7]);
      const naRangeH = parseControlRange(row[8]);
      const kValH = fixTypo(row[9]);
      const kRangeH = parseControlRange(row[10]);
      const clValH = fixTypo(row[11]);
      const clRangeH = parseControlRange(row[12]);

      const highParams = {};
      const highStatus = {};
      if (naValH !== null) {
        highParams.Na = naValH;
        const s = evalWestgard(naValH, naRangeH);
        if (s) highStatus.Na = s;
      }
      if (kValH !== null) {
        highParams.K = kValH;
        const s = evalWestgard(kValH, kRangeH);
        if (s) highStatus.K = s;
      }
      if (clValH !== null) {
        highParams.Cl = clValH;
        const s = evalWestgard(clValH, clRangeH);
        if (s) highStatus.Cl = s;
      }

      if (Object.keys(highParams).length > 0) {
        records.push({
          id: uuidv4(),
          timestamp,
          tanggal,
          alat: 'EASYLITE',
          level: 'HIGH',
          lot: lotMap.HIGH,
          params: highParams,
          status: highStatus,
          analis: '',
          catatan: row[13] ? String(row[13]).trim() : '',
        });
        count++;
      }
    }
    console.log(`  ${sheetName}: ${count} records`);
  }
  return records;
}

// ─── Parse CA-660 ─────────────────────────────────────────────────────────────

function parseCA660(filePath) {
  const wb = XLSX.readFile(filePath);
  const records = [];
  const months = ['JAN 2026', 'FEB 2026', 'MAR 2026', 'APR 2026'];

  for (const sheetName of months) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      console.warn(`  ⚠️  Sheet "${sheetName}" not found, skipping`);
      continue;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    const lot = CA660_LOTS[sheetName];
    if (!lot) {
      console.warn(`  ⚠️  No LOT mapping for ${sheetName}, skipping`);
      continue;
    }

    let count = 0;
    for (let i = 4; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) continue;
      const rawDate = row[0];
      const tanggal = excelSerialToDate(rawDate);
      if (!tanggal) continue;

      const timestamp = tanggal + 'T00:00:00.000Z';

      const ptVal = fixTypo(row[1]);
      const ptRange = parseControlRange(row[2]);
      const inrVal = fixTypo(row[3]);
      const inrRange = parseControlRange(row[4]);
      const apttVal = fixTypo(row[5]);
      const apttRange = parseControlRange(row[6]);
      // Skip D1, D2 (columns H-K)

      const params = {};
      const status = {};

      if (ptVal !== null) {
        params.PT = ptVal;
        const s = evalWestgard(ptVal, ptRange);
        if (s) status.PT = s;
      }
      if (inrVal !== null) {
        params.INR = inrVal;
        const s = evalWestgard(inrVal, inrRange);
        if (s) status.INR = s;
      }
      if (apttVal !== null) {
        params.APTT = apttVal;
        const s = evalWestgard(apttVal, apttRange);
        if (s) status.APTT = s;
      }

      if (Object.keys(params).length > 0) {
        records.push({
          id: uuidv4(),
          timestamp,
          tanggal,
          alat: 'CA660',
          level: 'Kontrol',
          lot,
          params,
          status,
          analis: '',
          catatan: '',
        });
        count++;
      }
    }
    console.log(`  ${sheetName}: ${count} records`);
  }
  return records;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== QC Data Migration ===\n');

  if (DRY_RUN) {
    console.log('🔍 DRY RUN — no data will be modified\n');
  }

  // Parse Excel files
  console.log('📖 Reading Excel files...\n');
  console.log('Easylite:');
  const easyliteRecords = parseEasylite('/Users/rama/Downloads/QC EASYLYTE 2026.xlsx');
  console.log(`  Total: ${easyliteRecords.length}\n`);

  console.log('CA-660:');
  const ca660Records = parseCA660('/Users/rama/Downloads/QC KOAGULASI 2026 (CA-660).xlsx');
  console.log(`  Total: ${ca660Records.length}\n`);

  const allRecords = [...easyliteRecords, ...ca660Records];
  console.log(`📊 Grand total: ${allRecords.length} records\n`);

  if (DRY_RUN) {
    // Show sample
    console.log('Sample records:');
    allRecords.slice(0, 3).forEach((r) => {
      console.log(`  ${r.tanggal} | ${r.alat} | ${r.level} | ${JSON.stringify(r.params)} | ${JSON.stringify(r.status)}`);
    });
    return;
  }

  // Delete existing records
  console.log('🗑️  Deleting existing QC records...');
  const { count: deletedCount, error: delError } = await supabase
    .from('qc_records')
    .delete({ count: 'exact' })
    .neq('id', '__nonexistent__'); // delete all
  if (delError) {
    console.error('  ❌ Delete error:', delError.message);
    process.exit(1);
  }
  console.log(`  ✅ Deleted ${deletedCount} records\n`);

  // Insert in batches of 50
  console.log('📤 Inserting records...');
  const BATCH = 50;
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < allRecords.length; i += BATCH) {
    const batch = allRecords.slice(i, i + BATCH);
    const { error } = await supabase.from('qc_records').insert(batch);
    if (error) {
      console.error(`  ⚠️  Batch ${i / BATCH + 1} error:`, error.message);
      failed += batch.length;
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`\r  Inserted: ${inserted}/${allRecords.length}`);
  }
  console.log();

  if (failed > 0) {
    console.log(`\n⚠️  ${failed} records failed to insert`);
  }

  console.log('\n=== Migration Complete ===');
  console.log(`   Easylite: ${easyliteRecords.length}`);
  console.log(`   CA-660:   ${ca660Records.length}`);
  console.log(`   Inserted: ${inserted}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
