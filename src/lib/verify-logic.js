
const assert = require('assert');
const { computeZScores, findActiveLot } = require('./zscore');
const { checkLotExpiry } = require('./lot-expiry');

console.log('🚀 Starting Logic Verification...');

try {
  // Test 1: Lot Expiry
  console.log('Testing lot-expiry...');
  assert.strictEqual(checkLotExpiry('2020-01-01').status, 'expired');
  assert.strictEqual(checkLotExpiry('2099-12-31').status, 'ok');
  console.log('✅ Lot Expiry: PASSED');

  // Test 2: Z-Score Calculation
  console.log('Testing zscore calculation...');
  const mockConfig = {
    CA660: [{ lot: 'LOT1', exp: '2099-01-01', Kontrol: { PT: { mean: 10, sd: 1 } } }],
    EASYLITE: { 
      NORMAL: [{ lot: 'N1', exp: '2099-01-01', params: { Na: { mean: 140, sd: 2 } } }],
      HIGH: [{ lot: 'H1', exp: '2099-01-01', params: { Na: { mean: 150, sd: 2 } } }]
    },
    ONCALL1: [], ONCALL2: [], CLEVER1: [], CLEVER2: []
  };
  const records = [{
    id: '1', timestamp: '', tanggal: '2024-01-01', alat: 'CA660', level: 'Kontrol', lot: 'LOT1',
    params: { PT: 12 }, status: {}, analis: '', catatan: ''
  }];
  const results = computeZScores(records, mockConfig);
  assert.strictEqual(results[0].params.PT, 2);
  console.log('✅ Z-Score Calculation: PASSED');

  // Test 3: findActiveLot priority
  console.log('Testing findActiveLot priority...');
  const lots = [
    { lot: 'LOT_OLD', exp: '2023-01-01' },
    { lot: 'LOT_NEW', exp: '2025-01-01' }
  ];
  assert.strictEqual(findActiveLot(lots, '2024-01-01', 'LOT_OLD').lot, 'LOT_OLD');
  assert.strictEqual(findActiveLot(lots, '2024-01-01').lot, 'LOT_NEW');
  console.log('✅ findActiveLot Priority: PASSED');

  console.log('\n🎉 ALL CORE LOGIC VERIFIED SUCCESSFULLY!');
} catch (e) {
  console.error('\n❌ VERIFICATION FAILED:');
  console.error(e);
  process.exit(1);
}
