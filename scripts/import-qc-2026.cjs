#!/usr/bin/env node
/**
 * Import QC 2026 (CA-660 & Easylite) dari Excel ke Supabase.
 *
 * Cakupan: Januari–November 2026 (menimpa data CA-660/Easylite yang sudah ada).
 * Selain record, skrip ini juga menulis ulang lot_config untuk CA-660 & EASYLITE
 * dengan target (mean/SD) asli per lot, dihitung dari rentang kontrol di Excel.
 *
 * D-Dimer (kolom D1/D2) sengaja DILEWATI — aplikasi belum mendukung parameter itu.
 *
 * Usage:
 *   node scripts/import-qc-2026.cjs                          # dry-run (tidak menulis)
 *   node scripts/import-qc-2026.cjs --apply                  # tulis ke Supabase
 *   node scripts/import-qc-2026.cjs --excluded-only          # hanya set flag excluded
 */

const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

const APPLY = process.argv.includes('--apply');
// Hanya tandai ulang flag `excluded` (dipakai setelah migrasi 004 dijalankan di DB,
// tanpa perlu menghapus & mengimpor ulang 947 record).
const EXCLUDED_ONLY = process.argv.includes('--excluded-only');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://tpyocjcjoucyymsptbbw.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRweW9jamNqb3VjeXltc3B0YmJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDAzOTMsImV4cCI6MjA5NDA3NjM5M30.d4HIKDyv5VtGPYc2yzVOexsWoU39MCAfGgk3L1ECziM';

const CA_PATH = '/Users/rama/Downloads/QC KOAGULASI 2026 (CA-660)-2.xlsx';
const EL_PATH = '/Users/rama/Downloads/QC EASYLYTE 2026-2.xlsx';

const IMPORT_FROM = '2026-01-01'; // full year 2026 (Jan–Nov) — overwrites prior import

// Titik yang ditandai excluded (gross error / tidak dipakai statistik)
const EXCLUDED_POINTS = new Set([
  'EASYLITE|2026-10-07|NORMAL|K', // K=3.1, z=-4.0
]);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
function d2s(s){ if(typeof s!=='number') return null; const d=new Date(EXCEL_EPOCH+s*86400000); return d.toISOString().slice(0,10); }

function rangeToMeanSd(min, max){
  return { mean: +((min+max)/2).toFixed(4), sd: +((max-min)/4).toFixed(4) };
}
function parseRange(v){
  if(!v) return null;
  const s=String(v).replace(/\s+/g,'').replace(/,/g,'.').replace(/–/g,'-').replace(/—/g,'-');
  const m=s.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
  if(!m) return null;
  return rangeToMeanSd(parseFloat(m[1]), parseFloat(m[2]));
}
function num(v){
  if(v===null||v===undefined) return null;
  if(typeof v==='number') return v;
  const s=String(v).trim();
  if(s===''||s==='-') return null;
  let t=s.replace(/\.\./g,'.').replace(/,/g,'.').split('/')[0].trim();
  const p=parseFloat(t);
  return isNaN(p)? null : p;
}
function statusFor(v, cfg){ const z=cfg.sd>0 ? (v-cfg.mean)/cfg.sd : 0; return Math.abs(z)>3 ? 'oos' : Math.abs(z)>2 ? 'warning' : 'ok'; }

// ─── Per-lot target config (mean/SD dari rentang kontrol Excel) ─────────────
// exp ditaksir = akhir bulan terakhir lot dipakai + 1 bulan.
const CA660_CONFIG = {
  '507920': { exp:'2026-02-28', PT:[9.1,12.3], INR:[0.80,1.20], APTT:[22.0,29.8] },
  '507929': { exp:'2026-08-31', PT:[9.1,12.3], INR:[0.80,1.20], APTT:[22.0,29.8] },
  '507973': { exp:'2026-09-30', PT:[9.2,12.4], INR:[0.81,1.21], APTT:[21.8,29.4] },
  '507974': { exp:'2026-12-31', PT:[9.2,12.4], INR:[0.80,1.20], APTT:[21.8,29.4] },
};
const EL_NORMAL_CONFIG = {
  '224348': { exp:'2026-02-28', Na:[135,145], K:[3.4,4.0], Cl:[98,108] },
  '25119':  { exp:'2026-03-31', Na:[135,145], K:[3.5,4.1], Cl:[100,110] },
  '25289':  { exp:'2026-08-31', Na:[134,144], K:[3.4,4.0], Cl:[97,107] },
  '26043':  { exp:'2026-11-30', Na:[133,143], K:[3.4,4.0], Cl:[99,109] },
  '26193':  { exp:'2026-12-31', Na:[133,143], K:[3.5,4.1], Cl:[97,107] },
};
const EL_HIGH_CONFIG = {
  '224348': { exp:'2026-02-28', Na:[152,162], K:[5.4,6.0], Cl:[119,129] },
  '25126':  { exp:'2026-03-31', Na:[152,162], K:[5.5,6.1], Cl:[120,130] },
  '25294':  { exp:'2026-08-31', Na:[152,162], K:[5.4,6.0], Cl:[119,129] },
  '26048':  { exp:'2026-11-30', Na:[147,157], K:[5.4,6.0], Cl:[116,126] },
  '26210':  { exp:'2026-12-31', Na:[151,161], K:[5.5,6.1], Cl:[119,129] },
};

function buildCA660Lots(){
  return Object.entries(CA660_CONFIG).map(([lot, c])=>({
    lot, exp: c.exp,
    Kontrol: {
      PT: rangeToMeanSd(c.PT[0], c.PT[1]),
      INR: rangeToMeanSd(c.INR[0], c.INR[1]),
      APTT: rangeToMeanSd(c.APTT[0], c.APTT[1]),
    },
  }));
}
function buildEasyliteLots(){
  const NORMAL = Object.entries(EL_NORMAL_CONFIG).map(([lot,c])=>({
    lot, exp:c.exp, params:{
      Na: rangeToMeanSd(c.Na[0],c.Na[1]),
      K:  rangeToMeanSd(c.K[0],c.K[1]),
      Cl: rangeToMeanSd(c.Cl[0],c.Cl[1]),
    },
  }));
  const HIGH = Object.entries(EL_HIGH_CONFIG).map(([lot,c])=>({
    lot, exp:c.exp, params:{
      Na: rangeToMeanSd(c.Na[0],c.Na[1]),
      K:  rangeToMeanSd(c.K[0],c.K[1]),
      Cl: rangeToMeanSd(c.Cl[0],c.Cl[1]),
    },
  }));
  return { NORMAL, HIGH };
}

// ─── Typo fix (spesifik titik, diverifikasi dari sumber) ────────────────────
const FIXES = {
  'CA660|2026-10-02|PT': 10.5,   // sumber tertulis 105 → 10.5
  'EASYLITE|2026-09-25|NORMAL|K': 3.6, // sumber tertulis 136 → 3.6 (desimal hilang)
};
function applyFix(alat, tanggal, level, param, v){
  const k = level ? `${alat}|${tanggal}|${level}|${param}` : `${alat}|${tanggal}|${param}`;
  return FIXES[k] ?? v;
}

// ─── Parsers ────────────────────────────────────────────────────────────────
function parseCA660(path){
  const wb=XLSX.readFile(path);
  const out=[];
  const months=['JAN 2026','FEB 2026','MAR 2026','APR 2026','MEI 2026','JUNI 2026','JULI 2026','AGUSTUS 2026','SEPTEMBER 2026','OKTOBER 2026','NOVEMBER 2026'];
  for(const sheetName of months){
    const sh=wb.Sheets[sheetName]; if(!sh) continue;
    const rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:null});
    let curLot=null, curHeader=false;
    for(let i=0;i<rows.length;i++){
      const r=rows[i]; if(!r) continue;
      const lm = typeof r[0]==='string' && r[0].match(/KONTROL LOT\s+(\S+)/);
      if(lm){ curLot=lm[1]; continue; }
      if(r[0]==='TANGGAL'){ curHeader=true; continue; }
      if(!curHeader || typeof r[0]!=='number') continue;
      const tanggal=d2s(r[0]); if(!tanggal) continue;
      const params={}, status={};
      for(const [p,vi,ri] of [['PT',1,2],['INR',3,4],['APTT',5,6]]){
        let v=num(r[vi]); if(v===null) continue;
        v=applyFix('CA660', tanggal, null, p, v);
        const rg=parseRange(r[ri]); if(!rg) continue;
        params[p]=v; status[p]=statusFor(v, rg);
      }
      if(Object.keys(params).length===0) continue;
      out.push({ tanggal, alat:'CA660', level:'Kontrol', lot:curLot, params, status });
    }
  }
  return out;
}

function parseEasylite(path){
  const wb=XLSX.readFile(path);
  const out=[];
  for(const sheetName of wb.SheetNames){
    const sh=wb.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:null});
    let cur=null, curHeader=false;
    const rangeCache={};
    for(let i=0;i<rows.length;i++){
      const r=rows[i]; if(!r) continue;
      const lm = typeof r[0]==='string' && /^LOT\s/i.test(String(r[0]).trim());
      if(lm){ cur={ n:(String(r[0]).match(/LOT\s+(\S+)/)||[])[1], h:(String(r[7]||'').match(/LOT\s+(\S+)/)||[])[1] }; for(const k of Object.keys(rangeCache)) delete rangeCache[k]; continue; }
      if(r[0]==='TANGGAL'){ curHeader=true; continue; }
      if(!curHeader || typeof r[0]!=='number') continue;
      const tanggal=d2s(r[0]); if(!tanggal) continue;
      for(const [level,lot,cols] of [['NORMAL',cur.n,[[1,2,'Na'],[3,4,'K'],[5,6,'Cl']]],['HIGH',cur.h,[[7,8,'Na'],[9,10,'K'],[11,12,'Cl']]]]){
        if(!lot) continue;
        const params={}, status={};
        for(const [vi,ri,p] of cols){
          let v=num(r[vi]); if(v===null) continue;
          v=applyFix('EASYLITE', tanggal, level, p, v);
          const key=level+'|'+p;
          let rg=parseRange(r[ri]);
          if(rg){ rangeCache[key]=rg; } else if(rangeCache[key]){ rg=rangeCache[key]; } else { continue; }
          params[p]=v; status[p]=statusFor(v, rg);
        }
        if(Object.keys(params).length===0) continue;
        const cat=String(r[13]||'').trim();
        out.push({ tanggal, alat:'EASYLITE', level, lot, params, status, catatan: cat==='OK' ? '' : cat });
      }
    }
  }
  return out;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main(){
  console.log('=== Import QC 2026 (CA-660 & Easylite) ===\n');
  console.log(
    EXCLUDED_ONLY ? '▶️  MODE EXCLUDED-ONLY — hanya menandai flag excluded\n'
    : APPLY ? '▶️  MODE APPLY — akan menulis ke Supabase'
    : '🔍 DRY-RUN — tidak ada yang ditulis\n');

  const ca = parseCA660(CA_PATH);
  const el = parseEasylite(EL_PATH);

  const caImport = ca.filter(r=>r.tanggal>=IMPORT_FROM);
  const elImport = el.filter(r=>r.tanggal>=IMPORT_FROM);
  const all = [...caImport, ...elImport];

  console.log(`CA-660  : ${ca.length} total di Excel, ${caImport.length} untuk diimpor (Jan–Nov)`);
  console.log(`Easylite: ${el.length} total di Excel, ${elImport.length} untuk diimpor (Jan–Nov)`);
  console.log(`Total   : ${all.length} records\n`);

  // sanity: per bulan
  const byMonth={};
  for(const r of all){ const m=r.tanggal.slice(0,7); byMonth[m]=byMonth[m]||{CA660:0,EASYLITE:0}; byMonth[m][r.alat]++; }
  console.log('Per bulan (CA-660 / Easylite):');
  for(const m of Object.keys(byMonth).sort()) console.log(`  ${m}: ${byMonth[m].CA660} / ${byMonth[m].EASYLITE}`);

  // status summary
  const st={ok:0,warning:0,oos:0};
  for(const r of all) for(const k of Object.keys(r.status)) st[r.status[k]]++;
  console.log('\nStatus sel:', JSON.stringify(st));
  const oos=[];
  for(const r of all) for(const [p,s] of Object.entries(r.status)) if(s!=='ok') oos.push(`${r.tanggal} ${r.alat} ${r.level} ${p}=${r.params[p]} -> ${s.toUpperCase()}`);
  console.log('Titik non-OK (warning/oos):', oos.length);
  oos.forEach(x=>console.log('  • '+x));

  console.log('\nLot_config CA-660 baru:', buildCA660Lots().map(l=>l.lot+' (exp '+l.exp+')').join(', '));
  const elLots=buildEasyliteLots();
  console.log('Lot_config EASYLITE NORMAL baru:', elLots.NORMAL.map(l=>l.lot).join(', '));
  console.log('Lot_config EASYLITE HIGH baru  :', elLots.HIGH.map(l=>l.lot).join(', '));

  if(!APPLY && !EXCLUDED_ONLY) return;

  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 0) Cek apakah kolom `excluded` sudah ada (migrasi 004). Kalau belum,
  //    impor tetap jalan tanpa flag itu — bukan alasan menggagalkan seluruh import.
  let hasExcluded = false;
  {
    const { error } = await sb.from('qc_records').select('excluded').limit(1);
    hasExcluded = !error;
    if (!hasExcluded) {
      console.warn('\n⚠️  Kolom `qc_records.excluded` belum ada di database — jalankan');
      console.warn('    supabase/migrations/004_qc_record_exclusion.sql dulu.');
      console.warn('    Import dilanjutkan TANPA flag excluded.\n');
    }
  }

  // Mode khusus: cukup set flag excluded pada record yang sudah ada.
  if (EXCLUDED_ONLY) {
    if (!hasExcluded) { console.error('❌ Kolom `excluded` belum ada.'); process.exit(1); }
    let n = 0;
    for (const key of EXCLUDED_POINTS) {
      const [alat, tanggal, level, param] = key.split('|');
      const { data, error } = await sb.from('qc_records')
        .select('id,params').eq('alat', alat).eq('tanggal', tanggal).eq('level', level);
      if (error) { console.error('❌ read error:', error.message); process.exit(1); }
      for (const rec of data || []) {
        if (!(param in (rec.params || {}))) continue;
        const { error: upErr } = await sb.from('qc_records').update({ excluded: true }).eq('id', rec.id);
        if (upErr) { console.error('❌ update error:', upErr.message); process.exit(1); }
        n++;
        console.log(`  ✓ ${alat} ${tanggal} ${level} ${param} → excluded`);
      }
    }
    console.log(`\nSelesai. ${n} record ditandai excluded.`);
    return;
  }

  // 1) Hapus data CA-660/Easylite Jan–Nov yang mungkin ada (idempoten)
  const { count: delCount, error: delErr } = await sb.from('qc_records').delete({count:'exact'})
    .in('alat',['CA660','EASYLITE']).gte('tanggal', IMPORT_FROM);
  if(delErr){ console.error('❌ delete error:', delErr.message); process.exit(1); }
  console.log(`\n🗑️  Hapus data Jan–Nov lama: ${delCount} rows`);

  // 2) Insert records
  const rows = all.map(r=>{
    const row = {
      id: uuidv4(),
      timestamp: r.tanggal+'T00:00:00.000Z',
      tanggal: r.tanggal,
      alat: r.alat,
      level: r.level,
      lot: r.lot,
      params: r.params,
      status: r.status,
      analis: 'Migrasi Data',
      catatan: r.catatan || '',
    };
    if (hasExcluded) {
      row.excluded = Object.keys(r.params).some(p =>
        EXCLUDED_POINTS.has(`${r.alat}|${r.tanggal}|${r.level}|${p}`));
    }
    return row;
  });
  let inserted=0;
  for(let i=0;i<rows.length;i+=200){
    const batch=rows.slice(i,i+200);
    const { error } = await sb.from('qc_records').insert(batch);
    if(error){ console.error(`❌ insert batch ${i/200+1} error:`, error.message); process.exit(1); }
    inserted+=batch.length;
  }
  console.log(`📤 Inserted ${inserted} records`);

  // 3) Tulis lot_config baru (pertahankan ONCALL/CLEVER, ganti CA660/EASYLITE)
  const { data: latest, error: cfgErr } = await sb.from('lot_config').select('config').order('updated_at',{ascending:false}).limit(1).single();
  if(cfgErr){ console.error('❌ read lot_config error:', cfgErr.message); process.exit(1); }
  const merged = { ...latest.config, CA660: buildCA660Lots(), EASYLITE: buildEasyliteLots() };
  const { error: insErr } = await sb.from('lot_config').insert({ config: merged });
  if(insErr){ console.error('❌ write lot_config error:', insErr.message); process.exit(1); }
  console.log('⚙️  lot_config ditulis (baris baru, jadi latest)');

  console.log('\n=== Selesai ===');
  console.log(`   CA-660  : ${caImport.length} records`);
  console.log(`   Easylite: ${elImport.length} records`);
}

main().catch(e=>{ console.error('Fatal:', e); process.exit(1); });
