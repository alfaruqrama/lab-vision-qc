# GAS QC Backend — Complete Script

> Version: 1.0.0  
> Generated: 2026-05-10  
> Spreadsheet: `1hB6rqKbV1WLE4CpN94T3kEYF_eDG0OCt4nmFhODzCzk`  
> Auth Spreadsheet: `1PvfQButVEc7ChDCHEnn8IOpPabFXzUWxYh6BWCNmkWg`

Copy seluruh kode di bawah ke Google Apps Script editor, lalu ikuti `GAS_QC_SETUP.md`.

---

```javascript
// ============================================================
// GAS QC Backend — Lab Vision QC
// Version: 1.0.0 | 2026-05-10
// Spreadsheet: database QC
// ============================================================

// ─── CONFIG ─────────────────────────────────────────────────

const QC_SPREADSHEET_ID = '1hB6rqKbV1WLE4CpN94T3kEYF_eDG0OCt4nmFhODzCzk';
const AUTH_SPREADSHEET_ID = '1PvfQButVEc7ChDCHEnn8IOpPabFXzUWxYh6BWCNmkWg';
const SHEET_QC = 'qc record';
const SHEET_LOT = 'lot config';
const SHEET_USERS = 'Users';
const ADMIN_EMAIL = Session.getActiveUser().getEmail();

// ─── ENTRY POINTS ────────────────────────────────────────────

function doGet(e) {
  try {
    const params = e.parameter || {};
    // Support Safari workaround: payload via GET query param
    if (params.payload) {
      const parsed = JSON.parse(decodeURIComponent(params.payload));
      return handleAction(parsed);
    }
    return handleAction(params);
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    return handleAction(payload);
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

// ─── ROUTER ──────────────────────────────────────────────────

function handleAction(payload) {
  const action = payload.action;

  switch (action) {
    case 'getByMonth':   return handleGetByMonth(payload);
    case 'getKonfig':    return handleGetKonfig(payload);
    case 'save':         return handleSave(payload);
    case 'saveBulk':     return handleSaveBulk(payload);
    case 'saveKonfig':   return handleSaveKonfig(payload);
    case 'delete':       return handleDelete(payload);
    case 'export':       return handleExport(payload);
    case 'ping':         return jsonResponse({ status: 'ok', version: '1.0.0' });
    default:
      return jsonResponse({ status: 'error', message: 'Unknown action: ' + action });
  }
}

// ─── AUTH HELPER ─────────────────────────────────────────────

/**
 * Validate token against Users sheet in auth spreadsheet.
 * Returns user object { username, nama, role } or null if invalid.
 */
function validateToken(token) {
  if (!token) return null;
  try {
    const ss = SpreadsheetApp.openById(AUTH_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_USERS);
    if (!sheet) return null;

    const data = sheet.getDataRange().getValues();
    // Row 1 = headers, skip
    // Columns: A=username, B=nama, C=role, D=password(hash), E=isActive, F=?, G=token, H=expiry
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowToken = String(row[6] || '').trim();
      const expiry = row[7];
      const isActive = row[4];

      if (rowToken === token) {
        // Check expiry
        if (expiry && Date.now() > Number(expiry)) return null;
        // Check active
        if (isActive === false || isActive === 'FALSE' || isActive === 0) return null;

        return {
          username: String(row[0] || '').trim(),
          nama: String(row[1] || '').trim(),
          role: String(row[2] || '').trim(),
        };
      }
    }
    return null;
  } catch (err) {
    logError('validateToken', err);
    return null;
  }
}

function requireAuth(payload) {
  const user = validateToken(payload.token);
  if (!user) throw new Error('Unauthorized — token tidak valid atau expired');
  return user;
}

// ─── HANDLERS ────────────────────────────────────────────────

/**
 * GET: getByMonth
 * Params: token, month (format: "MEI" / "2026-05" / "05-2026")
 * Returns records for the given month.
 */
function handleGetByMonth(payload) {
  const user = requireAuth(payload);
  const month = String(payload.month || '').trim().toUpperCase();
  if (!month) return jsonResponse({ status: 'error', message: 'Parameter month diperlukan' });

  const sheet = getQcSheet();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue; // skip empty rows

    const tanggal = String(row[1] || '');
    if (!rowMatchesMonth(tanggal, month)) continue;

    records.push(rowToRecord(headers, row));
  }

  return jsonResponse({ status: 'ok', data: records, count: records.length });
}

/**
 * GET: getKonfig
 * Returns lot config as structured object matching frontend LotConfig type.
 */
function handleGetKonfig(payload) {
  requireAuth(payload);

  const sheet = getLotSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    return jsonResponse({ status: 'ok', data: buildEmptyConfig() });
  }

  // Parse lot config rows into nested structure
  const config = buildEmptyConfig();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;

    const alat = String(row[0] || '').trim();   // A: alat (React key: CA660, EASYLITE, etc)
    const lot  = String(row[1] || '').trim();   // B: lot
    const exp  = String(row[2] || '').trim();   // C: expiry YYYY-MM-DD
    const level = String(row[3] || '').trim();  // D: level (Kontrol/NORMAL/HIGH/CTRL0/CTRL1/CTRL2)
    const param = String(row[4] || '').trim();  // E: param name (PT/APTT/INR/Na/K/Cl/GDA)
    const mean = Number(row[5]) || 0;           // F: mean
    const sd   = Number(row[6]) || 0;           // G: sd

    if (!alat || !lot || !level || !param) continue;

    // Find or create lot entry for this alat
    if (!config[alat]) config[alat] = [];
    let lotEntry = config[alat].find(l => l.lot === lot);
    if (!lotEntry) {
      lotEntry = { lot, exp };
      config[alat].push(lotEntry);
    }
    lotEntry.exp = exp;

    // Set param config
    if (!lotEntry[level]) lotEntry[level] = {};
    lotEntry[level][param] = { mean, sd };
  }

  return jsonResponse({ status: 'ok', data: config });
}

/**
 * POST: save
 * Body: { token, data: QCRecord }
 * Saves a single QC record. Auto-populates analis from token.
 */
function handleSave(payload) {
  const user = requireAuth(payload);
  const data = payload.data;
  if (!data) return jsonResponse({ status: 'error', message: 'Field data diperlukan' });

  const sheet = getQcSheet();
  ensureQcHeaders(sheet);

  // Check duplicate ID — overwrite if exists
  const existingRow = findRowById(sheet, data.id);
  const row = buildQcRow(data, user.username);

  if (existingRow > 0) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return jsonResponse({ status: 'ok', message: 'Record disimpan', id: data.id });
}

/**
 * POST: saveBulk
 * Body: { token, data: QCRecord[] }
 * Saves multiple QC records in one call.
 */
function handleSaveBulk(payload) {
  const user = requireAuth(payload);
  const records = payload.data;
  if (!Array.isArray(records) || records.length === 0) {
    return jsonResponse({ status: 'error', message: 'Field data harus array tidak kosong' });
  }

  const sheet = getQcSheet();
  ensureQcHeaders(sheet);

  let saved = 0;
  let overwritten = 0;

  for (const data of records) {
    if (!data || !data.id) continue;
    const row = buildQcRow(data, user.username);
    const existingRow = findRowById(sheet, data.id);
    if (existingRow > 0) {
      sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
      overwritten++;
    } else {
      sheet.appendRow(row);
      saved++;
    }
  }

  return jsonResponse({ status: 'ok', message: `${saved} disimpan, ${overwritten} diperbarui`, saved, overwritten });
}

/**
 * POST: saveKonfig
 * Body: { token, data: LotConfig }
 * Replaces entire lot config sheet with new data.
 */
function handleSaveKonfig(payload) {
  requireAuth(payload);
  const config = payload.data;
  if (!config) return jsonResponse({ status: 'error', message: 'Field data diperlukan' });

  const sheet = getLotSheet();

  // Clear existing data (keep header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }

  // Ensure headers
  ensureLotHeaders(sheet);

  // Flatten nested config into rows
  // Format: alat | lot | exp | level | param | mean | sd
  const rows = [];
  for (const [alat, lots] of Object.entries(config)) {
    if (!Array.isArray(lots)) continue;
    for (const lotEntry of lots) {
      const { lot, exp, ...levels } = lotEntry;
      for (const [level, params] of Object.entries(levels)) {
        if (typeof params !== 'object') continue;
        for (const [param, cfg] of Object.entries(params)) {
          rows.push([alat, lot, exp || '', level, param, cfg.mean || 0, cfg.sd || 0]);
        }
      }
    }
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 7).setValues(rows);
  }

  return jsonResponse({ status: 'ok', message: 'Lot config disimpan', rows: rows.length });
}

/**
 * POST: delete
 * Body: { token, id: string }
 * Deletes a QC record by ID.
 */
function handleDelete(payload) {
  requireAuth(payload);
  const id = String(payload.id || '').trim();
  if (!id) return jsonResponse({ status: 'error', message: 'Field id diperlukan' });

  const sheet = getQcSheet();
  const rowIndex = findRowById(sheet, id);

  if (rowIndex < 1) {
    return jsonResponse({ status: 'error', message: 'Record tidak ditemukan: ' + id });
  }

  sheet.deleteRow(rowIndex);
  return jsonResponse({ status: 'ok', message: 'Record dihapus', id });
}

/**
 * GET: export
 * Params: token, month (optional — if omitted, exports all)
 * Returns all records as CSV-friendly array.
 */
function handleExport(payload) {
  requireAuth(payload);
  const month = payload.month ? String(payload.month).trim().toUpperCase() : null;

  const sheet = getQcSheet();
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0]) continue;
    if (month) {
      const tanggal = String(row[1] || '');
      if (!rowMatchesMonth(tanggal, month)) continue;
    }
    records.push(rowToRecord(headers, row));
  }

  return jsonResponse({ status: 'ok', data: records, count: records.length, exportedAt: Date.now() });
}

// ─── SHEET HELPERS ───────────────────────────────────────────

function getQcSheet() {
  const ss = SpreadsheetApp.openById(QC_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_QC);
  if (!sheet) throw new Error('Sheet "' + SHEET_QC + '" tidak ditemukan');
  return sheet;
}

function getLotSheet() {
  const ss = SpreadsheetApp.openById(QC_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_LOT);
  if (!sheet) throw new Error('Sheet "' + SHEET_LOT + '" tidak ditemukan');
  return sheet;
}

function ensureQcHeaders(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, 13).getValues()[0];
  if (!firstRow[0]) {
    sheet.getRange(1, 1, 1, 13).setValues([[
      'id', 'tanggal', 'alat', 'lot', 'level',
      'nilai', 'mean', 'sd', 'cv', 'status',
      'rules', 'petugas', 'catatan'
    ]]);
  }
}

function ensureLotHeaders(sheet) {
  const firstRow = sheet.getRange(1, 1, 1, 7).getValues()[0];
  if (!firstRow[0]) {
    sheet.getRange(1, 1, 1, 7).setValues([[
      'alat', 'lot', 'exp', 'level', 'param', 'mean', 'sd'
    ]]);
  }
}

/**
 * Build a flat row array from a QCRecord payload.
 * Columns: id | tanggal | alat | lot | level | nilai | mean | sd | cv | status | rules | petugas | catatan
 *
 * Note: QCRecord from frontend has nested params/status objects.
 * We flatten to one row per record (all params combined as JSON strings).
 * This matches the sheet structure confirmed by user.
 */
function buildQcRow(data, username) {
  // Serialize nested objects to JSON strings for sheet storage
  const params  = data.params  ? JSON.stringify(data.params)  : '{}';
  const status  = data.status  ? JSON.stringify(normalizeStatus(data.status)) : '{}';
  const rules   = data.rules   ? (Array.isArray(data.rules) ? data.rules.join(';') : String(data.rules)) : '-';
  const catatan = data.catatan && data.catatan.trim() ? data.catatan.trim() : '-';

  // Map alat React key → Sheets display name
  const alatDisplay = ALAT_MAP[data.alat] || data.alat || '';

  // tanggal: store as timestamp (ms) per user preference
  const tanggalMs = data.tanggal ? new Date(data.tanggal).getTime() : Date.now();

  return [
    data.id || generateId(),  // A: id
    tanggalMs,                // B: tanggal (timestamp ms)
    alatDisplay,              // C: alat
    data.lot || '',           // D: lot
    data.level || '',         // E: level
    params,                   // F: nilai (params JSON)
    '',                       // G: mean (reserved — config is in lot config sheet)
    '',                       // H: sd (reserved)
    '',                       // I: cv (reserved)
    status,                   // J: status (JSON)
    rules,                    // K: rules (semicolon-separated)
    username,                 // L: petugas (from auth token)
    catatan,                  // M: catatan
  ];
}

function rowToRecord(headers, row) {
  const record = {};
  for (let i = 0; i < headers.length; i++) {
    const key = String(headers[i] || '').trim();
    let val = row[i];

    // Parse JSON fields
    if ((key === 'nilai' || key === 'status') && typeof val === 'string' && val.startsWith('{')) {
      try { val = JSON.parse(val); } catch (_) {}
    }

    // Parse rules
    if (key === 'rules' && typeof val === 'string' && val !== '-') {
      val = val.split(';').filter(Boolean);
    }

    // Map alat display name back to React key
    if (key === 'alat') {
      val = SHEETS_TO_ALAT[String(val)] || String(val);
    }

    // Normalize status values
    if (key === 'status' && typeof val === 'object') {
      val = denormalizeStatus(val);
    }

    record[key] = val;
  }
  return record;
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(id).trim()) return i + 1; // 1-indexed
  }
  return -1;
}

/**
 * Match a tanggal value (timestamp ms) to a month string.
 * Accepts month in formats: "MEI", "2026-05", "05-2026", "5"
 */
function rowMatchesMonth(tanggal, month) {
  let date;
  const ts = Number(tanggal);
  if (!isNaN(ts) && ts > 1000000000000) {
    date = new Date(ts);
  } else if (typeof tanggal === 'string' && tanggal.includes('-')) {
    date = new Date(tanggal);
  } else {
    return false;
  }

  if (isNaN(date.getTime())) return false;

  const monthNum = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  // Match against BULAN_ID name (e.g. "MEI")
  const BULAN = ['JANUARI','FEBRUARI','MARET','APRIL','MEI','JUNI',
                 'JULI','AGUSTUS','SEPTEMBER','OKTOBER','NOVEMBER','DESEMBER'];
  if (BULAN.includes(month)) {
    return BULAN[monthNum] === month;
  }

  // Match against "2026-05" or "05-2026"
  const parts = month.split('-');
  if (parts.length === 2) {
    const a = parseInt(parts[0]), b = parseInt(parts[1]);
    if (b > 12) { // "2026-05"
      return year === a && (monthNum + 1) === b;
    } else { // "05-2026"
      return (monthNum + 1) === a && year === b;
    }
  }

  // Match against plain month number "5"
  const n = parseInt(month);
  if (!isNaN(n)) return (monthNum + 1) === n;

  return false;
}

function buildEmptyConfig() {
  return { CA660: [], EASYLITE: [], ONCALL1: [], ONCALL2: [] };
}

// ─── INSTRUMENT MAPPING ──────────────────────────────────────

const ALAT_MAP = {
  CA660:   'Sysmex CA-660',
  EASYLITE: 'Easylite',
  ONCALL1: 'On Call Sure',
  ONCALL2: 'On Call Sure',
};

const SHEETS_TO_ALAT = {
  'Sysmex CA-660': 'CA660',
  'Easylite':      'EASYLITE',
  'On Call Sure':  'ONCALL1', // default — frontend differentiates by level
};

// ─── STATUS NORMALIZATION ────────────────────────────────────

// Frontend uses 'oos', Sheets uses 'ooc'
function normalizeStatus(statusObj) {
  const result = {};
  for (const [k, v] of Object.entries(statusObj)) {
    if (v === 'oos') result[k] = 'ooc';
    else if (v === 'warning') result[k] = 'warn';
    else result[k] = v;
  }
  return result;
}

function denormalizeStatus(statusObj) {
  const result = {};
  for (const [k, v] of Object.entries(statusObj)) {
    if (v === 'ooc') result[k] = 'oos';
    else if (v === 'warn') result[k] = 'warning';
    else result[k] = v;
  }
  return result;
}

// ─── UTILITIES ───────────────────────────────────────────────

function generateId() {
  return 'qc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function logError(context, err) {
  try {
    console.error('[GAS QC] ' + context + ':', err.message || err);
    // Email notification to admin
    MailApp.sendEmail({
      to: ADMIN_EMAIL,
      subject: '[Lab Vision QC] GAS Error — ' + context,
      body: 'Error di GAS QC Backend\n\nContext: ' + context + '\nMessage: ' + (err.message || String(err)) + '\nTime: ' + new Date().toISOString(),
    });
  } catch (_) {
    // Jangan throw dari error handler
  }
}
```

---

## Catatan Penting

### ONCALL1 vs ONCALL2
Kedua alat di-map ke `"On Call Sure"` di Sheets. Saat membaca data kembali (`rowToRecord`), semua `"On Call Sure"` di-map ke `ONCALL1`. Frontend membedakan keduanya berdasarkan `level` (CTRL0/CTRL1/CTRL2), bukan nama alat.

### Format tanggal di Sheet
Disimpan sebagai **timestamp milliseconds** (angka). Contoh: `1746748800000` = 2026-05-09.

### Format params & status di Sheet
Disimpan sebagai **JSON string** di satu kolom. Contoh kolom F (nilai/params): `{"PT":12.5,"APTT":28.3}`. Kolom J (status): `{"PT":"ok","APTT":"warn"}`.

### Rules di Sheet
Disimpan semicolon-separated. Contoh: `1-2s;R-4s;2-2s`.
