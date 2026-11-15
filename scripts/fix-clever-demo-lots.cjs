#!/usr/bin/env node
/**
 * Koreksi dua record CLEVER yang tersimpan dengan lot demo, lalu buang lot demo
 * dari config aktif.
 *
 * Latar belakang: pada 2026-07-24 halaman Konfigurasi Lot memuat
 * DEFAULT_LOT_CONFIG (src/lib/mock-data.ts) yang berisi CLEVER1/CC1-2024-001 dan
 * CLEVER2/CC2-2024-001 dengan target GDA 100 ± 5 — target demo, bukan target
 * lab. Baris itu ikut tersimpan, dan karena form input memilih lot pertama di
 * array, dua run tercatat memakai lot demo sehingga dihitung terhadap 100/5:
 *
 *   2026-09-12 CLEVER1 GDA 125 → z = +5.00 (OOS)
 *   2026-07-09 CLEVER2 GDA 129 → z = +5.80 (OOS)
 *
 * Kedua run itu dicatat di tengah pemakaian lot sungguhan (semua record
 * sebelum/sesudahnya memakai lot TD), jadi lot-nya dipindahkan ke lot yang
 * benar dan statusnya dihitung ulang.
 *
 * Pemakaian:
 *   node scripts/fix-clever-demo-lots.cjs           # dry-run (default)
 *   node scripts/fix-clever-demo-lots.cjs --apply   # tulis ke database
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

/** Lot demo yang tidak boleh dipakai lagi. */
const DEMO_LOTS = ['CC1-2024-001', 'CC2-2024-001'];

/** Record yang tersimpan dengan lot demo, beserta lot yang seharusnya. */
const RECORD_FIXES = [
  { alat: 'CLEVER1', tanggal: '2026-09-12', level: 'Kontrol', fromLot: 'CC1-2024-001', toLot: 'TD26B3060-G0R' },
  { alat: 'CLEVER2', tanggal: '2026-07-09', level: 'Kontrol', fromLot: 'CC2-2024-001', toLot: 'TD25G310U-G0R' },
];

function statusFor(value, cfg) {
  if (!cfg || !cfg.sd) return 'ok';
  const z = (value - cfg.mean) / cfg.sd;
  return Math.abs(z) > 3 ? 'oos' : Math.abs(z) > 2 ? 'warning' : 'ok';
}

function fmtParams(params) {
  return Object.entries(params || {}).map(([k, v]) => `${k}=${v}`).join(' ');
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('❌ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY tidak ditemukan di .env.local');
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log(APPLY ? '🔧 MODE APPLY\n' : '🔍 MODE DRY-RUN (tambahkan --apply untuk menulis)\n');

  // --- 1. Config terbaru -------------------------------------------------
  const { data: cfgRows, error: cfgErr } = await sb
    .from('lot_config')
    .select('id,config,updated_at')
    .order('updated_at', { ascending: false })
    .limit(1);
  if (cfgErr) throw cfgErr;
  if (!cfgRows || cfgRows.length === 0) throw new Error('lot_config kosong');
  const current = cfgRows[0];
  const config = current.config;

  console.log(`Config terbaru: id=${current.id} (${current.updated_at})`);
  for (const key of ['CLEVER1', 'CLEVER2']) {
    const lots = config[key] || [];
    console.log(`  ${key}: ${lots.map((l) => `${l.lot} ${l?.Kontrol?.GDA?.mean ?? '?'}±${l?.Kontrol?.GDA?.sd ?? '?'} exp ${l.exp}`).join(' | ') || '(kosong)'}`);
  }

  const newConfig = {
    ...config,
    CLEVER1: (config.CLEVER1 || []).filter((l) => !DEMO_LOTS.includes(l.lot)),
    CLEVER2: (config.CLEVER2 || []).filter((l) => !DEMO_LOTS.includes(l.lot)),
  };
  const removedC1 = (config.CLEVER1 || []).length - newConfig.CLEVER1.length;
  const removedC2 = (config.CLEVER2 || []).length - newConfig.CLEVER2.length;
  console.log(`\n→ Hapus dari config: CLEVER1 ${removedC1} baris, CLEVER2 ${removedC2} baris`);

  // Siapkan target dari lot yang akan tetap ada, untuk hitung ulang status.
  const targetFor = (alat, lot) => {
    const found = (newConfig[alat] || []).find((l) => l.lot === lot);
    return found?.Kontrol?.GDA ?? null;
  };

  // --- 2. Record ---------------------------------------------------------
  console.log('\nRecord yang dikoreksi:');
  const updates = [];
  for (const fix of RECORD_FIXES) {
    const { data: recs, error } = await sb
      .from('qc_records')
      .select('id,alat,tanggal,level,lot,params,status,excluded')
      .eq('alat', fix.alat)
      .eq('tanggal', fix.tanggal)
      .eq('level', fix.level);
    if (error) throw error;

    const rec = (recs || []).find((r) => r.lot === fix.fromLot);
    if (!rec) {
      console.log(`  ⚠️  ${fix.alat} ${fix.tanggal}: tidak ada record dengan lot ${fix.fromLot} — dilewati`);
      continue;
    }

    const gda = rec.params?.GDA;
    const target = targetFor(fix.alat, fix.toLot);
    if (!target) {
      console.log(`  ⚠️  ${fix.alat} ${fix.tanggal}: lot tujuan ${fix.toLot} tidak ada di config — dilewati`);
      continue;
    }

    const newStatus = { ...(rec.status || {}) };
    if (typeof gda === 'number') newStatus.GDA = statusFor(gda, target);
    const oldStatus = rec.status?.GDA ?? '?';
    const z = typeof gda === 'number' ? ((gda - target.mean) / target.sd).toFixed(2) : '?';

    console.log(`  • ${fix.alat} ${fix.tanggal} ${fix.level}  ${fmtParams(rec.params)}`);
    console.log(`      lot ${fix.fromLot} → ${fix.toLot}`);
    console.log(`      GDA status ${oldStatus} → ${newStatus.GDA}  (z = ${z} terhadap ${target.mean}±${target.sd})`);

    updates.push({ id: rec.id, lot: fix.toLot, status: newStatus });
  }

  // --- 3. Sisa pemakai lot demo ------------------------------------------
  const { data: stragglers } = await sb
    .from('qc_records')
    .select('id,alat,tanggal,lot')
    .in('lot', DEMO_LOTS);
  const remaining = (stragglers || []).filter((r) => !updates.some((u) => u.id === r.id));
  if (remaining.length > 0) {
    console.log('\n⚠️  Masih ada record lain yang memakai lot demo:');
    for (const r of remaining) console.log(`   ${r.tanggal} ${r.alat} lot=${r.lot}`);
  } else {
    console.log('\n✓ Tidak ada record lain yang memakai lot demo.');
  }

  const configChanged = removedC1 + removedC2 > 0;
  if (!configChanged && updates.length === 0) {
    console.log('\nTidak ada yang perlu diubah.');
    return;
  }

  if (!APPLY) {
    console.log('\nDry-run selesai. Jalankan dengan --apply untuk menulis.');
    return;
  }

  // --- 4. Tulis ----------------------------------------------------------
  if (updates.length > 0) {
    for (const u of updates) {
      const { error } = await sb.from('qc_records').update({ lot: u.lot, status: u.status }).eq('id', u.id);
      if (error) throw new Error(`update ${u.id}: ${error.message}`);
    }
    console.log(`\n✓ ${updates.length} record diperbarui.`);
  }

  if (configChanged) {
    const { data: auth } = await sb.auth.getUser();
    const { error } = await sb.from('lot_config').insert({
      config: newConfig,
      updated_at: new Date().toISOString(),
      updated_by: auth?.user?.id ?? null,
    });
    if (error) throw new Error(`insert lot_config: ${error.message}`);
    console.log('✓ Config baru disimpan (baris lot_config baru, riwayat tetap utuh).');
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
