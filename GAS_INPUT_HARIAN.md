# Google Apps Script - Input Harian → Sheet KUNJUNGAN 2026

## Overview
Script GAS untuk menerima data Input Harian dari frontend dan menulis langsung ke sheet **"KUNJUNGAN 2026"** di Google Sheets.

Script ini dibuat sebagai **file terpisah** (`InputHarian.gs`) di project GAS yang sama (bound ke spreadsheet), sehingga **tidak bentrok** dengan kode GAS read-only yang sudah ada.

> **PENTING:** Jika project GAS yang sudah ada **sudah punya `doPost()`**, maka JANGAN tambahkan file ini di project yang sama. Buat project Apps Script baru (standalone) yang terhubung ke spreadsheet yang sama. Lihat bagian "Setup Alternatif" di bawah.

## Struktur Sheet "KUNJUNGAN 2026"

Setiap bulan punya blok baris:
- **Row 0**: Header bulan (`JANUARI`, `RAWAT JALAN`, ..., `TOTAL KUNJUNGN`, `TARGET`, `CAPAIAN (%)`)
- **Row 1**: Sub-header (nama payer per kategori)
- **Row 2-32**: Hari 1-31 (kolom A = nomor hari, kolom B-AF = data, AG = total kunjungan)
- **Row 33**: TOTAL (sum semua hari)
- **Row 34**: Sub Total (ringkasan per kategori)
- **Row 35+**: Separator (baris kosong)

Kolom layout (35 kolom, A-AI):
| Kolom | Index | Isi |
|-------|-------|-----|
| A | 1 | Day number / label |
| B-J | 2-10 | RAWAT JALAN (9 payer) |
| K-S | 11-19 | RAWAT INAP (9 payer) |
| T-AB | 20-28 | IGD (9 payer) |
| AC-AF | 29-32 | MCU (4 payer) |
| AG | 33 | TOTAL KUNJUNGN |
| AH | 34 | TARGET (skip - tidak diisi GAS) |
| AI | 35 | CAPAIAN (%) (skip - tidak diisi GAS) |

## Setup

### 1. Buka Apps Script Editor
- Buka Google Sheets yang berisi sheet "KUNJUNGAN 2026"
- Menu: **Extensions → Apps Script**

### 2. Tambah File Baru
- Klik **+** di samping "Files" → **Script**
- Beri nama: `InputHarian`
- Paste kode di bawah ini

### 3. Paste Kode Berikut

```javascript
// ============================================
// INPUT HARIAN → SHEET KUNJUNGAN 2026
// Portal Lab RS Petrokimia Gresik
// ============================================

var SHEET_KUNJUNGAN = 'KUNJUNGAN 2026';

var BULAN_NAMES = [
  'JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI',
  'JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'
];

// Badge → index di 9 payer (RJ/RI/IGD): 0-based offset dari kolom B
// B=0, C=1, D=2, E=3, F=4, G=5, H=6, I=7, J=8
var BADGE_TO_IDX = {
  'PG': 0,
  'NPG': 1,
  'BRI LIFE PG': 2,
  'AS': 3,
  'PROKESPEN': 4,
  'PROKESPEN BPJS': 5,
  'BPJS': 6,
  'JKK': 7,
  'UMUM': 8
};

// MCU hanya 4 kolom: PT PETROKIMIA(0), PERUSAHAAN LAIN(1), ASURANSI KOMERSIAL(2), UMUM(3)
var MCU_BADGE_TO_IDX = {
  'PG': 0,
  'NPG': 1,
  'AS': 2,
  'UMUM': 3
};

// ─── Entry Point ───

function doPost(e) {
  try {
    var body;
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse({ error: 'No POST data' });
    }

    if (body.action === 'inputHarian') {
      return handleInputHarian(body);
    }

    // Jika action tidak dikenal, kembalikan error
    return jsonResponse({ error: 'Unknown action: ' + body.action });

  } catch (err) {
    return jsonResponse({ error: err.message || String(err) });
  }
}

// Juga support GET untuk ping/check
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  if (action === 'ping') {
    return jsonResponse({ status: 'ok', service: 'inputHarian' });
  }
  if (action === 'checkDay') {
    return handleCheckDay(e.parameter);
  }
  if (action === 'getTarget') {
    return handleGetTarget(e.parameter);
  }
  return jsonResponse({ status: 'ok', service: 'inputHarian', message: 'Use POST to submit data' });
}

// ─── Check apakah hari sudah terisi (untuk warning overwrite) ───

function handleCheckDay(params) {
  var tanggal = params.tanggal || '';
  var parsed = parseTanggal(tanggal);
  if (!parsed) return jsonResponse({ error: 'Invalid tanggal: ' + tanggal });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_KUNJUNGAN);
  if (!sheet) return jsonResponse({ error: 'Sheet "' + SHEET_KUNJUNGAN + '" tidak ditemukan' });

  var headerRow = findMonthHeaderRow(sheet, parsed.monthIdx);
  if (headerRow < 0) return jsonResponse({ error: 'Bulan ' + BULAN_NAMES[parsed.monthIdx] + ' tidak ditemukan di sheet' });

  // Baris data hari: headerRow = bulan header (1-indexed), +1 = sub-header, +1+d = hari d
  // Hari 1 = headerRow + 2, Hari d = headerRow + 1 + d
  var dayRow = headerRow + 1 + parsed.dayNum;

  // Verifikasi: kolom A di dayRow harus berisi nomor hari yang sama
  var cellA = sheet.getRange(dayRow, 1).getValue();
  var cellANum = typeof cellA === 'number' ? cellA : parseInt(String(cellA), 10);
  if (cellANum !== parsed.dayNum) {
    // Offset tidak cocok — coba cari baris yang benar
    // Scan dari headerRow+2 sampai headerRow+40 untuk cari baris dengan kolom A = dayNum
    var found = false;
    for (var scan = headerRow + 2; scan <= headerRow + 40; scan++) {
      var scanVal = sheet.getRange(scan, 1).getValue();
      var scanNum = typeof scanVal === 'number' ? scanVal : parseInt(String(scanVal), 10);
      if (scanNum === parsed.dayNum) {
        dayRow = scan;
        found = true;
        break;
      }
    }
    if (!found) {
      return jsonResponse({ error: 'Baris hari ' + parsed.dayNum + ' tidak ditemukan di bulan ' + BULAN_NAMES[parsed.monthIdx] + ' (headerRow=' + headerRow + ', expected dayRow=' + (headerRow + 1 + parsed.dayNum) + ', cellA=' + cellA + ')' });
    }
  }

  // Cek kolom B-AF (kolom 2-32, 31 kolom) apakah ada data > 0
  var range = sheet.getRange(dayRow, 2, 1, 31); // B sampai AF
  var values = range.getValues()[0];
  var hasData = values.some(function(v) { return typeof v === 'number' && v > 0; });

  // Juga ambil total kunjungan (kolom AG = 33)
  var totalKunj = sheet.getRange(dayRow, 33).getValue() || 0;

  return jsonResponse({
    status: 'ok',
    tanggal: tanggal,
    dayNum: parsed.dayNum,
    bulan: BULAN_NAMES[parsed.monthIdx],
    hasData: hasData,
    totalKunjungan: totalKunj,
    debug: { headerRow: headerRow, dayRow: dayRow, cellA: String(cellA) }
  });
}

// ─── Get Target dari sheet OMSET HARIAN 2026 ───

var SHEET_OMSET_HARIAN = 'OMSET HARIAN 2026';

function handleGetTarget(params) {
  var tanggal = params.tanggal || '';
  var parsed = parseTanggal(tanggal);
  if (!parsed) return jsonResponse({ error: 'Invalid tanggal: ' + tanggal });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_OMSET_HARIAN);
  if (!sheet) return jsonResponse({ error: 'Sheet "' + SHEET_OMSET_HARIAN + '" tidak ditemukan' });

  // Cari blok bulan: cari baris yang berisi nama bulan di kolom A
  var bulanName = BULAN_NAMES[parsed.monthIdx];
  var lastRow = Math.min(sheet.getLastRow(), 2000);
  var colA = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();

  var monthHeaderRow = -1;
  for (var i = 0; i < colA.length; i++) {
    var val = colA[i][0].trim().toUpperCase();
    // Match "JANUARI 2026", "April 2026", dll
    if (val.indexOf(bulanName) >= 0 && val.indexOf('2026') >= 0) {
      monthHeaderRow = i + 1; // 1-indexed
      break;
    }
  }
  if (monthHeaderRow < 0) return jsonResponse({ error: 'Bulan ' + bulanName + ' tidak ditemukan di sheet OMSET HARIAN' });

  // Baris data dimulai 2 baris setelah header bulan (skip header kolom HARI,TANGGAL,...)
  // monthHeaderRow = "JANUARI 2026"
  // monthHeaderRow+1 = "HARI, TANGGAL, TARGET, OMZET, ..."
  // monthHeaderRow+2 = data hari 1
  var dataStartRow = monthHeaderRow + 2;

  // Cari baris tanggal: scan kolom B (TANGGAL) untuk cari dayNum
  var targetOmzetHarian = 0;
  var targetKunjHarian = 0;
  var dayRow = -1;

  for (var d = 0; d < 31; d++) {
    var row = dataStartRow + d;
    var cellB = sheet.getRange(row, 2).getValue();
    var cellBNum = typeof cellB === 'number' ? cellB : parseInt(String(cellB).trim(), 10);
    if (cellBNum === parsed.dayNum) {
      dayRow = row;
      // Kolom C = TARGET OMZET (kolom 3)
      var rawC = sheet.getRange(row, 3).getValue();
      targetOmzetHarian = typeof rawC === 'number' ? rawC : parseFloat(String(rawC).replace(/[^\d.-]/g, '')) || 0;
      // Kolom G = TARGET KUNJUNGAN HARIAN (kolom 7)
      var rawG = sheet.getRange(row, 7).getValue();
      targetKunjHarian = typeof rawG === 'number' ? rawG : parseInt(String(rawG).replace(/[^\d]/g, ''), 10) || 0;
      break;
    }
  }

  // Cari baris "Target Real" untuk target bulanan
  var targetOmzetBulan = 0;
  var targetKunjBulan = 0;
  for (var i = dataStartRow; i < dataStartRow + 40; i++) {
    var val = String(sheet.getRange(i, 1).getValue()).trim().toLowerCase();
    if (val.indexOf('target real') >= 0 || val.indexOf('target real') >= 0) {
      // Kolom C = TARGET OMZET BULAN
      var rawC2 = sheet.getRange(i, 3).getValue();
      targetOmzetBulan = typeof rawC2 === 'number' ? rawC2 : parseFloat(String(rawC2).replace(/[^\d.-]/g, '')) || 0;
      // Kolom G = TARGET KUNJUNGAN BULAN
      var rawG2 = sheet.getRange(i, 7).getValue();
      targetKunjBulan = typeof rawG2 === 'number' ? rawG2 : parseInt(String(rawG2).replace(/[^\d]/g, ''), 10) || 0;
      break;
    }
  }

  return jsonResponse({
    status: 'ok',
    tanggal: tanggal,
    bulan: bulanName,
    dayNum: parsed.dayNum,
    targetOmzetHarian: targetOmzetHarian,
    targetKunjHarian: targetKunjHarian,
    targetOmzetBulan: targetOmzetBulan,
    targetKunjBulan: targetKunjBulan,
    debug: { monthHeaderRow: monthHeaderRow, dayRow: dayRow }
  });
}

// ─── Handle Input Harian ───

function handleInputHarian(body) {
  var tanggal = body.tanggal || '';
  var kunjungan = body.kunjungan || [];
  var mcu = body.mcu || [];

  // Parse tanggal
  var parsed = parseTanggal(tanggal);
  if (!parsed) return jsonResponse({ error: 'Invalid tanggal: ' + tanggal });

  var dayNum = parsed.dayNum;
  var monthIdx = parsed.monthIdx;

  // Buka sheet
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_KUNJUNGAN);
  if (!sheet) return jsonResponse({ error: 'Sheet "' + SHEET_KUNJUNGAN + '" tidak ditemukan' });

  // Cari baris header bulan
  var headerRow = findMonthHeaderRow(sheet, monthIdx);
  if (headerRow < 0) return jsonResponse({ error: 'Bulan ' + BULAN_NAMES[monthIdx] + ' tidak ditemukan di sheet' });

  // ── Aggregate data per badge ──
  var rj = new Array(9);
  var ri = new Array(9);
  var igd = new Array(9);
  var mcuData = new Array(4);
  for (var i = 0; i < 9; i++) { rj[i] = 0; ri[i] = 0; igd[i] = 0; }
  for (var i = 0; i < 4; i++) { mcuData[i] = 0; }

  for (var k = 0; k < kunjungan.length; k++) {
    var r = kunjungan[k];
    var badge = r.badge || '';
    var idx = BADGE_TO_IDX[badge];
    if (idx === undefined) continue;

    // RJ = rjYani + promo + dokter + exc + prior + grhuRj + sat + ppk1
    rj[idx] += (r.rjYani || 0) + (r.promo || 0) + (r.dokter || 0) +
               (r.exc || 0) + (r.prior || 0) + (r.grhuRj || 0) +
               (r.sat || 0) + (r.ppk1 || 0);
    // RI = riYani + grhuRi
    ri[idx] += (r.riYani || 0) + (r.grhuRi || 0);
    // IGD
    igd[idx] += (r.igd || 0);
    // MCU
    var mcuIdx = MCU_BADGE_TO_IDX[badge];
    if (mcuIdx !== undefined) {
      mcuData[mcuIdx] += (r.mcuAuto || 0);
    }
  }

  // ── Tulis data ke baris hari ──
  // Baris target: headerRow + 1 (sub-header) + dayNum
  // headerRow sudah 1-indexed, sub-header = headerRow+1, hari 1 = headerRow+2
  var dayRow = headerRow + 1 + dayNum;

  // Verifikasi: kolom A di dayRow harus berisi nomor hari yang sama
  var cellA = sheet.getRange(dayRow, 1).getValue();
  var cellANum = typeof cellA === 'number' ? cellA : parseInt(String(cellA), 10);
  if (cellANum !== dayNum) {
    // Scan untuk cari baris yang benar
    var found = false;
    for (var scan = headerRow + 2; scan <= headerRow + 40; scan++) {
      var scanVal = sheet.getRange(scan, 1).getValue();
      var scanNum = typeof scanVal === 'number' ? scanVal : parseInt(String(scanVal), 10);
      if (scanNum === dayNum) {
        dayRow = scan;
        found = true;
        break;
      }
    }
    if (!found) {
      return jsonResponse({ error: 'Baris hari ' + dayNum + ' tidak ditemukan di bulan ' + BULAN_NAMES[monthIdx] });
    }
  }

  // Bangun array 31 kolom: 9 RJ + 9 RI + 9 IGD + 4 MCU
  // TIDAK menulis kolom AG (TOTAL KUNJUNGN) — biarkan formula di Google Sheets
  var rowData = [];
  for (var i = 0; i < 9; i++) rowData.push(rj[i]);
  for (var i = 0; i < 9; i++) rowData.push(ri[i]);
  for (var i = 0; i < 9; i++) rowData.push(igd[i]);
  for (var i = 0; i < 4; i++) rowData.push(mcuData[i]);

  var totalKunj = 0;
  for (var i = 0; i < rowData.length; i++) totalKunj += rowData[i];

  // Tulis ke kolom B-AF (kolom 2 sampai 32), 31 values — skip AG (formula gsheet)
  sheet.getRange(dayRow, 2, 1, rowData.length).setValues([rowData]);

  // ── Update baris TOTAL ──
  updateTotalRow(sheet, headerRow, monthIdx);

  return jsonResponse({
    status: 'ok',
    message: 'Data tanggal ' + tanggal + ' berhasil ditulis ke sheet ' + SHEET_KUNJUNGAN,
    bulan: BULAN_NAMES[monthIdx],
    hari: dayNum,
    totalKunjungan: totalKunj
  });
}

// ─── Cari baris header bulan di kolom A ───
// Cari cell yang isinya persis nama bulan (JANUARI, FEBRUARI, dst)
// Return row number (1-indexed), atau -1 jika tidak ditemukan

function findMonthHeaderRow(sheet, monthIdx) {
  var bulanName = BULAN_NAMES[monthIdx];
  var lastRow = sheet.getLastRow();
  var colA = sheet.getRange(1, 1, lastRow, 1).getValues();

  for (var i = 0; i < colA.length; i++) {
    var val = String(colA[i][0]).trim().toUpperCase();
    if (val === bulanName) {
      return i + 1; // 1-indexed
    }
  }
  return -1;
}

// ─── Update baris TOTAL dan Sub Total ───

function updateTotalRow(sheet, headerRow, monthIdx) {
  // Baris hari 1-31: headerRow+2 sampai headerRow+32
  // Baris TOTAL: cari baris dengan "TOTAL" di kolom A setelah hari 31
  // Baris Sub Total: baris setelah TOTAL
  // TIDAK menulis kolom AG (TOTAL KUNJUNGN) — biarkan formula di Google Sheets

  var firstDayRow = headerRow + 2;
  var lastDayRow = headerRow + 32; // hari 31

  // Baca semua 31 baris data (kolom B-AF = kolom 2-32, 31 kolom)
  var dataRange = sheet.getRange(firstDayRow, 2, 31, 31);
  var allData = dataRange.getValues();

  // Hitung total per kolom (31 kolom data saja, tanpa AG)
  var totals = new Array(31);
  for (var c = 0; c < 31; c++) {
    totals[c] = 0;
    for (var r = 0; r < 31; r++) {
      var v = allData[r][c];
      if (typeof v === 'number') totals[c] += v;
    }
  }

  // Cari baris TOTAL (biasanya headerRow + 33, tapi cari by content untuk safety)
  var totalRow = -1;
  var subTotalRow = -1;
  for (var i = lastDayRow; i <= lastDayRow + 5; i++) {
    var val = String(sheet.getRange(i, 1).getValue()).trim().toUpperCase();
    if (val === 'TOTAL') { totalRow = i; break; }
  }

  if (totalRow > 0) {
    // Tulis totals ke baris TOTAL (kolom B-AF saja, skip AG)
    sheet.getRange(totalRow, 2, 1, 31).setValues([totals]);

    // Cari baris Sub Total (biasanya totalRow + 1)
    for (var i = totalRow + 1; i <= totalRow + 3; i++) {
      var val = String(sheet.getRange(i, 1).getValue()).trim();
      if (val.toLowerCase().indexOf('sub total') >= 0 || val.toLowerCase().indexOf('sub') >= 0) {
        subTotalRow = i;
        break;
      }
    }

    if (subTotalRow > 0) {
      // Sub Total format (kolom B-AF, 31 kolom):
      // B="RAWAT JALAN :", C=sum RJ, D-J=kosong (9 kolom)
      // K="RAWAT INAP :", L=sum RI, M-S=kosong (9 kolom)
      // T="IGD :", U=sum IGD, V-AB=kosong (9 kolom)
      // AC="MCU : ", AD=sum MCU, AE-AF=kosong (4 kolom)
      var rjTotal = 0, riTotal = 0, igdTotal = 0, mcuTotal = 0;
      for (var i = 0; i < 9; i++) rjTotal += totals[i];
      for (var i = 9; i < 18; i++) riTotal += totals[i];
      for (var i = 18; i < 27; i++) igdTotal += totals[i];
      for (var i = 27; i < 31; i++) mcuTotal += totals[i];

      var subRow = [];
      subRow.push('RAWAT JALAN :', rjTotal, '', '', '', '', '', '', '');   // B-J (9)
      subRow.push('RAWAT INAP :', riTotal, '', '', '', '', '', '', '');    // K-S (9)
      subRow.push('IGD :', igdTotal, '', '', '', '', '', '', '');          // T-AB (9)
      subRow.push('MCU : ', mcuTotal, '', '');                             // AC-AF (4)
      sheet.getRange(subTotalRow, 2, 1, subRow.length).setValues([subRow]);
    }
  }
}

// ─── Parse tanggal ───
// Support: "YYYY-MM-DD" (ISO dari input type=date)

function parseTanggal(tanggal) {
  var parts = tanggal.trim().split(/[\s\-\/]+/);
  if (parts.length < 3) return null;

  var p0 = parseInt(parts[0], 10);
  if (isNaN(p0)) return null;

  // Format YYYY-MM-DD
  if (p0 >= 1000) {
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (!isNaN(m) && !isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { dayNum: d, monthIdx: m - 1 };
    }
  }

  // Format DD-MM-YYYY
  var m2 = parseInt(parts[1], 10);
  if (!isNaN(m2) && m2 >= 1 && m2 <= 12 && p0 >= 1 && p0 <= 31) {
    return { dayNum: p0, monthIdx: m2 - 1 };
  }

  return null;
}

// ─── JSON Response Helper ───

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 4. Deploy sebagai Web App
- Klik **Deploy → New deployment**
- Type: **Web app**
- Execute as: **Me**
- Who has access: **Anyone**
- Klik **Deploy** → Copy URL

### 5. Set Environment Variable
Di Vercel (atau `.env.local` untuk development):
```
VITE_GAS_INPUT_URL=https://script.google.com/macros/s/XXXXXXX/exec
```

Lalu redeploy.

---

## Setup Alternatif: Jika GAS yang Ada Sudah Punya `doPost()`

Jika project GAS yang sudah ada **sudah punya `doPost()`** di file lain, maka menambah `doPost()` di file baru akan **bentrok** (GAS hanya boleh punya 1 `doPost` per project).

Solusi: **Buat project Apps Script baru (standalone)**

1. Buka https://script.google.com → **New project**
2. Paste kode di atas
3. Tambahkan akses ke spreadsheet:
   ```javascript
   // Ganti baris pertama di handleInputHarian dan handleCheckDay:
   // DARI:
   var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_KUNJUNGAN);
   // MENJADI:
   var ss = SpreadsheetApp.openById('SPREADSHEET_ID_KAMU');
   var sheet = ss.getSheetByName(SHEET_KUNJUNGAN);
   ```
4. Ganti `SPREADSHEET_ID_KAMU` dengan ID spreadsheet (dari URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`)
5. Deploy sebagai Web App seperti biasa

---

## Cara Kerja

### Submit Data (POST)
Frontend mengirim:
```json
{
  "action": "inputHarian",
  "tanggal": "2026-04-09",
  "kunjungan": [
    { "badge": "PG", "rjYani": 5, "riYani": 2, "igd": 1, "mcuAuto": 3, "promo": 0, "dokter": 0, "exc": 0, "prior": 0, "grhuRj": 0, "grhuRi": 0, "sat": 0, "ppk1": 0 },
    ...
  ],
  "mcu": [...]
}
```

GAS akan:
1. Parse tanggal → 9 April = bulan index 3 (APRIL), hari 9
2. Aggregate semua kunjungan per badge
3. Cari baris "APRIL" di sheet → tulis data di baris hari ke-9
4. Update baris TOTAL dan Sub Total

### Check Overwrite (GET)
Frontend memanggil sebelum submit:
```
GET ?action=checkDay&tanggal=2026-04-09
```

Response:
```json
{
  "status": "ok",
  "tanggal": "2026-04-09",
  "dayNum": 9,
  "bulan": "APRIL",
  "hasData": true,
  "totalKunjungan": 306
}
```

Jika `hasData: true`, frontend menampilkan warning "Data tanggal ini sudah ada (306 kunjungan). Overwrite?"
