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

  // ── Cari baris awal MCU (kolom Q) ──
  // MCU data dimulai di baris yang sama dengan header "KET,JAMINAN" (kolom Q sudah berisi nomor 1)
  // Scan kolom Q dari dateRow ke bawah untuk cari baris pertama yang berisi angka 1
  var mcuStartRow = findMcuStartRow(sheet, dateRow);

  // ── Tulis Tabel Kiri: Laporan Harian per penjamin ──
  var laporanResult = writeLaporanData(sheet, dataStartRow, kunjungan);

  // ── Tulis Tabel Kanan: Rincian MCU ──
  var mcuResult = writeMcuData(sheet, mcuStartRow, mcu);

  return jsonResponse({
    status: 'ok',
    message: 'Data ' + tanggal + ' berhasil ditulis ke Laporan Harian',
    bulan: BULAN_NAMES[parsed.monthIdx],
    hari: parsed.dayNum,
    totalPenjamin: laporanResult.written,
    totalMcu: mcuResult.written,
    debug: { dateRow: dateRow, dateCell: dateCell, dataStartRow: dataStartRow, mcuStartRow: mcuStartRow, ketCell: ketCell, firstDataB: firstDataB }
  });
}

// ─── Tulis data kunjungan per penjamin ke tabel kiri ──

function writeLaporanData(sheet, dataStartRow, kunjungan) {
  // Baca kolom A+B dari dataStartRow sampai ketemu baris TOTAL di kolom B
  var maxRows = 50;
  var colAB = sheet.getRange(dataStartRow, 1, maxRows, 2).getValues();

  // 12 nama penjamin default (template) — selalu ada di sheet
  var DEFAULT_NAMES = [
    'KARYAWAN PG', 'KELUARGA PG', 'KARYAWAN PG BRI LIFE', 'KELUARGA PG BRI LIFE',
    'PROKESPEN MURNI', 'PROKESPEN BPJS COB',
    'BPJS KESEHATAN', 'BPJS NAIK KELAS', 'BPJS NAIK KELAS.',
    'PASIEN UMUM', 'BPJS KETENAGAKERJAAN (JKK)'
  ];
  var defaultSet = {};
  for (var d = 0; d < DEFAULT_NAMES.length; d++) defaultSet[DEFAULT_NAMES[d].toUpperCase()] = true;

  // Scan template: cari baris TOTAL dan identifikasi baris template vs non-template
  var templateRows = {}; // NAMA_UPPER -> row number
  var totalRow = -1;
  for (var i = 0; i < colAB.length; i++) {
    var valB = String(colAB[i][1]).trim();
    if (valB.toUpperCase() === 'TOTAL') { totalRow = dataStartRow + i; break; }
    if (valB) {
      templateRows[valB.toUpperCase()] = dataStartRow + i;
    }
  }
  if (totalRow < 0) return { written: 0 }; // safety

  // Clear non-default rows: hapus nama + data di baris yang bukan default template
  // Ini penting untuk overwrite — bersihkan data lama sebelum tulis baru
  for (var i = 0; i < colAB.length; i++) {
    var row = dataStartRow + i;
    if (row >= totalRow) break;
    var valB = String(colAB[i][1]).trim();
    var valA = String(colAB[i][0]).trim();
    if (!valB) continue; // sudah kosong
    if (defaultSet[valB.toUpperCase()]) {
      // Default row — clear data (kolom C-N) tapi jangan hapus nama
      sheet.getRange(row, 3, 1, 12).setValues([[0,0,0,0,0,0,0,0,0,0,0,0]]);
    } else {
      // Non-default row — clear nama (kolom B) + data (kolom C-N) + KET (kolom A jika bukan badge)
      sheet.getRange(row, 1, 1, 14).setValues([['','',0,0,0,0,0,0,0,0,0,0,0,0]]);
    }
  }

  // Rebuild templateRows setelah clear (hanya default names yang tersisa)
  templateRows = {};
  var colBAfter = sheet.getRange(dataStartRow, 2, totalRow - dataStartRow, 1).getValues();
  var lastFilledRow = dataStartRow;
  for (var i = 0; i < colBAfter.length; i++) {
    var valB = String(colBAfter[i][0]).trim();
    if (valB) {
      templateRows[valB.toUpperCase()] = dataStartRow + i;
      lastFilledRow = dataStartRow + i;
    }
  }

  // Filter: hanya kirim penjamin yang punya data (total > 0) atau nama tidak kosong
  var written = 0;
  for (var k = 0; k < kunjungan.length; k++) {
    var r = kunjungan[k];
    if (!r.namaPenjamin || !r.namaPenjamin.trim()) continue;

    var nama = r.namaPenjamin.trim();
    var hasAnyData = (r.rjYani||0)+(r.riYani||0)+(r.igd||0)+(r.mcuAuto||0)+
                     (r.promo||0)+(r.dokter||0)+(r.exc||0)+(r.prior||0)+
                     (r.grhuRj||0)+(r.grhuRi||0)+(r.sat||0)+(r.ppk1||0);

    // Default penjamin: selalu tulis (bahkan jika 0), karena template sudah ada
    var isDefault = defaultSet[nama.toUpperCase()];
    if (!isDefault && hasAnyData === 0) continue; // skip non-default tanpa data

    var targetRow = templateRows[nama.toUpperCase()];

    if (!targetRow) {
      // Cari baris kosong setelah lastFilledRow, sebelum totalRow
      var found = false;
      for (var scan = lastFilledRow + 1; scan < totalRow; scan++) {
        var scanB = String(sheet.getRange(scan, 2).getValue()).trim();
        if (!scanB) {
          targetRow = scan;
          // Tulis nama penjamin di kolom B
          sheet.getRange(scan, 2).setValue(nama);
          // Tulis badge di kolom A jika ini baris pertama NPG setelah JKK
          templateRows[nama.toUpperCase()] = scan;
          lastFilledRow = Math.max(lastFilledRow, scan);
          found = true;
          break;
        }
      }
      if (!found) continue; // tidak ada baris kosong
    }

    // Tulis data di kolom C-N (12 kolom), SKIP kolom O (TOTAL = formula)
    var rowData = [
      r.rjYani || 0, r.riYani || 0, r.igd || 0, r.mcuAuto || 0,
      r.promo || 0, r.dokter || 0, r.exc || 0, r.prior || 0,
      r.grhuRj || 0, r.grhuRi || 0, r.sat || 0, r.ppk1 || 0
    ];
    sheet.getRange(targetRow, 3, 1, 12).setValues([rowData]);
    written++;
  }
  return { written: written };
}

// ─── Tulis data MCU ke tabel kanan (kolom Q-V) ──

function writeMcuData(sheet, mcuStartRow, mcu) {
  if (mcuStartRow < 0) return { written: 0 };

  // Format Rp
  function fmtRpSatuan(v) {
    if (!v) return 'Rp0';
    return 'Rp' + Number(v).toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Clear old MCU data: scan dari mcuStartRow sampai ketemu baris summary (kolom Q kosong + kolom S punya angka = total row)
  // Atau sampai 30 baris max
  var maxMcuRows = 30;
  for (var i = 0; i < maxMcuRows; i++) {
    var row = mcuStartRow + i;
    var valQ = sheet.getRange(row, 17).getValue();
    // Stop jika kolom Q kosong DAN kolom R kosong (sudah melewati area MCU)
    // Tapi jangan stop di baris yang masih punya nomor urut
    if (i > 0 && !valQ && !String(sheet.getRange(row, 18).getValue()).trim()) break;
    // Clear kolom Q-T (4 kolom) dan V (1 kolom), skip U (formula)
    sheet.getRange(row, 17, 1, 4).setValues([['', '', '', '']]);
    sheet.getRange(row, 22).setValue('');
  }

  // Tulis data MCU baru
  for (var i = 0; i < mcu.length; i++) {
    var r = mcu[i];
    var row = mcuStartRow + i;
    // Kolom Q=17(NO), R=18(PERUSAHAAN), S=19(PESERTA), T=20(NOMINAL SATUAN)
    // SKIP kolom U=21(TOTAL) — biarkan formula di spreadsheet
    // Kolom V=22(KET. PAKET)
    sheet.getRange(row, 17, 1, 4).setValues([[
      i + 1,
      r.namaPenjamin || '',
      r.peserta || 0,
      r.nominal ? fmtRpSatuan(r.nominal) : ''
    ]]);
    // Tulis KET. PAKET di kolom V (skip kolom U)
    sheet.getRange(row, 22).setValue(r.paket || '');
  }
  return { written: mcu.length };
}

// ─── Helper: Cari baris awal MCU (kolom Q) ──
// Scan dari dateRow ke bawah, cari baris pertama di kolom Q yang berisi angka 1
// atau yang sudah berisi nomor urut MCU

function findMcuStartRow(sheet, dateRow) {
  // Scan kolom Q (17) dan R (18) dari dateRow sampai dateRow+10
  for (var i = 0; i < 10; i++) {
    var row = dateRow + i;
    var valQ = sheet.getRange(row, 17).getValue();
    var valR = String(sheet.getRange(row, 18).getValue()).trim().toUpperCase();
    // Cari header "NO" + "PERUSAHAAN" → data mulai 1 baris di bawahnya
    if ((String(valQ).trim().toUpperCase() === 'NO') && valR === 'PERUSAHAAN') {
      return row + 1;
    }
  }
  // Fallback: cari baris dengan angka 1 di kolom Q
  for (var i = 0; i < 10; i++) {
    var row = dateRow + i;
    var valQ = sheet.getRange(row, 17).getValue();
    if (typeof valQ === 'number' && valQ === 1) return row;
    if (String(valQ).trim() === '1') return row;
  }
  return -1; // tidak ditemukan
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
4. Cari header `KET, JAMINAN` → data mulai 2 baris di bawahnya (`dataStartRow`)
5. Cari header MCU `NO, PERUSAHAAN` di kolom Q-R → data MCU mulai 1 baris di bawahnya (`mcuStartRow`)
6. **Tabel Kiri**: 
   - Clear semua data lama (non-default rows dihapus nama+data, default rows hanya clear data)
   - Untuk setiap penjamin yang punya data:
     - Jika nama default → isi angka di baris template
     - Jika nama non-default → tulis di baris kosong berikutnya (sebelum TOTAL)
   - Tulis kolom C-N (12 kolom data), **skip kolom O** (TOTAL = formula)
7. **Tabel Kanan**: clear data MCU lama, lalu tulis MCU detail di kolom Q-V mulai dari `mcuStartRow`
8. **Tidak menulis**: baris TOTAL, rekap per badge, kolom TOTAL (O dan U) — semua formula gsheet
