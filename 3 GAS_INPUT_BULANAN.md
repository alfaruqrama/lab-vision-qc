# Google Apps Script — Input Harian → Sheet KUNJUNGAN 2026 (v3)

**Tanggal update:** 7 November 2026  

## Kode Input Harian v3 — `VITE_GAS_INPUT_URL`

```javascript
// ============================================
// INPUT HARIAN → SHEET KUNJUNGAN 2026 (v3)
// Portal Lab RS Petrokimia Gresik
// Update: 7 November 2026 — sinkronisasi 10 payer, data B-AI, total AJ, kumulatif MCU
// ============================================

var SHEET_KUNJUNGAN = 'KUNJUNGAN 2026';
var SHEET_OMSET_HARIAN = 'OMSET HARIAN 2026';
var SHEET_OMZET_MCU = 'OMZET MCU 2026';

var BULAN_NAMES = [
  'JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI',
  'JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'
];

var BADGE_TO_IDX = {
  'PG': 0, 'NPG': 1, 'BRI LIFE PG': 2, 'INHEALTH PG': 3, 'AS': 4,
  'PROKESPEN': 5, 'PROKESPEN BPJS': 6, 'BPJS': 7, 'JKK': 8, 'UMUM': 9
};

var MCU_BADGE_TO_IDX = {
  'PG': 0, 'NPG': 1, 'AS': 2, 'UMUM': 3
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
    // ⚠️ inputLaporan tetap di GAS LAPORAN (terpisah)
    return jsonResponse({ error: 'Unknown action: ' + body.action });
  } catch (err) {
    return jsonResponse({ error: err.message || String(err) });
  }
}

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
  if (action === 'getKumulatif') {
    return handleGetKumulatif(e.parameter);
  }
  // 🆕 v3: Kumulatif MCU dari sheet OMZET MCU 2026
  if (action === 'getKumulatifMCU') {
    return handleGetKumulatifMCU(e);
  }
  return jsonResponse({ status: 'ok', service: 'inputHarian', message: 'Use POST to submit data' });
}

// ─── Check Day (OPTIMIZED - batch read) ───

function handleCheckDay(params) {
  var tanggal = params.tanggal || '';
  var parsed = parseTanggal(tanggal);
  if (!parsed) return jsonResponse({ error: 'Invalid tanggal: ' + tanggal });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_KUNJUNGAN);
  if (!sheet) return jsonResponse({ error: 'Sheet "' + SHEET_KUNJUNGAN + '" tidak ditemukan' });

  var headerRow = findMonthHeaderRow(sheet, parsed.monthIdx);
  if (headerRow < 0) return jsonResponse({ error: 'Bulan ' + BULAN_NAMES[parsed.monthIdx] + ' tidak ditemukan di sheet' });

  var numRows = 38;
  var block = sheet.getRange(headerRow + 2, 1, numRows, 36).getValues(); // A-AJ: data B-AI + total AJ

  for (var i = 0; i < block.length; i++) {
    var cellA = block[i][0];
    var cellANum = typeof cellA === 'number' ? cellA : parseInt(String(cellA), 10);
    if (cellANum === parsed.dayNum) {
      var hasData = false;
      for (var c = 1; c <= 34; c++) {
        if (typeof block[i][c] === 'number' && block[i][c] > 0) { hasData = true; break; }
      }
      var totalKunj = block[i][35] || 0;
      return jsonResponse({
        status: 'ok', tanggal: tanggal, dayNum: parsed.dayNum,
        bulan: BULAN_NAMES[parsed.monthIdx], hasData: hasData,
        totalKunjungan: totalKunj
      });
    }
  }
  return jsonResponse({ error: 'Hari ' + parsed.dayNum + ' tidak ditemukan di bulan ' + BULAN_NAMES[parsed.monthIdx] });
}

// ─── Get Target (OPTIMIZED - batch read) ───

function handleGetTarget(params) {
  var tanggal = params.tanggal || '';
  var parsed = parseTanggal(tanggal);
  if (!parsed) return jsonResponse({ error: 'Invalid tanggal: ' + tanggal });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_OMSET_HARIAN);
  if (!sheet) return jsonResponse({ error: 'Sheet "' + SHEET_OMSET_HARIAN + '" tidak ditemukan' });

  var bulanName = BULAN_NAMES[parsed.monthIdx];
  var lastRow = Math.min(sheet.getLastRow(), 2000);
  var colA = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();

  var monthHeaderRow = -1;
  for (var i = 0; i < colA.length; i++) {
    var val = colA[i][0].trim().toUpperCase();
    if (val.indexOf(bulanName) >= 0 && val.indexOf('2026') >= 0) { monthHeaderRow = i + 1; break; }
  }
  if (monthHeaderRow < 0) return jsonResponse({ error: 'Bulan ' + bulanName + ' tidak ditemukan' });

  var dataStartRow = monthHeaderRow + 2;
  var block = sheet.getRange(dataStartRow, 1, 35, 7).getValues();

  var targetOmzetHarian = 0, targetKunjHarian = 0;
  for (var d = 0; d < Math.min(31, block.length); d++) {
    var cellB = block[d][1];
    var cellBNum = typeof cellB === 'number' ? cellB : parseInt(String(cellB).trim(), 10);
    if (cellBNum === parsed.dayNum) {
      targetOmzetHarian = typeof block[d][2] === 'number' ? block[d][2] : parseFloat(String(block[d][2]).replace(/[^\d.-]/g, '')) || 0;
      targetKunjHarian = typeof block[d][6] === 'number' ? block[d][6] : parseInt(String(block[d][6]).replace(/[^\d]/g, ''), 10) || 0;
      break;
    }
  }

  var targetOmzetBulan = 0, targetKunjBulan = 0;
  for (var i = 0; i < block.length; i++) {
    var val = String(block[i][0]).trim().toLowerCase();
    if (val.indexOf('target real') >= 0) {
      targetOmzetBulan = typeof block[i][2] === 'number' ? block[i][2] : parseFloat(String(block[i][2]).replace(/[^\d.-]/g, '')) || 0;
      targetKunjBulan = typeof block[i][6] === 'number' ? block[i][6] : parseInt(String(block[i][6]).replace(/[^\d]/g, ''), 10) || 0;
      break;
    }
  }

  return jsonResponse({
    status: 'ok', tanggal: tanggal, bulan: bulanName, dayNum: parsed.dayNum,
    targetOmzetHarian: targetOmzetHarian, targetKunjHarian: targetKunjHarian,
    targetOmzetBulan: targetOmzetBulan, targetKunjBulan: targetKunjBulan
  });
}

// ─── Get Kumulatif (OPTIMIZED - batch read kolom D & F) ───

function handleGetKumulatif(params) {
  var tanggal = params.tanggal || '';
  var parsed = parseTanggal(tanggal);
  if (!parsed) return jsonResponse({ error: 'Invalid tanggal: ' + tanggal });

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_OMSET_HARIAN);
  if (!sheet) return jsonResponse({ error: 'Sheet "' + SHEET_OMSET_HARIAN + '" tidak ditemukan' });

  var bulanName = BULAN_NAMES[parsed.monthIdx];
  var lastRow = Math.min(sheet.getLastRow(), 2000);
  var colA = sheet.getRange(1, 1, lastRow, 1).getDisplayValues();

  var monthHeaderRow = -1;
  for (var i = 0; i < colA.length; i++) {
    var val = colA[i][0].trim().toUpperCase();
    if (val.indexOf(bulanName) >= 0 && val.indexOf('2026') >= 0) { monthHeaderRow = i + 1; break; }
  }
  if (monthHeaderRow < 0) return jsonResponse({ error: 'Bulan ' + bulanName + ' tidak ditemukan' });

  var dataStartRow = monthHeaderRow + 2;

  if (parsed.dayNum <= 1) {
    return jsonResponse({ status: 'ok', tanggal: tanggal, bulan: bulanName,
      kumOmzet: 0, kumKunj: 0, tglAkhir: 0
    });
  }

  var numDays = parsed.dayNum - 1;
  var block = sheet.getRange(dataStartRow, 2, numDays, 5).getValues(); // B-F

  var kumOmzet = 0, kumKunj = 0;
  for (var d = 0; d < block.length; d++) {
    var cellB = block[d][0];
    var cellBNum = typeof cellB === 'number' ? cellB : parseInt(String(cellB).trim(), 10);
    if (isNaN(cellBNum) || cellBNum < 1 || cellBNum > 31) continue;
    var rawD = block[d][2];
    kumOmzet += typeof rawD === 'number' ? rawD : parseFloat(String(rawD).replace(/[^\d.-]/g, '')) || 0;
    var rawF = block[d][4];
    kumKunj += typeof rawF === 'number' ? rawF : parseInt(String(rawF).replace(/[^\d]/g, ''), 10) || 0;
  }

  return jsonResponse({
    status: 'ok', tanggal: tanggal, bulan: bulanName,
    kumOmzet: kumOmzet, kumKunj: kumKunj, tglAkhir: parsed.dayNum - 1
  });
}

// ─── 🆕 Get Kumulatif MCU (v3) ───
// Baca sheet OMZET MCU 2026 untuk omzet MCU + sheet KUNJUNGAN 2026 untuk kunjungan MCU

function handleGetKumulatifMCU(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  var tanggal = p.tanggal || '';
  var parsed = parseTanggal(tanggal);
  if (!parsed) return jsonResponse({ error: 'Invalid tanggal: ' + tanggal });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var bulanName = BULAN_NAMES[parsed.monthIdx];
  var kumOmzetMCU = 0, kumKunjMCU = 0;
  var debugOmzet = []; // 🐛

  // 1. Omzet MCU dari sheet OMZET MCU 2026
  // Layout: kolom A = tanggal (1-31), kolom B-M = JANUARI-DESEMBER
  // Data mulai baris 3 (tgl 1)
  var sheetMCU = ss.getSheetByName(SHEET_OMZET_MCU);
  if (sheetMCU && parsed.dayNum > 1) {
    var colMCU = parsed.monthIdx + 2; // Jan = kolom 2 (B)
    var numRows = Math.min(parsed.dayNum - 1, 31);
    var block = sheetMCU.getRange(3, colMCU, numRows, 1).getValues();
    for (var i = 0; i < block.length; i++) {
      if (typeof block[i][0] === 'number') {
        kumOmzetMCU += block[i][0];
        debugOmzet.push('tgl' + (i+1) + '=' + block[i][0]);
      }
    }
  }

  // 2. Kunjungan MCU dari sheet KUNJUNGAN 2026
  // Kolom AF-AI (index 32-35) = MCU untuk 4 payer (PG, NPG, AS, UMUM)
  var sheetKunj = ss.getSheetByName(SHEET_KUNJUNGAN);
  if (sheetKunj && parsed.dayNum > 1) {
    var headerRow = findMonthHeaderRow(sheetKunj, parsed.monthIdx);
    if (headerRow >= 0) {
      var dataStartRow = headerRow + 2; // baris setelah header + sub-header
      var kunjBlock = sheetKunj.getRange(dataStartRow, 32, parsed.dayNum - 1, 4).getValues();
      for (var r = 0; r < kunjBlock.length; r++) {
        for (var c = 0; c < 4; c++) {
          if (typeof kunjBlock[r][c] === 'number') kumKunjMCU += kunjBlock[r][c];
        }
      }
    }
  }

  return jsonResponse({
    status: 'ok',
    tanggal: tanggal,
    bulan: bulanName,
    monthIdx: parsed.monthIdx,
    colMCU: parsed.monthIdx + 2,
    kumOmzetMCU: Math.round(kumOmzetMCU),
    kumKunjMCU: Math.round(kumKunjMCU),
    tglAkhir: Math.max(0, parsed.dayNum - 1),
    debugOmzet: debugOmzet.join(', ')
  });
}

// ─── Handle Input Harian (OPTIMIZED - batch read + write) ───

function handleInputHarian(body) {
  var tanggal = body.tanggal || '';
  var kunjungan = body.kunjungan || [];
  var mcu = body.mcu || [];

  var parsed = parseTanggal(tanggal);
  if (!parsed) return jsonResponse({ error: 'Invalid tanggal: ' + tanggal });

  var dayNum = parsed.dayNum;
  var monthIdx = parsed.monthIdx;

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_KUNJUNGAN);
  if (!sheet) return jsonResponse({ error: 'Sheet "' + SHEET_KUNJUNGAN + '" tidak ditemukan' });

  var headerRow = findMonthHeaderRow(sheet, monthIdx);
  if (headerRow < 0) return jsonResponse({ error: 'Bulan ' + BULAN_NAMES[monthIdx] + ' tidak ditemukan di sheet' });

  // ── Aggregate per badge ──
  var rj = [0,0,0,0,0,0,0,0,0,0];
  var ri = [0,0,0,0,0,0,0,0,0,0];
  var igd = [0,0,0,0,0,0,0,0,0,0];
  var mcuData = [0,0,0,0];

  for (var k = 0; k < kunjungan.length; k++) {
    var r = kunjungan[k];
    var badge = r.badge || '';
    var idx = BADGE_TO_IDX[badge];
    if (idx === undefined) continue;

    rj[idx] += (r.rjYani || 0) + (r.promo || 0) + (r.dokter || 0) +
               (r.exc || 0) + (r.prior || 0) + (r.grhuRj || 0) +
               (r.sat || 0) + (r.ppk1 || 0);
    ri[idx] += (r.riYani || 0) + (r.grhuRi || 0);
    igd[idx] += (r.igd || 0);
    var mcuIdx = MCU_BADGE_TO_IDX[badge];
    if (mcuIdx !== undefined) mcuData[mcuIdx] += (r.mcuAuto || 0);
  }

  // ── Cari baris hari ──
  var colABlock = sheet.getRange(headerRow + 2, 1, 38, 1).getValues();
  var dayRow = -1;
  for (var i = 0; i < colABlock.length; i++) {
    var cellA = colABlock[i][0];
    var cellANum = typeof cellA === 'number' ? cellA : parseInt(String(cellA), 10);
    if (cellANum === dayNum) { dayRow = headerRow + 2 + i; break; }
  }
  if (dayRow < 0) {
    return jsonResponse({ error: 'Baris hari ' + dayNum + ' tidak ditemukan di bulan ' + BULAN_NAMES[monthIdx] });
  }

  // Tulis 34 kolom data B-AI; AJ (total kunjungan) tetap memakai formula sheet.
  var rowData = [];
  for (var i = 0; i < 10; i++) rowData.push(rj[i]);
  for (var i = 0; i < 10; i++) rowData.push(ri[i]);
  for (var i = 0; i < 10; i++) rowData.push(igd[i]);
  for (var i = 0; i < 4; i++) rowData.push(mcuData[i]);

  var totalKunj = 0;
  for (var i = 0; i < rowData.length; i++) totalKunj += rowData[i];

  sheet.getRange(dayRow, 2, 1, 34).setValues([rowData]);
  updateTotalRow(sheet, headerRow);

  return jsonResponse({
    status: 'ok',
    message: 'Data tanggal ' + tanggal + ' berhasil ditulis',
    bulan: BULAN_NAMES[monthIdx], hari: dayNum, totalKunjungan: totalKunj
  });
}

// ─── Helpers ───

function findMonthHeaderRow(sheet, monthIdx) {
  var bulanName = BULAN_NAMES[monthIdx];
  var lastRow = sheet.getLastRow();
  var colA = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (var i = 0; i < colA.length; i++) {
    if (String(colA[i][0]).trim().toUpperCase() === bulanName) return i + 1;
  }
  return -1;
}

function updateTotalRow(sheet, headerRow) {
  var firstDayRow = headerRow + 2;
  var allData = sheet.getRange(firstDayRow, 2, 31, 34).getValues();

  var totals = [];
  for (var c = 0; c < 34; c++) {
    var sum = 0;
    for (var r = 0; r < 31; r++) {
      if (typeof allData[r][c] === 'number') sum += allData[r][c];
    }
    totals.push(sum);
  }

  var totalBlock = sheet.getRange(firstDayRow + 31, 1, 6, 1).getValues();
  var totalRow = -1;
  for (var i = 0; i < totalBlock.length; i++) {
    if (String(totalBlock[i][0]).trim().toUpperCase() === 'TOTAL') { totalRow = firstDayRow + 31 + i; break; }
  }

  if (totalRow > 0) {
    sheet.getRange(totalRow, 2, 1, 34).setValues([totals]);

    var subBlock = sheet.getRange(totalRow + 1, 1, 3, 1).getValues();
    var subTotalRow = -1;
    for (var i = 0; i < subBlock.length; i++) {
      var val = String(subBlock[i][0]).trim().toLowerCase();
      if (val.indexOf('sub total') >= 0 || val.indexOf('sub') >= 0) { subTotalRow = totalRow + 1 + i; break; }
    }

    if (subTotalRow > 0) {
      var rjTotal = 0, riTotal = 0, igdTotal = 0, mcuTotal = 0;
      for (var i = 0; i < 10; i++) rjTotal += totals[i];
      for (var i = 10; i < 20; i++) riTotal += totals[i];
      for (var i = 20; i < 30; i++) igdTotal += totals[i];
      for (var i = 30; i < 34; i++) mcuTotal += totals[i];

      var subRow = [
        'RAWAT JALAN :', rjTotal, '', '', '', '', '', '', '', '',
        'RAWAT INAP :', riTotal, '', '', '', '', '', '', '', '',
        'IGD :', igdTotal, '', '', '', '', '', '', '', '',
        'MCU : ', mcuTotal, '', ''
      ];
      sheet.getRange(subTotalRow, 2, 1, subRow.length).setValues([subRow]);
    }
  }
}

function parseTanggal(tanggal) {
  var parts = tanggal.trim().split(/[\s\-\/]+/);
  if (parts.length < 3) return null;
  var p0 = parseInt(parts[0], 10);
  if (isNaN(p0)) return null;
  if (p0 >= 1000) {
    var m = parseInt(parts[1], 10);
    var d = parseInt(parts[2], 10);
    if (!isNaN(m) && !isNaN(d) && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return { dayNum: d, monthIdx: m - 1 };
    }
  }
  var m2 = parseInt(parts[1], 10);
  if (!isNaN(m2) && m2 >= 1 && m2 <= 12 && p0 >= 1 && p0 <= 31) {
    return { dayNum: p0, monthIdx: m2 - 1 };
  }
  return null;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### ✅ Yang baru (v3):
| Action | Sheet | Return |
|--------|-------|--------|
| `getKumulatifMCU` | OMZET MCU 2026 + KUNJUNGAN 2026 | `{ kumOmzetMCU, kumKunjMCU, tglAkhir }` |

---

## Deploy Input Harian v3

Gunakan dokumen ini hanya untuk endpoint `VITE_GAS_INPUT_URL`.

1. Buka project Apps Script yang melayani `VITE_GAS_INPUT_URL`.
2. Ganti seluruh kode dengan script v3 di atas.
3. Deploy versi baru pada deployment yang sama agar URL tidak berubah.
4. Uji `inputHarian`, `checkDay`, dan `getKumulatifMCU`.

Dua kode GAS lainnya punya dokumentasi terpisah: [Dashboard](GAS_DASHBOARD_2026.md) dan [Input → Sheet Laporan Kunjungan Harian](GAS_LAPORAN_HARIAN_FIX.md).
