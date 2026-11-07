# Google Apps Script — Dashboard Lab 2026

**Tanggal update:** 7 November 2026  
**Endpoint:** `VITE_GAS_KUNJUNGAN_URL`  
**Perubahan:** Kolom `BRI (PG)` dan `AJ INHEALTH PLUS` dipetakan terpisah; layout 10 payer, total kunjungan di AJ, target di AK, capaian di AL.

```javascript
/**
 * APPS SCRIPT — Dashboard Lab RS 2026
 * Versi: AUTO BULAN — URL tidak perlu diganti setiap bulan
 * Update: 7 November 2026 — sinkronisasi kolom payer baru.
 */

const SH = {
  OMZET: 'OMZET 2026',
  KUNJUNGAN: 'KUNJUNGAN 2026',
  MCU: 'OMZET MCU 2026',
};

const MONTH_NUM = {
  JAN:1, FEB:2, MAR:3, APR:4,
  MEI:5, JUN:6, JUL:7, AGS:8, AGU:8, SEP:9, OKT:10, NOV:11, DES:12,
  JANUARI:1, FEBRUARI:2, MARET:3, APRIL:4, MEI:5, JUNI:6, JULI:7,
  AGUSTUS:8, SEPTEMBER:9, OKTOBER:10, NOVEMBER:11, DESEMBER:12,
};

function _getMonthName(cellVal) {
  if (!cellVal) return null;
  if (cellVal instanceof Date) {
    const names = [
      'JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI',
      'JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'
    ];
    return names[cellVal.getMonth()];
  }
  const first = String(cellVal).trim().toUpperCase().split(/\s+/)[0];
  return MONTH_NUM[first] ? first : null;
}

function _scanSheetForMonths(ss, sheetName, totalCol, hasil) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const vals = sheet.getDataRange().getValues();
  for (let i = 0; i < vals.length; i++) {
    const bulan = _getMonthName(vals[i][0]);
    if (!bulan) continue;
    let punyaData = false;
    for (let j = i + 1; j < Math.min(i + 40, vals.length); j++) {
      const dayRaw = vals[j][0];
      const bulanLagi = _getMonthName(dayRaw);
      if (bulanLagi) break;
      const dayStr = String(dayRaw).trim();
      if (!dayStr || dayStr.toUpperCase() === 'TOTAL') break;
      const totVal = Number(vals[j][totalCol]);
      if (!isNaN(Number(dayStr)) && totVal > 0) { punyaData = true; break; }
    }
    if (punyaData && !hasil.includes(bulan)) hasil.push(bulan);
  }
}

function deteksiBulanTersedia(ss) {
  const hasil = [];
  _scanSheetForMonths(ss, SH.OMZET, 11, hasil);     // col L = total omzet
  _scanSheetForMonths(ss, SH.KUNJUNGAN, 35, hasil); // col AJ = total kunjungan
  hasil.sort((a, b) => (MONTH_NUM[a] || 99) - (MONTH_NUM[b] || 99));
  return hasil.length ? hasil : ['JANUARI'];
}

function deteksiBuilanAktif(ss) {
  const list = deteksiBulanTersedia(ss);
  return list[list.length - 1];
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'getSummary';
  let result;
  try {
    if (action === 'getSummary') result = getSummary();
    else if (action === 'allData') result = getAllMonths();
    else if (action === 'getKumulatif') result = getKumulatif();
    else if (action === 'ping') result = { status: 'ok', ts: new Date().toISOString() };
    else result = { error: 'Unknown action: ' + action };
  } catch (err) {
    result = { error: err.message, stack: err.stack };
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const bulanAktif = deteksiBuilanAktif(ss);
  const bulanList = deteksiBulanTersedia(ss);
  const allOmzet = {}, allKunjungan = {}, allMcu = {};
  bulanList.forEach(bln => {
    allOmzet[bln] = parseOmzet(ss, bln);
    allKunjungan[bln] = parseKunjungan(ss, bln);
    allMcu[bln] = parseMcu(ss, bln);
  });
  return {
    lastUpdated: new Date().toISOString(),
    currentMonth: bulanAktif,
    omzetHarian: allOmzet[bulanAktif],
    kunjunganHarian: allKunjungan[bulanAktif],
    allOmzet,
    allKunjungan,
    allMcu,
  };
}

function parseOmzet(ss, bulan) {
  const sheet = ss.getSheetByName(SH.OMZET);
  if (!sheet) return [];
  const vals = sheet.getDataRange().getValues();
  let startRow = -1;
  for (let i = 0; i < vals.length; i++) {
    const v = _getMonthName(vals[i][0]);
    if (v && v === bulan) { startRow = i + 1; break; }
  }
  if (startRow < 0) return [];

  const rows = [];
  for (let i = startRow; i < vals.length; i++) {
    const v = String(vals[i][0]).trim();
    if (!v || v.toUpperCase() === 'TOTAL' || _getMonthName(vals[i][0])) break;
    if (isNaN(Number(v))) break;
    const d = parseInt(v, 10);
    const r = vals[i];
    const tot = Number(r[11]) || 0;
    const tgt = Number(r[12]) || 0;
    const capt = Number(r[13]) || 0;
    rows.push({
      d,
      petrokimia: Number(r[1]) || 0,
      perusahaan: Number(r[2]) || 0,
      bri: Number(r[3]) || 0,
      inhealth: Number(r[4]) || 0,
      asuransi: Number(r[5]) || 0,
      prokMurni: Number(r[6]) || 0,
      prokBpjs: Number(r[7]) || 0,
      bpjsKes: Number(r[8]) || 0,
      bpjsTK: Number(r[9]) || 0,
      umum: Number(r[10]) || 0,
      total: tot,
      target: tgt,
      pct: tot > 0 ? (capt < 10 ? Math.round(capt * 100) : Math.round(capt)) : 0,
    });
  }
  return rows;
}

function parseKunjungan(ss, bulan) {
  const sheet = ss.getSheetByName(SH.KUNJUNGAN);
  if (!sheet) return [];
  const vals = sheet.getDataRange().getValues();
  const targetMonth = MONTH_NUM[bulan] || 1;
  let startRow = -1;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i][0];
    if (v instanceof Date && v.getMonth() + 1 === targetMonth) { startRow = i + 2; break; }
    if (String(v).trim().toUpperCase() === bulan) { startRow = i + 2; break; }
  }
  if (startRow < 0) return [];

  const rows = [];
  for (let i = startRow; i < vals.length; i++) {
    const v = String(vals[i][0]).trim();
    if (!v || v.toUpperCase() === 'TOTAL' || vals[i][0] instanceof Date) break;
    if (isNaN(Number(v))) break;
    const d = parseInt(v, 10);
    const r = vals[i];
    const g = c => Number(r[c]) || 0;
    const tot = g(35);
    const capt = g(37);
    rows.push({
      d,
      rj_petrokimia: g(1),
      rj_perusahaan: g(2),
      rj_bri: g(3),
      rj_inhealth: g(4),
      rj_asuransi: g(5),
      rj_prokMurni: g(6),
      rj_prokBpjs: g(7),
      rj_bpjsKes: g(8),
      rj_bpjsTK: g(9),
      rj_tunai: g(10),
      rjTotal: [1,2,3,4,5,6,7,8,9,10].reduce((s, c) => s + g(c), 0),
      ri_bpjsKes: g(18),
      riTotal: [11,12,13,14,15,16,17,18,19,20].reduce((s, c) => s + g(c), 0),
      igdTotal: [21,22,23,24,25,26,27,28,29,30].reduce((s, c) => s + g(c), 0),
      mcuTotal: [31,32,33,34].reduce((s, c) => s + g(c), 0),
      total: tot,
      target: g(36),
      pct: tot > 0 ? (capt < 10 ? Math.round(capt * 100) : Math.round(capt)) : 0,
    });
  }
  return rows;
}

function parseMcu(ss, bulan) {
  const sheet = ss.getSheetByName(SH.MCU);
  if (!sheet) return [];
  const vals = sheet.getDataRange().getValues();
  if (vals.length < 2) return [];
  let bulanCol = -1;
  const headerRow = vals[1];
  const bulanUpper = String(bulan).trim().toUpperCase();
  for (let col = 0; col < headerRow.length; col++) {
    const hv = String(headerRow[col]).trim().toUpperCase();
    if (MONTH_NUM[hv] && MONTH_NUM[bulanUpper] && MONTH_NUM[hv] === MONTH_NUM[bulanUpper]) {
      bulanCol = col;
      break;
    }
  }
  if (bulanCol < 0) return [];
  const rows = [];
  for (let i = 2; i < vals.length; i++) {
    const tglVal = vals[i][0];
    if (!tglVal || tglVal === '') break;
    const d = parseInt(tglVal, 10);
    if (isNaN(d)) break;
    rows.push({ d, omzet: Number(vals[i][bulanCol]) || 0 });
  }
  return rows;
}

function getKumulatif() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('OMSET HARIAN 2026');
  if (!sheet) return { error: 'Sheet OMSET HARIAN 2026 tidak ditemukan' };
  const vals = sheet.getDataRange().getValues();
  const bulan = deteksiBuilanAktif(ss);
  const BMAP = {
    JAN:'JANUARI', FEB:'FEBRUARI', MAR:'MARET', APR:'APRIL', APRIL:'APRIL',
    MEI:'MEI', JUN:'JUNI', JUNI:'JUNI', JUL:'JULI', JULI:'JULI',
    AGS:'AGUSTUS', AGU:'AGUSTUS', SEP:'SEPTEMBER',
    OKT:'OKTOBER', NOV:'NOVEMBER', DES:'DESEMBER',
  };
  const cari = BMAP[bulan] || bulan;
  let blockStart = -1;
  for (let i = 0; i < vals.length; i++) {
    const v = String(vals[i][0] || '').trim().toUpperCase();
    if (v.startsWith(cari)) { blockStart = i + 2; break; }
  }
  if (blockStart < 0) return { error: 'Bulan ' + bulan + ' tidak ditemukan di OMSET HARIAN 2026' };

  let kumOmzet = 0, kumKunj = 0, tglAkhir = 0;
  let targetOmzetHarian = 0, targetKunjHarian = 0;
  let targetOmzetBulan = 0, targetKunjBulan = 0;
  for (let i = blockStart; i < vals.length; i++) {
    const v0 = String(vals[i][0] || '').trim().toUpperCase();
    if (v0 === 'TARGET REAL') {
      targetOmzetBulan = Number(vals[i][2]) || targetOmzetBulan;
      targetKunjBulan = Number(vals[i][6]) || targetKunjBulan;
      break;
    }
    if (v0 === 'TOTAL') continue;
    const tgl = Number(vals[i][1]);
    const tgtH = Number(vals[i][2]) || 0;
    const omz = Number(vals[i][3]) || 0;
    const kunj = Number(vals[i][5]) || 0;
    const tgtK = Number(vals[i][6]) || 0;
    if (!tgl || isNaN(tgl)) break;
    if (omz > 0) {
      kumOmzet += omz;
      kumKunj += kunj;
      tglAkhir = Math.round(tgl);
    }
    if (tgtH > targetOmzetHarian) targetOmzetHarian = tgtH;
    if (tgtK > targetKunjHarian) targetKunjHarian = tgtK;
  }
  return {
    bulan,
    tglAkhir,
    kumOmzet: Math.round(kumOmzet),
    kumKunj: Math.round(kumKunj),
    targetOmzetHarian: Math.round(targetOmzetHarian),
    targetKunjHarian: Math.round(targetKunjHarian),
    targetOmzetBulan: Math.round(targetOmzetBulan),
    targetKunjBulan: Math.round(targetKunjBulan),
  };
}

function testRun() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const bulan = deteksiBuilanAktif(ss);
  Logger.log('Bulan aktif: ' + bulan);
  Logger.log('Semua bulan: ' + deteksiBulanTersedia(ss).join(', '));
  Logger.log('Omzet rows: ' + parseOmzet(ss, bulan).length);
  Logger.log('Kunjungan rows: ' + parseKunjungan(ss, bulan).length);
  Logger.log('MCU rows: ' + parseMcu(ss, bulan).length);
}

function testKumulatif() {
  const res = getKumulatif();
  Logger.log(JSON.stringify(res, null, 2));
}
```

## Perubahan kolom

- `OMZET 2026`: payer B:K, total L (`r[11]`), target M (`r[12]`), capaian N (`r[13]`).
- `KUNJUNGAN 2026`: RJ B:K, RI L:U, IGD V:AE, MCU AF:AI, total AJ (`r[35]`), target AK (`r[36]`), capaian AL (`r[37]`).
- `MAPPING PENJAMIN` tidak dipakai; nama/badge tetap mengikuti mapping aplikasi web.

## Deploy

Paste kode ini ke project Apps Script yang melayani `VITE_GAS_KUNJUNGAN_URL`, lalu deploy versi baru pada deployment yang sama. Verifikasi `getSummary` berisi `bri` dan `inhealth`, dan cocokkan nilai dengan kolom D/E pada `OMZET 2026`.
