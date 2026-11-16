#!/usr/bin/env node
/**
 * Analyze QC Excel 2026 workbooks — parse + report anomalies, no DB writes.
 * Usage: node scripts/analyze-qc-excel.cjs [paths...]
 */
const XLSX = require('xlsx');

const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
function d2s(s){ if(typeof s!=='number')return null; const d=new Date(EXCEL_EPOCH+s*86400000); return d.toISOString().slice(0,10); }

/** Parse a control range like "9.1 - 12.3" / "3,5-4,1" -> {mean, sd, min, max} */
function parseRange(v){
  if(!v) return null;
  let s=String(v).replace(/\s+/g,'').replace(/,/g,'.').replace(/–/g,'-').replace(/—/g,'-');
  const m=s.match(/^(-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)$/);
  if(!m) return {raw:s, bad:true};
  const min=parseFloat(m[1]), max=parseFloat(m[2]);
  return { min, max, mean:(min+max)/2, sd:(max-min)/4, bad:false };
}

/** Parse a numeric value cell; comma decimal, '..' typo, slash "140,3/139,6" -> first */
function num(v){
  if(v===null||v===undefined) return null;
  if(typeof v==='number') return v;
  const s=String(v).trim();
  if(s===''||s==='-') return null;
  let t=s.replace(/\.\./g,'.').replace(/,/g,'.').split('/')[0].trim();
  const p=parseFloat(t);
  return isNaN(p)? null : p;
}

const warnings = [];
function warn(msg){ warnings.push(msg); }

// ─── CA-660 ──────────────────────────────────────────────────────────────────
function parseCA660(path){
  const wb=XLSX.readFile(path);
  const out=[];
  const months=['JAN 2026','FEB 2026','MAR 2026','APR 2026','MEI 2026','JUNI 2026','JULI 2026','AGUSTUS 2026','SEPTEMBER 2026','OKTOBER 2026','NOVEMBER 2026'];
  for(const sheetName of months){
    const sh=wb.Sheets[sheetName];
    if(!sh){ warn(`CA660: sheet ${sheetName} tidak ada`); continue; }
    const rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:null});
    // detect lot sub-sections (row whose col0 starts with "KONTROL LOT")
    const lotRows=[];
    rows.forEach((r,i)=>{ if(r && typeof r[0]==='string' && /KONTROL LOT/i.test(r[0])) lotRows.push({i, lot:(r[0].match(/KONTROL LOT\s+(\S+)/)||[])[1]}); });
    let curLot=null, curHeader=false;
    for(let i=0;i<rows.length;i++){
      const r=rows[i];
      if(!r) continue;
      const lotHit=lotRows.find(L=>L.i===i);
      if(lotHit){ curLot=lotHit.lot; continue; } // CA-660: lot change mid-month, no new header row
      if(r[0]==='TANGGAL'){ curHeader=true; continue; }
      if(!curHeader || typeof r[0]!=='number') continue;
      const tanggal=d2s(r[0]); if(!tanggal) continue;
      const fields={ PT:r[1], PTr:r[2], INR:r[3], INRr:r[4], APTT:r[5], APTTr:r[6], D1:r[7], D2:r[9] };
      const params={}, status={};
      for(const [p,val,rn] of [['PT',fields.PT,fields.PTr],['INR',fields.INR,fields.INRr],['APTT',fields.APTT,fields.APTTr]]){
        const v=num(val); if(v===null) continue;
        const rg=parseRange(rn);
        if(!rg||rg.bad){ warn(`CA660 ${tanggal} ${p}: range tidak valid "${rn}"`); continue; }
        params[p]=v;
        const z=rg.sd>0 ? (v-rg.mean)/rg.sd : 0;
        status[p]= Math.abs(z)>3 ? 'oos' : Math.abs(z)>2 ? 'warning' : 'ok';
      }
      if(Object.keys(params).length===0) continue;
      out.push({ tanggal, alat:'CA660', level:'Kontrol', lot:curLot, params, status,
        D1:num(fields.D1), D2:num(fields.D2), catatan:'' });
    }
  }
  return out;
}

// ─── Easylite ────────────────────────────────────────────────────────────────
function parseEasylite(path){
  const wb=XLSX.readFile(path);
  const out=[];
  for(const sheetName of wb.SheetNames){
    const sh=wb.Sheets[sheetName];
    const rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:null});
    // lots come in "LOT <n> | LOT <m>" pairs (col0 normal, col7 high)
    const lotRows=[];
    rows.forEach((r,i)=>{ if(r && typeof r[0]==='string' && /^LOT\s/i.test(String(r[0]).trim())) lotRows.push({i, n:(String(r[0]).match(/LOT\s+(\S+)/)||[])[1], h:(String(r[7]||'').match(/LOT\s+(\S+)/)||[])[1]}); });
    let cur={n:null,h:null}, curHeader=false;
    const rangeCache={}; // level|param -> last valid range (fallback for typos like "3.6")
    function getRange(key, raw){
      const rg=parseRange(raw);
      if(rg && !rg.bad){ rangeCache[key]=rg; return rg; }
      if(rangeCache[key]){ warn(`EL ${sheetName} ${key}: range "${raw}" tidak valid, pakai fallback "${rangeCache[key].min}-${rangeCache[key].max}"`); return rangeCache[key]; }
      warn(`EL ${sheetName} ${key}: range tidak valid "${raw}" (tanpa fallback)`);
      return null;
    }
    for(let i=0;i<rows.length;i++){
      const r=rows[i];
      if(!r) continue;
      const hit=lotRows.find(L=>L.i===i);
      if(hit){ cur={n:hit.n,h:hit.h}; for(const k of Object.keys(rangeCache)) delete rangeCache[k]; continue; } // lot change mid-month (ranges change per lot)
      if(r[0]==='TANGGAL'){ curHeader=true; continue; }
      if(!curHeader || typeof r[0]!=='number') continue;
      const tanggal=d2s(r[0]); if(!tanggal) continue;
      // NORMAL: Na col1/2, K col3/4, Cl col5/6 ; HIGH: col7/8, 9/10, 11/12
      const groups=[ ['NORMAL',cur.n,[1,2],[3,4],[5,6]], ['HIGH',cur.h,[7,8],[9,10],[11,12]] ];
      for(const [level,lot,[nai,kai],[kbi,kri],[cli,clri]] of groups){
        const rec={ tanggal, alat:'EASYLITE', level, lot, params:{}, status:{} };
        for(const [p,vi,ri] of [['Na',nai,kai],['K',kbi,kri],['Cl',cli,clri]]){
          const v=num(r[vi]); if(v===null) continue;
          const rg=getRange(level+'|'+p, r[ri]);
          if(!rg) continue;
          rec.params[p]=v;
          const z=rg.sd>0 ? (v-rg.mean)/rg.sd : 0;
          rec.status[p]= Math.abs(z)>3 ? 'oos' : Math.abs(z)>2 ? 'warning' : 'ok';
        }
        if(Object.keys(rec.params).length===0) continue;
        const cat=String(r[13]||'').trim();
        rec.catatan = cat==='OK' ? '' : cat; // keep only meaningful notes
        out.push(rec);
      }
    }
  }
  return out;
}

function summarize(recs, label){
  console.log(`\n===== ${label}: ${recs.length} records`);
  const byMonth={};
  for(const r of recs){ const m=r.tanggal.slice(0,7); byMonth[m]=byMonth[m]||0; byMonth[m]++; }
  for(const m of Object.keys(byMonth).sort()) console.log(`  ${m}: ${byMonth[m]}`);
  const lots=new Set(recs.map(r=>r.alat+':'+r.lot));
  console.log('  lots:', [...lots].sort().join(', '));
  // status counts
  const st={ok:0,warning:0,oos:0};
  for(const r of recs) for(const k of Object.keys(r.status)) st[r.status[k]]=(st[r.status[k]]||0)+1;
  console.log('  status cells:', JSON.stringify(st));
}

const paths = process.argv.slice(2);
const caPath = paths.find(p=>/KOAGULASI|CA-?660/i.test(p));
const elPath = paths.find(p=>/EASYLYTE/i.test(p));

const ca = caPath ? parseCA660(caPath) : [];
const el = elPath ? parseEasylite(elPath) : [];

summarize(ca,'CA-660');
summarize(el,'Easylite');

console.log('\n===== D-Dimer (CA-660, kolom terpisah, TIDAK diimpor):');
const dd={}; ca.forEach(r=>{ if(r.D1!=null||r.D2!=null){ const k=r.tanggal; dd[k]=dd[k]||{}; if(r.D1!=null)dd[k].D1=r.D1; if(r.D2!=null)dd[k].D2=r.D2; }});
console.log('  jumlah tanggal dengan nilai D-Dimer:', Object.keys(dd).length);

console.log('\n===== TITIK DI LUAR 2SD (warning) / 3SD (oos):');
const flagged=[];
for(const r of [...ca,...el]){
  for(const [p,s] of Object.entries(r.status)){
    if(s==='ok') continue;
    flagged.push(`${r.tanggal} ${r.alat === 'CA660' ? 'CA-660' : 'Easylite'} ${r.level} ${p}=${r.params[p]} -> ${s.toUpperCase()}`);
  }
}
flagged.forEach(f=>console.log('  • '+f));

console.log('\n===== PERINGATAN PARSER:');
if(warnings.length===0) console.log('  (tidak ada)');
warnings.slice(0,120).forEach(w=>console.log('  ⚠️ '+w));
if(warnings.length>120) console.log(`  ... +${warnings.length-120} lainnya`);

// export JSON for later use
require('fs').writeFileSync('/tmp/qc-parse-ca660.json', JSON.stringify(ca));
require('fs').writeFileSync('/tmp/qc-parse-easylite.json', JSON.stringify(el));
console.log('\nJSON dump -> /tmp/qc-parse-*.json');
