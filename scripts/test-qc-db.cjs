#!/usr/bin/env node

/**
 * Test QC module Supabase integration.
 * Verifies that QC records and lot config can be read/written.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testQCRecords() {
  console.log('\n📊 Testing QC Records...');
  
  // Test read
  const { data, error } = await supabase
    .from('qc_records')
    .select('*')
    .limit(5);

  if (error) {
    console.log('❌ Error reading QC records:', error.message);
    return false;
  }

  console.log(`✅ QC records table accessible (${data.length} records found)`);
  
  // Test insert
  const testRecord = {
    id: `test-${Date.now()}`,
    timestamp: new Date().toISOString(),
    tanggal: '2026-05-10',
    alat: 'CA660',
    level: 'Kontrol',
    lot: 'TEST-LOT',
    params: { PT: 12.5, APTT: 32.0, INR: 1.0 },
    status: { PT: 'ok', APTT: 'ok', INR: 'ok' },
    analis: 'Test User',
    catatan: 'Test record',
  };

  const { error: insertError } = await supabase
    .from('qc_records')
    .insert(testRecord);

  if (insertError) {
    console.log('❌ Error inserting QC record:', insertError.message);
    return false;
  }

  console.log('✅ QC record inserted successfully');

  // Cleanup
  await supabase.from('qc_records').delete().eq('id', testRecord.id);
  console.log('✅ Test record cleaned up');

  return true;
}

async function testLotConfig() {
  console.log('\n⚙️  Testing Lot Config...');
  
  // Test read
  const { data, error } = await supabase
    .from('lot_config')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) {
    console.log('❌ Error reading lot config:', error.message);
    return false;
  }

  console.log(`✅ Lot config table accessible (${data.length} configs found)`);

  // Test insert
  const testConfig = {
    config: {
      CA660: [{ lot: 'TEST', exp: '2026-12-31', Kontrol: { PT: { mean: 12.5, sd: 0.3 }, APTT: { mean: 32, sd: 1.5 }, INR: { mean: 1.0, sd: 0.05 } } }],
      EASYLITE: [],
      ONCALL1: [],
      ONCALL2: [],
    },
    updated_at: new Date().toISOString(),
  };

  const { data: inserted, error: insertError } = await supabase
    .from('lot_config')
    .insert(testConfig)
    .select('id')
    .single();

  if (insertError) {
    console.log('❌ Error inserting lot config:', insertError.message);
    return false;
  }

  console.log('✅ Lot config inserted successfully');

  // Cleanup
  if (inserted) {
    await supabase.from('lot_config').delete().eq('id', inserted.id);
    console.log('✅ Test config cleaned up');
  }

  return true;
}

async function main() {
  console.log('🧪 Testing QC Module Supabase Integration\n');
  console.log('=' .repeat(50));

  const qcTest = await testQCRecords();
  const configTest = await testLotConfig();

  console.log('\n' + '='.repeat(50));
  
  if (qcTest && configTest) {
    console.log('\n🎉 All QC module tests passed!');
    console.log('\n✅ QC module is connected to Supabase');
  } else {
    console.log('\n❌ Some tests failed');
    console.log('\n⚠️  QC module may not be properly connected');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
