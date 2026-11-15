#!/usr/bin/env node
/**
 * Koreksi status per-parameter yang tersimpan 'ok' padahal di luar batas.
 *
 * Audit 4.1 (docs/WESTGARD_RULES.md): form input menulis `statuses[p] = 'ok'`
 * untuk setiap nilai, tanpa menghitung z-score. Import CLEVER 2026
 * (scripts/import_clever_2026.py:122) juga menulis `{"GDA": "ok"}`. Dashboard,
 * PortalHome, dan Laporan Bulanan membaca status tersimpan itu, sementara grafik
 * L-J menghitung ulang — jadi keduanya bisa berbeda.
 *
 * Skrip ini menghitung ulang status setiap record memakai aturan yang sama
 * dengan grafik (computeZScores: findActiveLot -> target lot -> evaluateWestgard)
 * dan hanya menulis record yang statusnya berbeda.
 *
 * Pemakaian:
 *   node scripts/fix-param-status.cjs           # dry-run (default)
 *   node scripts/fix-param-status.cjs --apply   # tulis ke database
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const APPLY = process.argv.includes('--apply');

const lotArray = (cfg, alat, level) =>
  alat === 'EASYLITE' ? (cfg.EASYLITE || {})[level] || [] : cfg[alat] || [];

function paramCfg(lot, alat, level, param) {
  if (!lot) return null;
  if (alat === 'EASYLITE') return (lot.params && lot.params[param]) || null;
  if (alat === 'CA660' || alat === 'CLEVER1' || alat === 'CLEVER2') {
    return (lot.Kontrol && lot.Kontrol[param]) || null;
  }
  return (lot[level] && lot[level][param]) || null;
}

/** Same priority as findActiveLot() in src/lib/zscore.ts. */
function findActiveLot(lots, recordDate, recordLot) {
  if (recordLot) {
    const match = lots.find((l) => l.lot === recordLot);
    if (match) return match;
  }
  const active = lots.filter((l) => l.exp >= recordDate).sort((a, b) => a.exp.localeCompare(b.exp));
  if (active.length > 0) return active[0];
  return [...lots].sort((a, b) => b.exp.localeCompare(a.exp))[0] || null;
}

/** Same rule and thresholds as evaluateWestgard() in src/lib/westgard.ts. */
function statusFor(value, cfg) {
  if (!cfg || !cfg.sd) return 'ok';
  const z = (value - cfg.mean) / cfg.sd;
  return Math.abs(z) > 3 ? 'oos' : Math.abs(z) > 2 ? 'warning' : 'ok';
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tidak ditemukan di .env.local');
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log(APPLY ? '🔧 MODE APPLY\n' : '🔍 MODE DRY-RUN (tambahkan --apply untuk menulis)\n');

  const { data: cfgRows, error: cfgErr } = await sb
    .from('lot_config')
    .select('id,config,updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);
  if (cfgErr) throw cfgErr;
  if (!cfgRows || cfgRows.length === 0) throw new Error('lot_config kosong');
  const config = cfgRows[0].config;
  console.log(`Config terbaru: id=${cfgRows[0].id} (${cfgRows[0].updated_at})`);

  let records = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from('qc_records')
      .select('id,tanggal,alat,level,lot,params,status,excluded')
      .order('tanggal')
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    records = records.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Record: ${records.length}`);

  const updates = [];
  let noTarget = 0;

  for (const rec of records) {
    if (rec.excluded) continue;

    const newStatus = { ...(rec.status || {}) };
    let changed = false;

    for (const [param, value] of Object.entries(rec.params || {})) {
      if (typeof value !== 'number') continue;

      const lots = lotArray(config, rec.alat, rec.level);
      const lot = findActiveLot(lots, rec.tanggal, rec.lot);
      const cfg = paramCfg(lot, rec.alat, rec.level, param);
      if (!cfg || !cfg.sd) {
        noTarget++;
        continue;
      }

      const expected = statusFor(value, cfg);
      if (newStatus[param] !== expected) {
        console.log(
          `  • ${rec.tanggal} ${rec.alat} ${rec.level} ${param}=${value} ` +
            `(z=${((value - cfg.mean) / cfg.sd).toFixed(2)}, target ${cfg.mean}±${cfg.sd}) ` +
            `${newStatus[param] || 'ok'} → ${expected}`,
        );
        newStatus[param] = expected;
        changed = true;
      }
    }

    if (changed) updates.push({ id: rec.id, status: newStatus });
  }

  console.log(`\nRecord yang perlu dikoreksi: ${updates.length}`);
  if (noTarget > 0) console.log(`Nilai tanpa target lot (dibiarkan apa adanya): ${noTarget}`);

  if (updates.length === 0) {
    console.log('\nTidak ada yang perlu diubah.');
    return;
  }
  if (!APPLY) {
    console.log('\nDry-run selesai. Jalankan dengan --apply untuk menulis.');
    return;
  }

  for (const u of updates) {
    const { error } = await sb.from('qc_records').update({ status: u.status }).eq('id', u.id);
    if (error) throw new Error(`update ${u.id}: ${error.message}`);
  }
  console.log(`\n✓ ${updates.length} record diperbarui.`);
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
