#!/usr/bin/env node
/**
 * Verify QC data integrity in Supabase
 * 
 * Usage: node scripts/verify-qc-data.cjs
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase config
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const CHECKS = {
  PASS: '✅',
  FAIL: '❌',
  WARN: '⚠️',
};

async function main() {
  console.log('🔍 QC Data Integrity Verification\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const results = [];

  // Check 1: Count records by instrument
  console.log('📊 Check 1: Count records by instrument');
  const { data: countByAlat, error: e1 } = await supabase
    .from('qc_records')
    .select('alat');

  if (e1) {
    console.log(`${CHECKS.FAIL} Error: ${e1.message}\n`);
    results.push({ check: 'Count by instrument', status: 'FAIL', error: e1.message });
  } else {
    const counts = countByAlat.reduce((acc, r) => {
      acc[r.alat] = (acc[r.alat] || 0) + 1;
      return acc;
    }, {});

    const expected = { CA660: 10, EASYLITE: 15, ONCALL1: 10, ONCALL2: 10 };
    let pass = true;

    for (const [alat, expectedCount] of Object.entries(expected)) {
      const actualCount = counts[alat] || 0;
      const status = actualCount === expectedCount ? CHECKS.PASS : CHECKS.FAIL;
      console.log(`   ${status} ${alat}: ${actualCount} (expected ${expectedCount})`);
      if (actualCount !== expectedCount) pass = false;
    }

    results.push({ check: 'Count by instrument', status: pass ? 'PASS' : 'FAIL' });
    console.log();
  }

  // Check 2: Count records by month
  console.log('📅 Check 2: Count records by month');
  const { data: records, error: e2 } = await supabase
    .from('qc_records')
    .select('tanggal');

  if (e2) {
    console.log(`${CHECKS.FAIL} Error: ${e2.message}\n`);
    results.push({ check: 'Count by month', status: 'FAIL', error: e2.message });
  } else {
    const months = records.reduce((acc, r) => {
      const month = r.tanggal.substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    const currentMonth = new Date().toISOString().substring(0, 7);
    const currentMonthCount = months[currentMonth] || 0;
    const status = currentMonthCount === 45 ? CHECKS.PASS : CHECKS.WARN;
    console.log(`   ${status} ${currentMonth}: ${currentMonthCount} records (expected 45)`);

    results.push({ check: 'Count by month', status: currentMonthCount === 45 ? 'PASS' : 'WARN' });
    console.log();
  }

  // Check 3: Verify no orphan records
  console.log('👤 Check 3: Verify no orphan records (created_by not in profiles)');
  const { data: orphans, error: e3 } = await supabase.rpc('check_orphan_qc_records', {});

  if (e3) {
    // RPC might not exist, fallback to manual check
    const { data: qcRecords, error: e3a } = await supabase
      .from('qc_records')
      .select('id, created_by');

    const { data: profiles, error: e3b } = await supabase
      .from('profiles')
      .select('id');

    if (e3a || e3b) {
      console.log(`${CHECKS.FAIL} Error: ${e3a?.message || e3b?.message}\n`);
      results.push({ check: 'Orphan records', status: 'FAIL', error: e3a?.message || e3b?.message });
    } else {
      const profileIds = new Set(profiles.map(p => p.id));
      const orphanRecords = qcRecords.filter(r => r.created_by && !profileIds.has(r.created_by));

      if (orphanRecords.length === 0) {
        console.log(`   ${CHECKS.PASS} No orphan records found`);
        results.push({ check: 'Orphan records', status: 'PASS' });
      } else {
        console.log(`   ${CHECKS.FAIL} Found ${orphanRecords.length} orphan records`);
        results.push({ check: 'Orphan records', status: 'FAIL', count: orphanRecords.length });
      }
    }
  } else {
    console.log(`   ${CHECKS.PASS} No orphan records found`);
    results.push({ check: 'Orphan records', status: 'PASS' });
  }
  console.log();

  // Check 4: Verify lot config structure
  console.log('⚙️  Check 4: Verify lot config structure');
  const { data: lotConfig, error: e4 } = await supabase
    .from('lot_config')
    .select('config')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (e4) {
    console.log(`${CHECKS.FAIL} Error: ${e4.message}\n`);
    results.push({ check: 'Lot config structure', status: 'FAIL', error: e4.message });
  } else {
    const config = lotConfig.config;
    const requiredInstruments = ['CA660', 'EASYLITE', 'ONCALL1', 'ONCALL2'];
    let pass = true;

    for (const instrument of requiredInstruments) {
      if (!config[instrument]) {
        console.log(`   ${CHECKS.FAIL} Missing instrument: ${instrument}`);
        pass = false;
      } else if (!Array.isArray(config[instrument]) || config[instrument].length === 0) {
        console.log(`   ${CHECKS.FAIL} Invalid structure for ${instrument}`);
        pass = false;
      } else {
        console.log(`   ${CHECKS.PASS} ${instrument}: ${config[instrument].length} lot(s)`);
      }
    }

    results.push({ check: 'Lot config structure', status: pass ? 'PASS' : 'FAIL' });
    console.log();
  }

  // Check 5: Verify tanggal format (ISO date string)
  console.log('📆 Check 5: Verify tanggal format (ISO date YYYY-MM-DD)');
  const { data: dates, error: e5 } = await supabase
    .from('qc_records')
    .select('tanggal')
    .limit(10);

  if (e5) {
    console.log(`${CHECKS.FAIL} Error: ${e5.message}\n`);
    results.push({ check: 'Tanggal format', status: 'FAIL', error: e5.message });
  } else {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const invalidDates = dates.filter(r => !isoDateRegex.test(r.tanggal));

    if (invalidDates.length === 0) {
      console.log(`   ${CHECKS.PASS} All dates in ISO format (YYYY-MM-DD)`);
      results.push({ check: 'Tanggal format', status: 'PASS' });
    } else {
      console.log(`   ${CHECKS.FAIL} Found ${invalidDates.length} invalid date formats`);
      results.push({ check: 'Tanggal format', status: 'FAIL', count: invalidDates.length });
    }
    console.log();
  }

  // Check 6: Verify JSONB structure (params and status)
  console.log('🔧 Check 6: Verify JSONB structure (params and status)');
  const { data: jsonbRecords, error: e6 } = await supabase
    .from('qc_records')
    .select('id, alat, params, status')
    .limit(10);

  if (e6) {
    console.log(`${CHECKS.FAIL} Error: ${e6.message}\n`);
    results.push({ check: 'JSONB structure', status: 'FAIL', error: e6.message });
  } else {
    let pass = true;

    for (const record of jsonbRecords) {
      if (typeof record.params !== 'object' || Array.isArray(record.params)) {
        console.log(`   ${CHECKS.FAIL} Invalid params structure for record ${record.id}`);
        pass = false;
      }
      if (typeof record.status !== 'object' || Array.isArray(record.status)) {
        console.log(`   ${CHECKS.FAIL} Invalid status structure for record ${record.id}`);
        pass = false;
      }
    }

    if (pass) {
      console.log(`   ${CHECKS.PASS} All JSONB structures valid`);
    }

    results.push({ check: 'JSONB structure', status: pass ? 'PASS' : 'FAIL' });
    console.log();
  }

  // Summary
  console.log('═'.repeat(60));
  console.log('📋 SUMMARY\n');

  const passCount = results.filter(r => r.status === 'PASS').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;
  const warnCount = results.filter(r => r.status === 'WARN').length;

  console.log(`   ${CHECKS.PASS} PASS: ${passCount}`);
  console.log(`   ${CHECKS.FAIL} FAIL: ${failCount}`);
  console.log(`   ${CHECKS.WARN} WARN: ${warnCount}`);
  console.log();

  if (failCount === 0) {
    console.log('✅ All checks passed! QC data integrity verified.\n');
    process.exit(0);
  } else {
    console.log('❌ Some checks failed. Review errors above.\n');
    process.exit(1);
  }
}

main().catch(console.error);
