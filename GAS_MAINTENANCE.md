# GAS Backend — Maintenance Module

Google Apps Script untuk backend modul ceklis maintenance.
Deploy sebagai **Web App** (Execute as: Me, Who has access: Anyone).

## Sheet Structure

Spreadsheet memiliki 3 sheet:

### Sheet `MAINTENANCE`
| Col | Field | Type |
|-----|-------|------|
| A | id | string |
| B | alat | BC6800 / BC760 / CA500600 / EasyLyte / ALAT_UMUM |
| C | tipe | daily / weekly / monthly / as_needed |
| D | tanggal | YYYY-MM-DD |
| E | aktivitas | JSON string `{"Activity Name": true/false, ...}` |
| F | catatan | JSON string `{"Activity Name": "note", ...}` |
| G | catatan_umum | string |
| H | petugas | string |
| I | created_at | timestamp (auto) |

### Sheet `UJI_FUNGSI`
| Col | Field | Type |
|-----|-------|------|
| A | id | string |
| B | alat | BC6800 / BC760 / CA500600 / EasyLyte |
| C | tanggal | YYYY-MM-DD |
| D | fungsi | baik / rusak |
| E | petugas | string |
| F | keterangan | string |
| G | created_at | timestamp (auto) |

### Sheet `LAPORAN_VALIDASI`
| Col | Field | Type |
|-----|-------|------|
| A | id | string |
| B | alat | BC6800 / BC760 / CA500600 / EasyLyte |
| C | tipe | daily / weekly / monthly / as_needed |
| D | bulan | YYYY-MM |
| E | pic_alat | string (nama PIC alat) |
| F | ka_lab | string (nama KA lab) |
| G | updated_at | timestamp (auto) |

## API Reference

```
GET  ?action=ping
GET  ?action=getRecords[&alat=X&bulan=YYYY-MM]
GET  ?action=getUjiFungsi&alat=X&bulan=YYYY-MM
GET  ?action=getLaporanValidasi&alat=X&bulan=YYYY-MM[&tipe=X]

POST  body: { action, ... }
  saveRecord            → { id, alat, tipe, tanggal, aktivitas, catatan, catatan_umum, petugas }
  deleteRecord          → { id }
  saveUjiFungsi         → { alat, bulan, data: [{ tanggal, fungsi, petugas, keterangan }] }
  deleteUjiFungsi       → { id }
  saveLaporanValidasi   → { id, alat, tipe, bulan, pic_alat, ka_lab }
```

## GAS Code

```javascript
// ─── Constants ──────────────────────────────────────────────────────────
var SHEET_MAINTENANCE = 'MAINTENANCE';
var SHEET_UJI_FUNGSI = 'UJI_FUNGSI';
var SHEET_LAPORAN_VALIDASI = 'LAPORAN_VALIDASI';

var MAINTENANCE_HEADERS = ['id', 'alat', 'tipe', 'tanggal', 'aktivitas', 'catatan', 'catatan_umum', 'petugas', 'created_at'];
var UJI_FUNGSI_HEADERS = ['id', 'alat', 'tanggal', 'fungsi', 'petugas', 'keterangan', 'created_at'];
var LAPORAN_VALIDASI_HEADERS = ['id', 'alat', 'tipe', 'bulan', 'pic_alat', 'ka_lab', 'updated_at'];

// ─── Helpers ────────────────────────────────────────────────────────────

function getOrCreateSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function rowToObj(row, headers) {
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    obj[headers[i]] = row[i] != null ? row[i] : '';
  }
  return obj;
}

function objToRow(obj, headers) {
  return headers.map(function(h) { return obj[h] != null ? obj[h] : ''; });
}

function findAllRows(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) { return rowToObj(row, headers); });
}

function findRowById(sheet, id) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return -1;
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === id) return i + 1; // 1-based row number
  }
  return -1;
}

function jsonParse(str, fallback) {
  try { return JSON.parse(str); } catch(e) { return fallback || {}; }
}

// Normalize date values from sheet (bisa string, Date object, atau hasil toString Date)
function dateStr(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  var str = String(val || '');
  // Handle Date.toString() output: "Sat Jun 13 2026 00:00:00 GMT+0700 (WIT)"
  var parsed = new Date(str);
  if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return str;
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── GET Handler ────────────────────────────────────────────────────────

function doGet(e) {
  var action = (e.parameter.action || '').toString();
  var alat = (e.parameter.alat || '').toString();
  var bulan = (e.parameter.bulan || '').toString(); // YYYY-MM

  if (action === 'ping') {
    return respond({
      status: 'ok',
      service: 'maintenance-gs-backend',
      connected: true
    });
  }

  if (action === 'getRecords') {
    var sheet = getOrCreateSheet(SHEET_MAINTENANCE, MAINTENANCE_HEADERS);
    var rows = findAllRows(sheet);

    // Filter
    if (alat) {
      rows = rows.filter(function(r) { return r.alat === alat; });
    }
    if (bulan) {
      rows = rows.filter(function(r) { return dateStr(r.tanggal).indexOf(bulan) === 0; });
    }

    // Parse JSON fields and normalize dates
    rows = rows.map(function(r) {
      r.tanggal = dateStr(r.tanggal);
      r.aktivitas = jsonParse(r.aktivitas, {});
      r.catatan = jsonParse(r.catatan, {});
      return r;
    });

    return respond({ success: true, data: rows });
  }

  if (action === 'getLaporanValidasi') {
    var tipe = (e.parameter.tipe || '').toString();
    if (!alat || !bulan) {
      return respond({ success: false, error: 'alat dan bulan required' });
    }
    var sheet = getOrCreateSheet(SHEET_LAPORAN_VALIDASI, LAPORAN_VALIDASI_HEADERS);
    var rows = findAllRows(sheet);
    rows = rows.filter(function(r) {
      var match = r.alat === alat && r.bulan === bulan;
      if (tipe) match = match && r.tipe === tipe;
      return match;
    });
    return respond({ success: true, data: rows });
  }

  if (action === 'getUjiFungsi') {
    if (!alat || !bulan) {
      return respond({ success: false, error: 'alat dan bulan required' });
    }

    var sheet = getOrCreateSheet(SHEET_UJI_FUNGSI, UJI_FUNGSI_HEADERS);
    var rows = findAllRows(sheet);

    rows = rows.filter(function(r) {
      return r.alat === alat && dateStr(r.tanggal).indexOf(bulan) === 0;
    });

    // Normalize date strings
    rows = rows.map(function(r) {
      r.tanggal = dateStr(r.tanggal);
      return r;
    });

    return respond({ success: true, data: rows });
  }

  return respond({ success: false, error: 'Unknown action: ' + action });
}

// ─── POST Handler ───────────────────────────────────────────────────────

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond({ success: false, error: 'Invalid JSON: ' + err.message });
  }

  var action = body.action || '';

  // ── saveRecord ──────────────────────────────────────────────────────
  if (action === 'saveRecord') {
    var sheet = getOrCreateSheet(SHEET_MAINTENANCE, MAINTENANCE_HEADERS);

    // Serialize JSON fields
    var aktivitas = typeof body.aktivitas === 'object' ? JSON.stringify(body.aktivitas) : (body.aktivitas || '{}');
    var catatan = typeof body.catatan === 'object' ? JSON.stringify(body.catatan) : (body.catatan || '{}');

    // Upsert: cek apakah id sudah ada
    var existingRow = findRowById(sheet, body.id);
    var now = new Date().toISOString();

    var rowData = [
      body.id || '',
      body.alat || '',
      body.tipe || '',
      body.tanggal || '',
      aktivitas,
      catatan,
      body.catatan_umum || '',
      body.petugas || '',
      now
    ];

    if (existingRow > 0) {
      // Update existing
      for (var c = 0; c < rowData.length; c++) {
        sheet.getRange(existingRow, c + 1).setValue(rowData[c]);
      }
    } else {
      // Insert new
      sheet.appendRow(rowData);
    }

    return respond({ success: true, id: body.id });
  }

  // ── deleteRecord ────────────────────────────────────────────────────
  if (action === 'deleteRecord') {
    var sheet = getOrCreateSheet(SHEET_MAINTENANCE, MAINTENANCE_HEADERS);
    var row = findRowById(sheet, body.id);

    if (row > 0) {
      sheet.deleteRow(row);
      return respond({ success: true, deleted: body.id });
    }
    return respond({ success: false, error: 'Record not found: ' + body.id });
  }

  // ── saveUjiFungsi ───────────────────────────────────────────────────
  // Bulk save untuk satu bulan — hapus data existing bulan itu lalu insert ulang
  if (action === 'saveUjiFungsi') {
    var alat = body.alat || '';
    var bulanPrefix = body.bulan || ''; // YYYY-MM
    var data = body.data || [];

    if (!alat || !bulanPrefix) {
      return respond({ success: false, error: 'alat dan bulan required' });
    }

    var ufSheet = getOrCreateSheet(SHEET_UJI_FUNGSI, UJI_FUNGSI_HEADERS);
    var allRows = findAllRows(ufSheet);

    // Hapus semua row existing untuk alat+bulan ini
    var rowsToDelete = [];
    for (var i = 0; i < allRows.length; i++) {
      if (allRows[i].alat === alat && dateStr(allRows[i].tanggal).indexOf(bulanPrefix) === 0) {
        rowsToDelete.push(i + 2); // +2 karena 1-based + header
      }
    }
    // Delete from bottom to top to preserve row indices
    rowsToDelete.sort(function(a, b) { return b - a; });
    for (var di = 0; di < rowsToDelete.length; di++) {
      ufSheet.deleteRow(rowsToDelete[di]);
    }

    // Insert new data
    var now = new Date().toISOString();
    for (var di = 0; di < data.length; di++) {
      var d = data[di];
      ufSheet.appendRow([
        d.id || (alat + '-' + d.tanggal),
        alat,
        d.tanggal || '',
        d.fungsi || '',
        d.petugas || '',
        d.keterangan || '',
        now
      ]);
    }

    return respond({ success: true, count: data.length, deleted: rowsToDelete.length });
  }

  // ── saveLaporanValidasi ────────────────────────────────────────────
  if (action === 'saveLaporanValidasi') {
    var sheet = getOrCreateSheet(SHEET_LAPORAN_VALIDASI, LAPORAN_VALIDASI_HEADERS);
    var vid = body.id || (body.alat + '-' + body.tipe + '-' + body.bulan);
    var existingRow = findRowById(sheet, vid);
    var now = new Date().toISOString();
    var rowData = [
      vid,
      body.alat || '',
      body.tipe || '',
      body.bulan || '',
      body.pic_alat || '',
      body.ka_lab || '',
      now
    ];
    if (existingRow > 0) {
      for (var c = 0; c < rowData.length; c++) {
        sheet.getRange(existingRow, c + 1).setValue(rowData[c]);
      }
    } else {
      sheet.appendRow(rowData);
    }
    return respond({ success: true, id: vid });
  }

  // ── deleteUjiFungsi ─────────────────────────────────────────────────
  if (action === 'deleteUjiFungsi') {
    var ufSheet = getOrCreateSheet(SHEET_UJI_FUNGSI, UJI_FUNGSI_HEADERS);
    var row = findRowById(ufSheet, body.id);

    if (row > 0) {
      ufSheet.deleteRow(row);
      return respond({ success: true, deleted: body.id });
    }
    return respond({ success: false, error: 'Record not found: ' + body.id });
  }

  return respond({ success: false, error: 'Unknown action: ' + action });
}

// ─── Initialization ─────────────────────────────────────────────────────

function onOpen() {
  // Ensure sheets exist when spreadsheet is opened
  getOrCreateSheet(SHEET_MAINTENANCE, MAINTENANCE_HEADERS);
  getOrCreateSheet(SHEET_UJI_FUNGSI, UJI_FUNGSI_HEADERS);
  getOrCreateSheet(SHEET_LAPORAN_VALIDASI, LAPORAN_VALIDASI_HEADERS);
}
```

## Deployment Steps

1. Buka Google Sheets baru, beri nama misal **"MAINTENANCE LAB 2026"**
2. Extensions → Apps Script
3. Paste kode di atas
4. Save project (Ctrl+S), beri nama misal **"GAS Maintenance Backend"**
5. Deploy → New Deployment → Web App:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy URL hasil deploy
7. Set di `.env.local`:
   ```
   VITE_GAS_MAINTENANCE_URL=<URL hasil deploy>
   ```

## Testing

Setelah deploy, test via curl:

```bash
# Ping
curl "<URL>?action=ping"

# Save record
curl -X POST "<URL>" \
  -H "Content-Type: text/plain" \
  -d '{"action":"saveRecord","id":"test-1","alat":"BC6800","tipe":"daily","tanggal":"2026-06-13","aktivitas":{"Rinse Probe":true,"Washing Block":false},"catatan":{},"catatan_umum":"","petugas":"Test"}'

# Get all records
curl "<URL>?action=getRecords"

# Get records filtered
curl "<URL>?action=getRecords&alat=BC6800&bulan=2026-06"

# Delete record
curl -X POST "<URL>" \
  -H "Content-Type: text/plain" \
  -d '{"action":"deleteRecord","id":"test-1"}'

# Save Uji Fungsi bulk
curl -X POST "<URL>" \
  -H "Content-Type: text/plain" \
  -d '{"action":"saveUjiFungsi","alat":"BC6800","bulan":"2026-06","data":[{"id":"uf-1","tanggal":"2026-06-01","fungsi":"baik","petugas":"Test","keterangan":""},{"id":"uf-2","tanggal":"2026-06-02","fungsi":"rusak","petugas":"Test","keterangan":"error"}]}'

# Get Uji Fungsi
curl "<URL>?action=getUjiFungsi&alat=BC6800&bulan=2026-06"
```
