# Google Apps Script - Input → Sheet LAPORAN KUNJUNGAN HARIAN 2026 (OPTIMIZED)

**Tanggal update:** 7 November 2026  

## 🔴 Akar Looping — dan Fix-nya

### Masalah Sebelumnya

Di `writeLaporanData` (versi lama), untuk setiap penjamin yang tidak ada di template, kode melakukan **scan baris-per-baris dengan `getRange(scan, 2).getValue()`**:

```javascript
// ❌ LAMA: 1 API call per iterasi per penjamin
for (var scan = lastFilledRow + 1; scan < totalRow; scan++) {
  var scanB = String(sheet.getRange(scan, 2).getValue()).trim(); // API CALL!
  if (!scanB) { ... }
}
```

Kalau ada 15 penjamin non-template × ~10 baris scan = **150+ `getValue()` call**. 
Ditambah clear data lama: 30+ baris × `setValues()` individual = **200+ API calls total**.
GAS timeout 30 detik → script mati di tengah → frontend retry → eksekusi ganda → data kacau.

### Fix: Batch Read + Batch Write

**1× `getValues()`** baca seluruh blok data (dataStartRow s/d totalRow-1, kolom A-N)  
**Modifikasi di memory** (JavaScript array, zero API cost)  
**1× `setValues()`** tulis kembali seluruh blok  

**Hasil: ~200+ API calls → 2 API calls (1 read + 1 write)**

---

## 📋 Kode Lengkap (Replace seluruh script)

```javascript
// ============================================
// INPUT HARIAN → SHEET LAPORAN KUNJUNGAN HARIAN 2026 (OPTIMIZED v2)
// Portal Lab RS Petrokimia Gresik
// Update: 7 November 2026 — dokumentasi dikonsolidasikan, kode tetap
// Fix: batch read/write untuk writeLaporanData & writeMcuData
// ============================================

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

  var dataStartRow = findDataStartRow(sheet, dateRow);
  if (dataStartRow < 0) return jsonResponse({
    status: 'ok', hasData: false, bulan: BULAN_NAMES[parsed.monthIdx], dayNum: parsed.dayNum,
    debug: { dateRow: dateRow, dataStartRow: -1 }
  });

  // ✅ BATCH: baca 20 baris × 12 kolom data (C-N) sekaligus
  var block = sheet.getRange(dataStartRow, 3, 20, 12).getValues();
  var hasData = false;
  for (var r = 0; r < block.length; r++) {
    for (var c = 0; c < block[r].length; c++) {
      if (typeof block[r][c] === 'number' && block[r][c] > 0) { hasData = true; break; }
    }
    if (hasData) break;
  }

  return jsonResponse({
    status: 'ok', tanggal: tanggal, dayNum: parsed.dayNum,
    bulan: BULAN_NAMES[parsed.monthIdx], hasData: hasData
  });
}

// ─── Handle Input Laporan (OPTIMIZED) ───

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

  var dataStartRow = findDataStartRow(sheet, dateRow);
  if (dataStartRow < 0) return jsonResponse({ error: 'Header tabel tidak ditemukan untuk tanggal ' + tanggal });

  var mcuStartRow = findMcuStartRow(sheet, dateRow);

  // ── Tulis Tabel Kiri: Laporan Harian (OPTIMIZED: batch read/write) ──
  var laporanResult = writeLaporanDataBatch(sheet, dataStartRow, kunjungan);

  // ── Tulis Tabel Kanan: MCU (OPTIMIZED: batch read/write) ──
  var mcuResult = writeMcuDataBatch(sheet, mcuStartRow, mcu);

  return jsonResponse({
    status: 'ok',
    message: 'Data ' + tanggal + ' berhasil ditulis ke Laporan Harian',
    bulan: BULAN_NAMES[parsed.monthIdx], hari: parsed.dayNum,
    totalPenjamin: laporanResult.written, totalMcu: mcuResult.written
  });
}

// ═══════════════════════════════════════════════════════════
// writeLaporanDataBatch — BATCH READ/WRITE VERSION
// ═══════════════════════════════════════════════════════════

function writeLaporanDataBatch(sheet, dataStartRow, kunjungan) {
  // ✅ STEP 1: BACA SELURUH BLOK DATA SEKALIGUS
  // Kolom A-N = 14 kolom (A=KET, B=JAMINAN, C-N=data, O=TOTAL formula)
  var MAX_ROWS = 50;
  var block = sheet.getRange(dataStartRow, 1, MAX_ROWS, 14).getValues();

  // ✅ STEP 2: IDENTIFIKASI BARIS TOTAL (dari memory, bukan API)
  var totalRowRel = -1;
  for (var i = 0; i < block.length; i++) {
    if (String(block[i][1]).trim().toUpperCase() === 'TOTAL') {
      totalRowRel = i;
      break;
    }
  }
  if (totalRowRel < 0) return { written: 0 };

  // ✅ STEP 3: BANGUN MAP NAMA → BARIS DARI SHEET (sheet = source of truth)
  // Sheet punya template rows dengan nama di kolom B. Kita SIMPAN semua nama.
  // Hanya CLEAR DATA (kolom C-N), JANGAN hapus nama.
  var existingNames = {}; // NAMA_UPPER -> relative row index
  var lastFilledRel = 0;
  for (var i = 0; i < totalRowRel; i++) {
    var valB = String(block[i][1]).trim();
    if (valB) {
      existingNames[valB.toUpperCase()] = i;
      lastFilledRel = i;
    }
    // Clear data kolom C-N (index 2-13) untuk SEMUA baris
    for (var c = 2; c < 14; c++) {
      block[i][c] = 0;
    }
    // Kosongkan kolom A (KET) untuk baris tanpa nama
    if (!valB) {
      block[i][0] = '';
    }
  }

  // ✅ STEP 4: TULIS DATA BARU (modifikasi array di memory)
  var written = 0;
  for (var k = 0; k < kunjungan.length; k++) {
    var r = kunjungan[k];
    if (!r.namaPenjamin || !r.namaPenjamin.trim()) continue;

    var nama = r.namaPenjamin.trim();
    var hasAnyData = (r.rjYani||0)+(r.riYani||0)+(r.igd||0)+(r.mcuAuto||0)+
                     (r.promo||0)+(r.dokter||0)+(r.exc||0)+(r.prior||0)+
                     (r.grhuRj||0)+(r.grhuRi||0)+(r.sat||0)+(r.ppk1||0);

    // Skip penjamin tanpa data (kecuali namanya sudah ada di template sheet)
    var alreadyInSheet = existingNames.hasOwnProperty(nama.toUpperCase());
    if (!alreadyInSheet && hasAnyData === 0) continue;

    var targetRel = existingNames[nama.toUpperCase()];

    if (targetRel === undefined) {
      // Nama baru — cari baris kosong
      for (var scan = lastFilledRel + 1; scan < totalRowRel; scan++) {
        if (!String(block[scan][1]).trim()) {
          targetRel = scan;
          block[scan][1] = nama;
          existingNames[nama.toUpperCase()] = scan;
          lastFilledRel = Math.max(lastFilledRel, scan);
          break;
        }
      }
      if (targetRel === undefined) continue; // tidak ada baris kosong
    }

    // Tulis data di kolom C-N (index 2-13), 12 kolom
    var cols = [r.rjYani, r.riYani, r.igd, r.mcuAuto, r.promo, r.dokter, r.exc, r.prior, r.grhuRj, r.grhuRi, r.sat, r.ppk1];
    for (var c = 0; c < 12; c++) {
      block[targetRel][c + 2] = cols[c] || 0;
    }
    written++;
  }

  // ✅ STEP 5: TULIS SELURUH BLOK SEKALIGUS (baris 0 s/d totalRowRel-1)
  var outBlock = [];
  for (var i = 0; i < totalRowRel; i++) {
    outBlock.push(block[i]);
  }
  sheet.getRange(dataStartRow, 1, outBlock.length, 14).setValues(outBlock);

  return { written: written };
}

// ═══════════════════════════════════════════════════════════
// writeMcuDataBatch — BATCH READ/WRITE VERSION
// ═══════════════════════════════════════════════════════════
// PENTING: Kolom U (21) = TOTAL = formula Google Sheets.
// JANGAN dibaca, JANGAN ditulis, JANGAN disentuh sama sekali.
// Kita hanya baca/tulis kolom Q-T (17-20) dan V (22).

function writeMcuDataBatch(sheet, mcuStartRow, mcu) {
  if (mcuStartRow < 0) return { written: 0 };

  var MAX_MCU_ROWS = 30;

  // ✅ STEP 1: BACA KOLOM DATA MCU (Q-T = 17-20, 4 kolom) + V (22) SEKALIGUS
  // Kolom Q=NO, R=PERUSAHAAN, S=PESERTA, T=NOMINAL SATUAN, V=KET PAKET
  // KOLOM U TIDAK DISENTUH — itu formula TOTAL
  var blockData = sheet.getRange(mcuStartRow, 17, MAX_MCU_ROWS, 4).getValues();  // Q-T
  var blockKet  = sheet.getRange(mcuStartRow, 22, MAX_MCU_ROWS, 1).getValues();  // V

  // ✅ STEP 2: IDENTIFIKASI AKHIR AREA MCU (dari memory)
  var dataEndRel = 0;
  for (var i = 0; i < blockData.length; i++) {
    var valQ = blockData[i][0]; // kolom Q
    var valR = String(blockData[i][1]).trim(); // kolom R
    if (i > 0 && !valQ && !valR) {
      dataEndRel = i;
      break;
    }
    dataEndRel = i + 1;
  }

  // ✅ STEP 3: CLEAR DATA LAMA (di memory) — KOLOM U TIDAK DISENTUH
  for (var i = 0; i < dataEndRel; i++) {
    blockData[i][0] = '';  // Q: NO
    blockData[i][1] = '';  // R: PERUSAHAAN
    blockData[i][2] = '';  // S: PESERTA
    blockData[i][3] = '';  // T: NOMINAL SATUAN
    blockKet[i][0]  = '';  // V: KET PAKET
  }

  // ✅ STEP 4: ISI DATA MCU BARU (di memory)
  for (var i = 0; i < mcu.length; i++) {
    var r = mcu[i];
    if (i >= MAX_MCU_ROWS) break;

    blockData[i][0] = i + 1;                    // Q: NO
    blockData[i][1] = r.namaPenjamin || '';     // R: PERUSAHAAN
    blockData[i][2] = r.peserta || 0;           // S: PESERTA
    blockData[i][3] = r.nominal || 0;           // T: NOMINAL SATUAN (angka, bukan Rp string)
    blockKet[i][0]  = r.paket || '';            // V: KET. PAKET
  }

  // ✅ STEP 5: TULIS KEMBALI — 2 setValues(), kolom U tidak disentuh
  var rowsToWrite = Math.max(dataEndRel, Math.min(mcu.length, MAX_MCU_ROWS));
  sheet.getRange(mcuStartRow, 17, rowsToWrite, 4).setValues(blockData.slice(0, rowsToWrite));
  sheet.getRange(mcuStartRow, 22, rowsToWrite, 1).setValues(blockKet.slice(0, rowsToWrite));

  return { written: Math.min(mcu.length, MAX_MCU_ROWS) };
}

// ─── Helper: Cari baris awal MCU ───

function findMcuStartRow(sheet, dateRow) {
  // ✅ BATCH: baca kolom Q-R dari dateRow sampai dateRow+10
  var block = sheet.getRange(dateRow, 17, 10, 2).getValues();
  for (var i = 0; i < block.length; i++) {
    var valQ = String(block[i][0]).trim().toUpperCase();
    var valR = String(block[i][1]).trim().toUpperCase();
    if (valQ === 'NO' && valR === 'PERUSAHAAN') {
      return dateRow + i + 1; // data mulai 1 baris di bawah header
    }
  }
  // Fallback: cari angka 1 di kolom Q
  for (var i = 0; i < block.length; i++) {
    var valQ = block[i][0];
    if (typeof valQ === 'number' && valQ === 1) return dateRow + i;
    if (String(valQ).trim() === '1') return dateRow + i;
  }
  return -1;
}

// ─── Helper: Cari baris awal data ───

function findDataStartRow(sheet, dateRow) {
  // ✅ BATCH: baca kolom A-B dari dateRow sampai dateRow+10
  var block = sheet.getRange(dateRow, 1, 10, 2).getValues();
  for (var i = 0; i < block.length; i++) {
    var valA = String(block[i][0]).trim().toUpperCase();
    var valB = String(block[i][1]).trim().toUpperCase();
    if (valA === 'KET' && valB === 'JAMINAN') {
      return dateRow + i + 2;
    }
  }
  return -1;
}

// ─── Helper: Cari sheet bulan ───

function findMonthSheet(ss, monthIdx) {
  var bulan = BULAN_NAMES[monthIdx];
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toUpperCase().indexOf(bulan) >= 0) return sheets[i];
  }
  var bulanEn = BULAN_NAMES_SHORT[monthIdx].toUpperCase();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toUpperCase().indexOf(bulanEn) >= 0) return sheets[i];
  }
  return null;
}

// ─── Helper: Cari baris tanggal ───

function findDateRow(sheet, dayNum, monthIdx, year) {
  var lastRow = Math.min(sheet.getLastRow(), 3000);
  var colADisplay = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();

  var bulanName = BULAN_NAMES_SHORT[monthIdx];
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

// ─── Parse Tanggal ───

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

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

---

## Changelog

### v2.1 (latest) — Fix 2 bug kritis
- **Bug 1**: Hapus hardcode `DEFAULT_NAMES`. Sekarang semua nama di kolom B sheet dipertahankan (tidak dihapus). Nama baru ditambahkan di baris kosong. Fix untuk INHEALTH PLUS dkk yg hilang dari urutan.
- **Bug 2**: Kolom U (TOTAL MCU) tidak disentuh sama sekali. Baca/tulis Q-T (4 kolom) dan V (1 kolom) terpisah, U dibiarkan utuh.

### v2.0 — Batch read/write
- `writeLaporanData`: ~200 API calls → 2 (1 getValues + 1 setValues)
- `writeMcuData`: ~50 API calls → 4 (2 getValues + 2 setValues)
- `findDataStartRow`, `findMcuStartRow`: individual getValue → batch getValues

---

## Perbandingan API Calls: Sebelum vs Sesudah

| Fungsi | Sebelum (per submit) | Sesudah (per submit) |
|--------|---------------------|----------------------|
| `writeLaporanData` — clear data lama | ~30 `setValues()` individual | **0** (modifikasi di memory) |
| `writeLaporanData` — scan baris kosong | ~150 `getValue()` individual (15 penjamin × 10 scan) | **0** (loop di array memory) |
| `writeLaporanData` — tulis data | ~20 `setValues()` individual per penjamin | **1 `setValues()`** (seluruh blok) |
| `writeLaporanData` — baca template | ~50 `getValue()` (colAB + colBAfter) | **1 `getValues()`** (50 baris × 14 kolom) |
| `writeMcuData` — clear data lama | ~20 `setValues()` individual + ~20 `getValue()` | **0** (modifikasi di memory) |
| `writeMcuData` — tulis data | ~15 `setValues()` individual | **1 `setValues()`** (seluruh blok) |
| `findDataStartRow` | ~10 `getValue()` individual | **1 `getValues()`** (10 baris × 2 kolom) |
| `findMcuStartRow` | ~10 `getValue()` individual | **1 `getValues()`** (10 baris × 2 kolom) |

**Total: ~300+ API calls → ~5 API calls** 🚀

---

## Cara Deploy

1. Buka [script.google.com](https://script.google.com) → project GAS Laporan Harian yg existing
2. **Ganti `SPREADSHEET_ID`** di baris paling atas dengan ID spreadsheet Laporan Harian
3. Replace seluruh kode dengan kode di atas
4. **Deploy → Manage deployments → Edit (pencil icon) → Deploy** (pakai deployment yg sama, URL tidak berubah)
5. Test submit dari frontend

> ⚠️ **PENTING**: JANGAN buat deployment baru — pakai deployment yg existing supaya URL `VITE_GAS_LAPORAN_URL` tidak perlu diubah.
