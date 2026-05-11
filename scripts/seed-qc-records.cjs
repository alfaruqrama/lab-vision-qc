#!/usr/bin/env node
/**
 * Seed sample QC records to Supabase
 * 
 * Usage: node scripts/seed-qc-records.cjs [days]
 * 
 * Args:
 *   days - Number of days to generate (default: 10)
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Supabase config
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// Rama user ID (from profiles table)
const RAMA_USER_ID = 'ba98d317-ae71-4138-9df8-07cf0480bd7d';

// Default lot configuration (from mock-data.ts)
const DEFAULT_LOT_CONFIG = {
  CA660: [
    {
      lot: 'CA-2024-001',
      exp: '2026-12-31',
      Kontrol: {
        PT: { mean: 12.5, sd: 0.3 },
        APTT: { mean: 32.0, sd: 1.5 },
        INR: { mean: 1.0, sd: 0.05 },
      },
    },
  ],
  EASYLITE: [
    {
      lot: 'EL-2024-001',
      exp: '2026-09-30',
      NORMAL: {
        Na: { mean: 140, sd: 2 },
        K: { mean: 4.0, sd: 0.2 },
        Cl: { mean: 100, sd: 2 },
      },
      HIGH: {
        Na: { mean: 155, sd: 2 },
        K: { mean: 6.5, sd: 0.3 },
        Cl: { mean: 115, sd: 2 },
      },
    },
  ],
  ONCALL1: [
    {
      lot: '1790338',
      exp: '2026-05-28',
      CTRL0: { GDA: { mean: 47, sd: 7.5 } },
      CTRL1: { GDA: { mean: 134, sd: 13.5 } },
      CTRL2: { GDA: { mean: 364, sd: 36.5 } },
    },
  ],
  ONCALL2: [
    {
      lot: '1790338',
      exp: '2026-05-28',
      CTRL0: { GDA: { mean: 47, sd: 7.5 } },
      CTRL1: { GDA: { mean: 134, sd: 13.5 } },
      CTRL2: { GDA: { mean: 364, sd: 36.5 } },
    },
  ],
};

// Westgard evaluation (simplified from westgard.ts)
function evaluateWestgard(value, target) {
  const { mean, sd } = target;
  const z = (value - mean) / sd;
  const absZ = Math.abs(z);

  if (absZ > 3) return { status: 'oos', rule: '13s' };
  if (absZ > 2) return { status: 'warning', rule: '12s' };
  return { status: 'ok', rule: null };
}

// Generate random value with Box-Muller transform
function generateValue(mean, sd, bias = 0) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return parseFloat((mean + (z + bias) * sd).toFixed(2));
}

// Generate mock QC records
function generateMockRecords(days = 10) {
  const records = [];
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const analysts = ['Dewi S.', 'Rina A.', 'Budi P.', 'Sari K.'];
  
  const ca660Lot = DEFAULT_LOT_CONFIG.CA660[0];
  const elLot = DEFAULT_LOT_CONFIG.EASYLITE[0];
  const oc1Lot = DEFAULT_LOT_CONFIG.ONCALL1[0];
  const oc2Lot = DEFAULT_LOT_CONFIG.ONCALL2[0];

  // Generate for last N days of current month
  const startDay = Math.max(1, now.getDate() - days + 1);
  const endDay = now.getDate();

  for (let day = startDay; day <= endDay; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const analis = analysts[day % analysts.length];

    // CA-660 Kontrol
    const caParams = {
      PT: generateValue(ca660Lot.Kontrol.PT.mean, ca660Lot.Kontrol.PT.sd, day === 5 ? 4 : 0),
      APTT: generateValue(ca660Lot.Kontrol.APTT.mean, ca660Lot.Kontrol.APTT.sd, day === 12 ? 3 : 0),
      INR: generateValue(ca660Lot.Kontrol.INR.mean, ca660Lot.Kontrol.INR.sd),
    };
    const caStatus = {
      PT: evaluateWestgard(caParams.PT, ca660Lot.Kontrol.PT).status,
      APTT: evaluateWestgard(caParams.APTT, ca660Lot.Kontrol.APTT).status,
      INR: evaluateWestgard(caParams.INR, ca660Lot.Kontrol.INR).status,
    };
    records.push({
      id: uuidv4(),
      timestamp: new Date(year, month, day, 7, 30).toISOString(),
      tanggal: dateStr,
      alat: 'CA660',
      level: 'Kontrol',
      lot: ca660Lot.lot,
      params: caParams,
      status: caStatus,
      analis,
      catatan: '',
      created_by: RAMA_USER_ID,
    });

    // EASYLITE NORMAL
    const elNParams = {
      Na: generateValue(elLot.NORMAL.Na.mean, elLot.NORMAL.Na.sd, day === 8 ? 3.5 : 0),
      K: generateValue(elLot.NORMAL.K.mean, elLot.NORMAL.K.sd),
      Cl: generateValue(elLot.NORMAL.Cl.mean, elLot.NORMAL.Cl.sd),
    };
    const elNStatus = {
      Na: evaluateWestgard(elNParams.Na, elLot.NORMAL.Na).status,
      K: evaluateWestgard(elNParams.K, elLot.NORMAL.K).status,
      Cl: evaluateWestgard(elNParams.Cl, elLot.NORMAL.Cl).status,
    };
    records.push({
      id: uuidv4(),
      timestamp: new Date(year, month, day, 7, 45).toISOString(),
      tanggal: dateStr,
      alat: 'EASYLITE',
      level: 'NORMAL',
      lot: elLot.lot,
      params: elNParams,
      status: elNStatus,
      analis,
      catatan: '',
      created_by: RAMA_USER_ID,
    });

    // EASYLITE HIGH (every other day)
    if (day % 2 === 0) {
      const elHParams = {
        Na: generateValue(elLot.HIGH.Na.mean, elLot.HIGH.Na.sd),
        K: generateValue(elLot.HIGH.K.mean, elLot.HIGH.K.sd, day === 10 ? -3 : 0),
        Cl: generateValue(elLot.HIGH.Cl.mean, elLot.HIGH.Cl.sd),
      };
      const elHStatus = {
        Na: evaluateWestgard(elHParams.Na, elLot.HIGH.Na).status,
        K: evaluateWestgard(elHParams.K, elLot.HIGH.K).status,
        Cl: evaluateWestgard(elHParams.Cl, elLot.HIGH.Cl).status,
      };
      records.push({
        id: uuidv4(),
        timestamp: new Date(year, month, day, 8, 0).toISOString(),
        tanggal: dateStr,
        alat: 'EASYLITE',
        level: 'HIGH',
        lot: elLot.lot,
        params: elHParams,
        status: elHStatus,
        analis,
        catatan: '',
        created_by: RAMA_USER_ID,
      });
    }

    // ONCALL1 CTRL1 (daily)
    const oc1Ctrl1Params = {
      GDA: generateValue(oc1Lot.CTRL1.GDA.mean, oc1Lot.CTRL1.GDA.sd, day === 15 ? 3 : 0),
    };
    const oc1Ctrl1Status = {
      GDA: evaluateWestgard(oc1Ctrl1Params.GDA, oc1Lot.CTRL1.GDA).status,
    };
    records.push({
      id: uuidv4(),
      timestamp: new Date(year, month, day, 8, 15).toISOString(),
      tanggal: dateStr,
      alat: 'ONCALL1',
      level: 'CTRL1',
      lot: oc1Lot.lot,
      params: oc1Ctrl1Params,
      status: oc1Ctrl1Status,
      analis,
      catatan: '',
      created_by: RAMA_USER_ID,
    });

    // ONCALL2 CTRL1 (daily)
    const oc2Ctrl1Params = {
      GDA: generateValue(oc2Lot.CTRL1.GDA.mean, oc2Lot.CTRL1.GDA.sd),
    };
    const oc2Ctrl1Status = {
      GDA: evaluateWestgard(oc2Ctrl1Params.GDA, oc2Lot.CTRL1.GDA).status,
    };
    records.push({
      id: uuidv4(),
      timestamp: new Date(year, month, day, 8, 30).toISOString(),
      tanggal: dateStr,
      alat: 'ONCALL2',
      level: 'CTRL1',
      lot: oc2Lot.lot,
      params: oc2Ctrl1Params,
      status: oc2Ctrl1Status,
      analis,
      catatan: '',
      created_by: RAMA_USER_ID,
    });
  }

  return records;
}

async function main() {
  const days = parseInt(process.argv[2]) || 10;
  
  console.log('🔧 Seeding Sample QC Records\n');
  console.log(`📅 Generating records for last ${days} days of current month\n`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Generate records
  const records = generateMockRecords(days);
  console.log(`📝 Generated ${records.length} records:`);
  
  // Count by instrument
  const countByAlat = records.reduce((acc, r) => {
    acc[r.alat] = (acc[r.alat] || 0) + 1;
    return acc;
  }, {});
  
  for (const [alat, count] of Object.entries(countByAlat)) {
    console.log(`   - ${alat}: ${count} records`);
  }
  console.log();

  // Insert records in batches (Supabase has 1000 row limit per insert)
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    console.log(`📤 Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)} (${batch.length} records)...`);
    
    const { data, error } = await supabase
      .from('qc_records')
      .insert(batch)
      .select('id');

    if (error) {
      console.error('❌ Error inserting batch:', error.message);
      process.exit(1);
    }

    inserted += data.length;
  }

  console.log();
  console.log('✅ QC records seeded successfully!');
  console.log(`   Total inserted: ${inserted} records`);
  console.log(`   Created by: rama (${RAMA_USER_ID})\n`);

  console.log('🔍 Verify in Supabase Studio:');
  console.log('   http://127.0.0.1:54323/project/default/editor/qc_records\n');
  
  console.log('📊 Quick stats:');
  console.log(`   SELECT alat, COUNT(*) FROM qc_records GROUP BY alat;`);
  console.log(`   SELECT tanggal, COUNT(*) FROM qc_records GROUP BY tanggal ORDER BY tanggal;\n`);
}

main().catch(console.error);
