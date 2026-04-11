# Google Apps Script - Input → Sheet LAPORAN KUNJUNGAN HARIAN 2026

## Overview
Script GAS untuk menerima data Input Harian dari frontend dan menulis ke sheet **"LAPORAN KUNJUNGAN HARIAN 2026"** (spreadsheet terpisah dari KUNJUNGAN 2026).

Sheet ini punya **1 tab per bulan** (contoh: "APRIL 2026") dan setiap tanggal punya blok ~58 baris berisi:
- **Tabel Kiri (A-N)**: Laporan Harian Kunjungan per penjamin
- **Tabel Kanan (Q-V)**: Rincian MCU Harian

GAS hanya **paste value** ke kolom data. Kolom TOTAL (O) dan baris jumlah/rekap **tidak ditulis** karena sudah ada formula di spreadsheet.

## Setup

### 1. Buat Project Apps Script Baru (Standalone)
- Buka https://script.google.com → **New project**
- Beri nama: "Input Laporan Harian"

### 2. Paste Kode Berikut

```javascript
// ============================================
// INPUT → SHEET LAPORAN KUNJUNGAN HARIAN 2026
// Portal Lab RS Petrokimia Gresik
// ============================================

// GANTI dengan Spreadsheet ID dari URL Google Sheets
var SPREADSHEET_ID = 'GANTI_DENGAN_SPREADSHEET_ID';

var BULAN_NAMES = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI','JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
var BULAN_NAMES_SHORT = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ─── Entry Points ───

function doPost(e) {
  try {
    var body;
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse({ error: 'No POST data' });
    }
    if (body.action === 'inputLaporan') {
      return handleInputLaporan(body);
    }
    return jsonResponse({ error: 'Unknown action: ' + body.action });
  } catch (err) {
    return jsonResponse({ error: err.message || String(err) });
  }
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'ping') {
    return jsonResponse({ status: 'ok', service: 'laporanHarian' });
  }
  if (action === 'checkDay') {
    return handleCheckDay(e.parameter);
  }
  return jsonResponse({ status: 'ok', service: 'laporanHarian' });
}

// ─── Check Day ───

function handleCheckDay(params) {
  var tanggal = params.tanggal || '';
  var parsed = parseTanggal(tanggal);
  if (!parsed) return jsonResponse({ error: 'Invalid tanggal: ' + tanggal });

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = findMonthSheet(ss, parsed.monthIdx);
  if (!sheet) return jsonResponse({ error: 'Sheet bulan ' + BULAN_NAMES[parsed.monthIdx] + ' tidak ditemukan' });

  var dateRow = findDateRow(sheet, parsed.dayNum, parsed.monthIdx, parsed.year);
  if (dateRow < 0) return jsonResponse({ error: 'Tanggal ' + parsed.dayNum + ' tidak ditemukan di sheet' });

  // Verifikasi: ambil display value dari dateRow
  var dateCell = sheet.getRange(dateRow, 1).getDisplayValue();

  // Cari baris data (setelah header KET,JAMINAN,...)
  var dataStartRow = findDataStartRow(sheet, dateRow);
  if (dataStartRow < 0) return jsonResponse({ status: 'ok', hasData: false, bulan: BULAN_NAMES[parsed.monthIdx], dayNum: parsed.dayNum, debug: { dateRow: dateRow, dateCell: dateCell, dataStartRow: -1 } });

  // Cek apakah ada data di kolom C-N (kolom 3-14)
  var range = sheet.getRange(dataStartRow, 3, 20, 12);
  var values = range.getValues();
  var hasData = false;
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < values[r].length; c++) {
      if (typeof values[r][c] === 'number' && values[r][c] > 0) { hasData = true; break; }
    }
    if (hasData) break;
  }

  return jsonResponse({
    status: 'ok',
    tanggal: tanggal,
    dayNum: parsed.dayNum,
    bulan: BULAN_NAMES[parsed.monthIdx],
    hasData: hasData,
    debug: { dateRow: dateRow, dateCell: dateCell, dataStartRow: dataStartRow }
  });
}

// ─── Handle Input Laporan ───

function handleInputLaporan(body) {
  var tanggal = body.tanggal || '';
  var kunjungan = body.kunjungan || [];
  var mcu = body.mcu || [];
  
  var parsed = parseTanggal(tanggal);
  if (!parsed) return jsonResponse({ error: 'Invalid tanggal: ' + tanggal });

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = findMonthSheet(ss, parsed.monthIdx);
  if (!sheet) return jsonResponse({ error: 'Sheet bulan ' + BULAN_NAMES[parsed.monthIdx] + ' tidak ditemukan' });

  var dateRow = findDateRow(sheet, parsed.dayNum, parsed.monthIdx, parsed.year);
  if (dateRow < 0) return jsonResponse({ error: 'Tanggal ' + parsed.dayNum + ' tidak ditemukan di sheet' });

  // Verifikasi: baris dateRow harus berisi tanggal yang diminta
  var dateCell = sheet.getRange(dateRow, 1).getDisplayValue();

  // Cari baris awal data (baris setelah sub-header "R. JALAN, R. INAP")
  var dataStartRow = findDataStartRow(sheet, dateRow);
  if (dataStartRow < 0) return jsonResponse({ error: 'Header tabel tidak ditemukan untuk tanggal ' + tanggal + ' (dateRow=' + dateRow + ', dateCell=' + dateCell + ')' });

  // Verifikasi: baris dataStartRow-2 harus berisi "KET" di kolom A
  var ketCell = sheet.getRange(dataStartRow - 2, 1).getDisplayValue();
  var firstDataB = sheet.getRange(dataStartRow, 2).getDisplayValue();

  // ── Tulis Tabel Kiri: Laporan Harian per penjamin ──
  writeLaporanData(sheet, dataStartRow, kunjungan);

  // ── Tulis Tabel Kanan: Rincian MCU ──
  writeMcuData(sheet, dataStartRow, mcu);

  return jsonResponse({
    status: 'ok',
    message: 'Data ' + tanggal + ' berhasil ditulis ke Laporan Harian',
    bulan: BULAN_NAMES[parsed.monthIdx],
    hari: parsed.dayNum,
    totalPenjamin: kunjungan.length,
    totalMcu: mcu.length,
    debug: { dateRow: dateRow, dateCell: dateCell, dataStartRow: dataStartRow, ketCell: ketCell, firstDataB: firstDataB }
  });
}

// ─── Tulis data kunjungan per penjamin ke tabel kiri ──

function writeLaporanData(sheet, dataStartRow, kunjungan) {
  // Baca nama penjamin yang sudah ada di kolom B (template)
  // Scan dari dataStartRow sampai ketemu baris TOTAL
  var maxRows = 50;
  var colB = sheet.getRange(dataStartRow, 2, maxRows, 1).getValues();
  
  var templateRows = {}; // nama -> row number
  var lastDataRow = dataStartRow;
  for (var i = 0; i < colB.length; i++) {
    var val = String(colB[i][0]).trim();
    if (val.toUpperCase() === 'TOTAL') break;
    if (val) {
      templateRows[val.toUpperCase()] = dataStartRow + i;
      lastDataRow = dataStartRow + i;
    }
  }

  // Untuk setiap penjamin di kunjungan, cari baris yang cocok atau tulis di baris kosong
  for (var k = 0; k < kunjungan.length; k++) {
    var r = kunjungan[k];
    if (!r.namaPenjamin || !r.namaPenjamin.trim()) continue;
    
    var nama = r.namaPenjamin.trim();
    var targetRow = templateRows[nama.toUpperCase()];
    
    if (!targetRow) {
      // Penjamin belum ada di template — cari baris kosong setelah data terakhir
      // Scan dari lastDataRow+1 untuk cari baris kosong (kolom B kosong, sebelum TOTAL)
      var found = false;
      for (var scan = lastDataRow + 1; scan < dataStartRow + maxRows; scan++) {
        var scanB = String(sheet.getRange(scan, 2).getValue()).trim();
        if (scanB.toUpperCase() === 'TOTAL') break;
        if (!scanB) {
          targetRow = scan;
          // Tulis nama penjamin di kolom B
          sheet.getRange(scan, 2).setValue(nama);
          templateRows[nama.toUpperCase()] = scan;
          lastDataRow = Math.max(lastDataRow, scan);
          found = true;
          break;
        }
      }
      if (!found) continue; // tidak ada baris kosong
    }

    // Tulis data di kolom C-N (12 kolom), SKIP kolom O (TOTAL = formula)
    // C=rjYani, D=riYani, E=igd, F=mcuAuto, G=promo, H=dokter, I=exc, J=prior, K=grhuRj, L=grhuRi, M=sat, N=ppk1
    var rowData = [
      r.rjYani || 0,
      r.riYani || 0,
      r.igd || 0,
      r.mcuAuto || 0,
      r.promo || 0,
      r.dokter || 0,
      r.exc || 0,
      r.prior || 0,
      r.grhuRj || 0,
      r.grhuRi || 0,
      r.sat || 0,
      r.ppk1 || 0
    ];
    sheet.getRange(targetRow, 3, 1, 12).setValues([rowData]);
  }
}

// ─── Tulis data MCU ke tabel kanan (kolom Q-V) ──

function writeMcuData(sheet, dataStartRow, mcu) {
  // Format Rp
  function fmtRpSatuan(v) {
    if (!v) return 'Rp0';
    return 'Rp' + Number(v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtRpTotal(v) {
    if (!v) return 'Rp0';
    return 'Rp' + Number(v).toLocaleString('id-ID');
  }

  for (var i = 0; i < mcu.length; i++) {
    var r = mcu[i];
    var row = dataStartRow + i;
    // Kolom Q=17(NO), R=18(PERUSAHAAN), S=19(PESERTA), T=20(NOMINAL), U=21(TOTAL), V=22(KET.PAKET)
    var mcuRow = [
      i + 1,
      r.namaPenjamin || '',
      r.peserta || 0,
      r.nominal ? fmtRpSatuan(r.nominal) : '',
      fmtRpTotal(r.total || 0),
      r.paket || ''
    ];
    sheet.getRange(row, 17, 1, 6).setValues([mcuRow]);
  }
}

// ─── Helper: Cari sheet bulan ───

function findMonthSheet(ss, monthIdx) {
  var bulan = BULAN_NAMES[monthIdx];
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().toUpperCase();
    // Match "APRIL 2026", "APRIL", "APR 2026", dll
    if (name.indexOf(bulan) >= 0) return sheets[i];
  }
  // Coba match dengan nama bulan English
  var bulanEn = BULAN_NAMES_SHORT[monthIdx].toUpperCase();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName().toUpperCase();
    if (name.indexOf(bulanEn) >= 0) return sheets[i];
  }
  return null;
}

// ─── Helper: Cari baris tanggal di sheet ───
// Cari cell di kolom A yang berisi "DD/Bulan/YYYY" atau tanggal yang cocok

function findDateRow(sheet, dayNum, monthIdx, year) {
  var lastRow = Math.min(sheet.getLastRow(), 3000);
  // Gunakan getDisplayValues() untuk hindari timezone issue pada Date objects
  var colADisplay = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();
  
  // Pattern: "01/April/2026", "1/April/2026", dll
  var bulanName = BULAN_NAMES_SHORT[monthIdx]; // "April"
  var patterns = [
    dayNum + '/' + bulanName + '/' + year,
    ('0' + dayNum).slice(-2) + '/' + bulanName + '/' + year,
    dayNum + '/' + BULAN_NAMES[monthIdx] + '/' + year,
    ('0' + dayNum).slice(-2) + '/' + BULAN_NAMES[monthIdx] + '/' + year,
  ];

  for (var i = 0; i < colADisplay.length; i++) {
    var str = colADisplay[i][0].trim();
    if (!str) continue;
    for (var p = 0; p < patterns.length; p++) {
      if (str.toLowerCase() === patterns[p].toLowerCase()) return i + 1;
    }
  }
  return -1;
}

// ─── Helper: Cari baris awal data (setelah sub-header) ───
// Dari dateRow, scan ke bawah untuk cari baris "KET,JAMINAN,..." lalu +2

function findDataStartRow(sheet, dateRow) {
  for (var i = dateRow; i < dateRow + 10; i++) {
    var valA = String(sheet.getRange(i, 1).getValue()).trim().toUpperCase();
    var valB = String(sheet.getRange(i, 2).getValue()).trim().toUpperCase();
    if (valA === 'KET' && valB === 'JAMINAN') {
      return i + 2; // +1 = sub-header (R.JALAN, R.INAP), +2 = data pertama
    }
  }
  return -1;
}

// ─── Parse tanggal ───

function parseTanggal(tanggal) {
  var parts = tanggal.trim().split(/[\s\-\/]+/);
  if (parts.length < 3) return null;
  var p0 = parseInt(parts[0], 10);
  if (isNaN(p0)) return null;
  if (p0 >= 1000) {
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (!isNaN(m) && !isNaN(d)) return { dayNum: d, monthIdx: m - 1, year: p0 };
  }
  var m2 = parseInt(parts[1], 10);
  if (!isNaN(m2) && m2 >= 1 && m2 <= 12) return { dayNum: p0, monthIdx: m2 - 1, year: parseInt(parts[2], 10) };
  return null;
}

// ─── JSON Response ───

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3. Ganti SPREADSHEET_ID
Ganti `GANTI_DENGAN_SPREADSHEET_ID` dengan ID dari URL spreadsheet:
```
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID_INI/edit
```

### 4. Deploy
- **Deploy → New deployment → Web app**
- Execute as: **Me**
- Who has access: **Anyone**
- Copy URL → set di Vercel: `VITE_GAS_LAPORAN_URL=<URL>`

## Cara Kerja

1. Frontend kirim `POST { action: 'inputLaporan', tanggal, kunjungan, mcu }`
2. GAS parse tanggal → cari sheet bulan (contoh: "APRIL 2026")
3. Cari baris tanggal (contoh: "08/April/2026") di kolom A
4. Cari header `KET, JAMINAN` → data mulai 2 baris di bawahnya
5. **Tabel Kiri**: untuk setiap penjamin:
   - Jika nama sudah ada di template → isi angka di baris tersebut
   - Jika nama belum ada → tulis di baris kosong berikutnya
   - Tulis kolom C-N (12 kolom data), **skip kolom O** (TOTAL = formula)
6. **Tabel Kanan**: tulis MCU detail di kolom Q-V
7. **Tidak menulis**: baris TOTAL, rekap per badge, kolom TOTAL — semua formula gsheet
