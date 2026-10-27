
import assert from 'node:assert';

function checkLotExpiryMirror(expDate) {
  if (!expDate || expDate.trim() === '') return { status: 'unknown', daysRemaining: 0 };
  const exp = new Date(expDate);
  if (isNaN(exp.getTime())) return { status: 'unknown', daysRemaining: 0 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exp.setHours(0, 0, 0, 0);
  const diffMs = exp.getTime() - today.getTime();
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  let status;
  if (daysRemaining < 0) status = 'expired';
  else if (daysRemaining <= 7) status = 'expiring-soon';
  else status = 'ok';
  return { status, daysRemaining };
}

function findActiveLotMirror(lots, recordDate, recordLot) {
  if (recordLot) {
    const match = lots.find(l => l.lot === recordLot);
    if (match) return match;
  }
  const active = lots.filter(l => l.exp >= recordDate);
  if (active.length > 0) {
    active.sort((a, b) => a.exp.localeCompare(b.exp));
    return active[0];
  }
  const sorted = [...lots].sort((a, b) => b.exp.localeCompare(a.exp));
  return sorted[0] || null;
}

console.log('🚀 Starting Logic Mirror Verification...');

try {
  console.log('Testing lot-expiry mirror...');
  assert.strictEqual(checkLotExpiryMirror('2020-01-01').status, 'expired');
  assert.strictEqual(checkLotExpiryMirror('2099-12-31').status, 'ok');
  console.log('✅ Lot Expiry: PASSED');

  console.log('Testing findActiveLot mirror...');
  const lots = [
    { lot: 'LOT_OLD', exp: '2023-01-01' },
    { lot: 'LOT_NEW', exp: '2025-01-01' }
  ];
  assert.strictEqual(findActiveLotMirror(lots, '2024-01-01', 'LOT_OLD').lot, 'LOT_OLD');
  assert.strictEqual(findActiveLotMirror(lots, '2024-01-01').lot, 'LOT_NEW');
  console.log('✅ findActiveLot Priority: PASSED');

  console.log('\n🎉 ALL CORE LOGIC MIRRORS VERIFIED SUCCESSFULLY!');
} catch (e) {
  console.error('\n❌ VERIFICATION FAILED:');
  console.error(e);
  process.exit(1);
}
