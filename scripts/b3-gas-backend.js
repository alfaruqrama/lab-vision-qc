/**
 * B3 (Bahan Berbahaya dan Beracun) — Google Apps Script Backend
 *
 * Setup:
 * 1. Buat Google Spreadsheet baru
 * 2. Buka Extensions > Apps Script
 * 3. Paste script ini
 * 4. Deploy sebagai Web App (Execute as: me, Who has access: Anyone)
 * 5. Copy URL deployment → set sebagai VITE_GAS_B3_URL di .env.local
 *
 * Sheet structure (4 sheet, baris 1 = header):
 *   Materials | Stock | Pemakaian | Limbah
 *
 * Semua query pakai ?action= dan POST pakai body JSON + ?action=
 */

// ─── Sheet names ───
const SHEET_MATERIALS = 'Materials';
const SHEET_STOCK = 'Stock';
const SHEET_PEMAKAIAN = 'Pemakaian';
const SHEET_LIMBAH = 'Limbah';

// ─── Headers (harus match dengan sheet) ───
const HEADERS_MATERIALS = ['id', 'kode', 'nama', 'kategori', 'hazard_class', 'storage_location', 'satuan', 'low_stock_threshold', 'is_active', 'created_at'];
const HEADERS_STOCK = ['id', 'material_id', 'batch_lot', 'initial_qty', 'current_qty', 'satuan', 'expiry_date', 'received_date', 'supplier', 'created_at'];
const HEADERS_PEMAKAIAN = ['id', 'material_id', 'stock_id', 'qty', 'satuan', 'tujuan', 'tanggal', 'jam', 'analis', 'catatan', 'created_at'];
const HEADERS_LIMBAH = ['id', 'material_id', 'waste_type', 'qty', 'satuan', 'sumber', 'tanggal_generasi', 'disposal_method', 'manifest_no', 'tps_location', 'catatan', 'created_at'];

// ─── Helpers ───
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f1f5f9');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] != null ? row[i] : ''; });
    return obj;
  });
}

function findRow(sheet, colName, value) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf(colName);
  if (colIdx === -1) return -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][colIdx]) === String(value)) return i + 1; // 1-indexed
  }
  return -1;
}

function rowToObject(sheet, rowNum) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const row = data[rowNum - 1];
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] != null ? row[i] : ''; });
  return obj;
}

function uuid() {
  return Utilities.getUuid();
}

function now() {
  return new Date().toISOString();
}

function today() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function timeNow() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(msg, status) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── JOIN helpers ───
function joinMaterials(stockRows) {
  const mSheet = getOrCreateSheet(SHEET_MATERIALS, HEADERS_MATERIALS);
  const materials = sheetToObjects(mSheet);
  const map = {};
  materials.forEach(m => { map[m.id] = m; });
  return stockRows.map(s => ({
    ...s,
    material_nama: map[s.material_id]?.nama || '',
    material_kode: map[s.material_id]?.kode || '',
  }));
}

// ─── doGet: All read actions ───
function doGet(e) {
  const action = e?.parameter?.action || '';

  try {
    switch (action) {
      case 'ping': return json({ status: 'ok', time: now() });

      case 'getMaterials': return handleGetMaterials();
      case 'getStock': return handleGetStock(e);
      case 'getPemakaian': return handleGetPemakaian(e);
      case 'getLimbah': return handleGetLimbah(e);
      case 'getDashboard': return handleGetDashboard();
      default: return jsonError('Unknown action: ' + action, 400);
    }
  } catch (err) {
    return jsonError(err.message || 'Internal error', 500);
  }
}

// ─── doPost: All write actions ───
function doPost(e) {
  const action = e?.parameter?.action || '';
  let body = {};
  try { body = JSON.parse(e?.postData?.contents || '{}'); } catch (_) {}

  try {
    switch (action) {
      case 'addMaterial': return handleAddMaterial(body);
      case 'updateMaterial': return handleUpdateMaterial(body);
      case 'toggleMaterial': return handleToggleMaterial(body);
      case 'deleteMaterial': return handleDeleteMaterial(body);
      case 'addStock': return handleAddStock(body);
      case 'addPemakaian': return handleAddPemakaian(body);
      case 'deletePemakaian': return handleDeletePemakaian(body);
      case 'addLimbah': return handleAddLimbah(body);
      case 'deleteLimbah': return handleDeleteLimbah(body);
      default: return jsonError('Unknown action: ' + action, 400);
    }
  } catch (err) {
    return jsonError(err.message || 'Internal error', 500);
  }
}

// ─── MATERIALS ───

function handleGetMaterials() {
  const sheet = getOrCreateSheet(SHEET_MATERIALS, HEADERS_MATERIALS);
  const rows = sheetToObjects(sheet);
  // Compute current_stock for each material
  const stockSheet = getOrCreateSheet(SHEET_STOCK, HEADERS_STOCK);
  const stockRows = sheetToObjects(stockSheet);
  const stockMap = {};
  stockRows.forEach(s => {
    const mid = s.material_id;
    if (!stockMap[mid]) stockMap[mid] = 0;
    stockMap[mid] += parseFloat(s.current_qty) || 0;
  });
  const result = rows.map(r => ({
    ...r,
    is_active: r.is_active !== 'FALSE',
    low_stock_threshold: parseFloat(r.low_stock_threshold) || 0,
    current_stock: stockMap[r.id] || 0,
  }));
  return json({ success: true, data: result });
}

function handleAddMaterial(body) {
  const sheet = getOrCreateSheet(SHEET_MATERIALS, HEADERS_MATERIALS);
  const id = uuid();
  const row = [
    id,
    body.kode || '',
    body.nama || '',
    body.kategori || 'Lainnya',
    Array.isArray(body.hazard_class) ? body.hazard_class.join(', ') : (body.hazard_class || ''),
    body.storage_location || '',
    body.satuan || 'L',
    parseFloat(body.low_stock_threshold) || 0,
    true,
    now(),
  ];
  sheet.appendRow(row);
  return json({ success: true, id, data: rowToObject(sheet, sheet.getLastRow()) });
}

function handleUpdateMaterial(body) {
  if (!body.id) return jsonError('Missing id', 400);
  const sheet = getOrCreateSheet(SHEET_MATERIALS, HEADERS_MATERIALS);
  const rowNum = findRow(sheet, 'id', body.id);
  if (rowNum === -1) return jsonError('Material not found', 404);
  const headers = sheet.getDataRange().getValues()[0];
  const colMap = {};
  headers.forEach((h, i) => { colMap[h] = i; });

  if (body.kode !== undefined) sheet.getRange(rowNum, colMap['kode'] + 1).setValue(body.kode);
  if (body.nama !== undefined) sheet.getRange(rowNum, colMap['nama'] + 1).setValue(body.nama);
  if (body.kategori !== undefined) sheet.getRange(rowNum, colMap['kategori'] + 1).setValue(body.kategori);
  if (body.hazard_class !== undefined) {
    const hc = Array.isArray(body.hazard_class) ? body.hazard_class.join(', ') : body.hazard_class;
    sheet.getRange(rowNum, colMap['hazard_class'] + 1).setValue(hc);
  }
  if (body.storage_location !== undefined) sheet.getRange(rowNum, colMap['storage_location'] + 1).setValue(body.storage_location);
  if (body.satuan !== undefined) sheet.getRange(rowNum, colMap['satuan'] + 1).setValue(body.satuan);
  if (body.low_stock_threshold !== undefined) sheet.getRange(rowNum, colMap['low_stock_threshold'] + 1).setValue(parseFloat(body.low_stock_threshold) || 0);

  return json({ success: true, data: rowToObject(sheet, rowNum) });
}

function handleToggleMaterial(body) {
  if (!body.id) return jsonError('Missing id', 400);
  const sheet = getOrCreateSheet(SHEET_MATERIALS, HEADERS_MATERIALS);
  const rowNum = findRow(sheet, 'id', body.id);
  if (rowNum === -1) return jsonError('Material not found', 404);
  const current = rowToObject(sheet, rowNum);
  const headers = sheet.getDataRange().getValues()[0];
  const colMap = {};
  headers.forEach((h, i) => { colMap[h] = i; });
  const newVal = current.is_active === 'FALSE' ? true : false;
  sheet.getRange(rowNum, colMap['is_active'] + 1).setValue(newVal);
  return json({ success: true, is_active: newVal });
}

function handleDeleteMaterial(body) {
  if (!body.id) return jsonError('Missing id', 400);
  const sheet = getOrCreateSheet(SHEET_MATERIALS, HEADERS_MATERIALS);
  const rowNum = findRow(sheet, 'id', body.id);
  if (rowNum === -1) return jsonError('Material not found', 404);
  sheet.deleteRow(rowNum);
  return json({ success: true });
}

// ─── STOCK ───

function handleGetStock(e) {
  const sheet = getOrCreateSheet(SHEET_STOCK, HEADERS_STOCK);
  let rows = sheetToObjects(sheet);
  const materialId = e?.parameter?.material_id || '';
  if (materialId) {
    rows = rows.filter(r => r.material_id === materialId);
  }
  rows = rows.map(r => ({
    ...r,
    initial_qty: parseFloat(r.initial_qty) || 0,
    current_qty: parseFloat(r.current_qty) || 0,
  }));
  const joined = joinMaterials(rows);
  return json({ success: true, data: joined });
}

function handleAddStock(body) {
  if (!body.material_id) return jsonError('Missing material_id', 400);
  const sheet = getOrCreateSheet(SHEET_STOCK, HEADERS_STOCK);
  const id = uuid();
  const initQty = parseFloat(body.initial_qty) || 0;
  const row = [
    id,
    body.material_id,
    body.batch_lot || '',
    initQty,
    initQty, // current_qty = initial_qty at creation
    body.satuan || 'L',
    body.expiry_date || '',
    body.received_date || today(),
    body.supplier || '',
    now(),
  ];
  sheet.appendRow(row);
  return json({ success: true, id, data: rowToObject(sheet, sheet.getLastRow()) });
}

// ─── PEMAKAIAN ───

function handleGetPemakaian(e) {
  const sheet = getOrCreateSheet(SHEET_PEMAKAIAN, HEADERS_PEMAKAIAN);
  let rows = sheetToObjects(sheet);
  const tglMulai = e?.parameter?.tglMulai || '';
  const tglAkhir = e?.parameter?.tglAkhir || '';
  const materialId = e?.parameter?.material_id || '';

  if (tglMulai) rows = rows.filter(r => r.tanggal >= tglMulai);
  if (tglAkhir) rows = rows.filter(r => r.tanggal <= tglAkhir);
  if (materialId) rows = rows.filter(r => r.material_id === materialId);

  // Sort by tanggal desc, jam desc
  rows.sort((a, b) => {
    const d = b.tanggal.localeCompare(a.tanggal);
    if (d !== 0) return d;
    return b.jam.localeCompare(a.jam);
  });

  rows = rows.map(r => ({ ...r, qty: parseFloat(r.qty) || 0 }));

  // Join with materials and stock
  const mSheet = getOrCreateSheet(SHEET_MATERIALS, HEADERS_MATERIALS);
  const mats = sheetToObjects(mSheet);
  const matMap = {};
  mats.forEach(m => { matMap[m.id] = m; });

  const sSheet = getOrCreateSheet(SHEET_STOCK, HEADERS_STOCK);
  const stocks = sheetToObjects(sSheet);
  const stockMap = {};
  stocks.forEach(s => { stockMap[s.id] = s; });

  const joined = rows.map(r => ({
    ...r,
    material_nama: matMap[r.material_id]?.nama || '',
    material_kode: matMap[r.material_id]?.kode || '',
    batch_lot: stockMap[r.stock_id]?.batch_lot || '',
  }));

  return json({ success: true, data: joined });
}

function handleAddPemakaian(body) {
  if (!body.material_id || !body.stock_id || !body.qty) {
    return jsonError('Missing required fields: material_id, stock_id, qty', 400);
  }

  const qty = parseFloat(body.qty);
  if (isNaN(qty) || qty <= 0) return jsonError('qty must be positive', 400);

  // Validasi stok
  const stockSheet = getOrCreateSheet(SHEET_STOCK, HEADERS_STOCK);
  const stockRowNum = findRow(stockSheet, 'id', body.stock_id);
  if (stockRowNum === -1) return jsonError('Stock not found', 404);

  const stockObj = rowToObject(stockSheet, stockRowNum);
  const currentQty = parseFloat(stockObj.current_qty) || 0;
  if (qty > currentQty) return jsonError(`Stok tidak cukup. Tersedia: ${currentQty} ${stockObj.satuan}`, 400);

  // Kurangi stok
  const stockHeaders = stockSheet.getDataRange().getValues()[0];
  const qtyCol = stockHeaders.indexOf('current_qty') + 1;
  stockSheet.getRange(stockRowNum, qtyCol).setValue(currentQty - qty);

  // Tambah pemakaian
  const sheet = getOrCreateSheet(SHEET_PEMAKAIAN, HEADERS_PEMAKAIAN);
  const id = uuid();
  const row = [
    id,
    body.material_id,
    body.stock_id,
    qty,
    body.satuan || stockObj.satuan || '',
    body.tujuan || '',
    body.tanggal || today(),
    body.jam || timeNow(),
    body.analis || '',
    body.catatan || '',
    now(),
  ];
  sheet.appendRow(row);

  return json({ success: true, id, remaining_stock: currentQty - qty });
}

function handleDeletePemakaian(body) {
  if (!body.id) return jsonError('Missing id', 400);
  const sheet = getOrCreateSheet(SHEET_PEMAKAIAN, HEADERS_PEMAKAIAN);
  const rowNum = findRow(sheet, 'id', body.id);
  if (rowNum === -1) return jsonError('Pemakaian not found', 404);

  // Restore stock
  const obj = rowToObject(sheet, rowNum);
  const stockSheet = getOrCreateSheet(SHEET_STOCK, HEADERS_STOCK);
  const stockRowNum = findRow(stockSheet, 'id', obj.stock_id);
  if (stockRowNum !== -1) {
    const stockObj = rowToObject(stockSheet, stockRowNum);
    const currentQty = parseFloat(stockObj.current_qty) || 0;
    const restoreQty = parseFloat(obj.qty) || 0;
    const stockHeaders = stockSheet.getDataRange().getValues()[0];
    const qtyCol = stockHeaders.indexOf('current_qty') + 1;
    stockSheet.getRange(stockRowNum, qtyCol).setValue(currentQty + restoreQty);
  }

  sheet.deleteRow(rowNum);
  return json({ success: true });
}

// ─── LIMBAH ───

function handleGetLimbah(e) {
  const sheet = getOrCreateSheet(SHEET_LIMBAH, HEADERS_LIMBAH);
  let rows = sheetToObjects(sheet);
  const tglMulai = e?.parameter?.tglMulai || '';
  const tglAkhir = e?.parameter?.tglAkhir || '';
  const wasteType = e?.parameter?.waste_type || '';

  if (tglMulai) rows = rows.filter(r => r.tanggal_generasi >= tglMulai);
  if (tglAkhir) rows = rows.filter(r => r.tanggal_generasi <= tglAkhir);
  if (wasteType) rows = rows.filter(r => r.waste_type === wasteType);

  rows.sort((a, b) => b.tanggal_generasi.localeCompare(a.tanggal_generasi));
  rows = rows.map(r => ({ ...r, qty: parseFloat(r.qty) || 0 }));

  // Join with materials
  const mSheet = getOrCreateSheet(SHEET_MATERIALS, HEADERS_MATERIALS);
  const mats = sheetToObjects(mSheet);
  const matMap = {};
  mats.forEach(m => { matMap[m.id] = m; });

  const joined = rows.map(r => ({
    ...r,
    material_nama: matMap[r.material_id]?.nama || '',
    material_kode: matMap[r.material_id]?.kode || '',
  }));

  return json({ success: true, data: joined });
}

function handleAddLimbah(body) {
  const sheet = getOrCreateSheet(SHEET_LIMBAH, HEADERS_LIMBAH);
  const id = uuid();
  const row = [
    id,
    body.material_id || '',
    body.waste_type || 'Cair',
    parseFloat(body.qty) || 0,
    body.satuan || 'L',
    body.sumber || '',
    body.tanggal_generasi || today(),
    body.disposal_method || 'Belum Dibuang',
    body.manifest_no || '',
    body.tps_location || 'TPS B3',
    body.catatan || '',
    now(),
  ];
  sheet.appendRow(row);
  return json({ success: true, id, data: rowToObject(sheet, sheet.getLastRow()) });
}

function handleDeleteLimbah(body) {
  if (!body.id) return jsonError('Missing id', 400);
  const sheet = getOrCreateSheet(SHEET_LIMBAH, HEADERS_LIMBAH);
  const rowNum = findRow(sheet, 'id', body.id);
  if (rowNum === -1) return jsonError('Limbah not found', 404);
  sheet.deleteRow(rowNum);
  return json({ success: true });
}

// ─── DASHBOARD ───

function handleGetDashboard() {
  const mSheet = getOrCreateSheet(SHEET_MATERIALS, HEADERS_MATERIALS);
  const materials = sheetToObjects(mSheet).filter(r => r.is_active !== 'FALSE');

  const sSheet = getOrCreateSheet(SHEET_STOCK, HEADERS_STOCK);
  const stocks = sheetToObjects(sSheet);

  const pSheet = getOrCreateSheet(SHEET_PEMAKAIAN, HEADERS_PEMAKAIAN);
  const pemakaians = sheetToObjects(pSheet);

  const lSheet = getOrCreateSheet(SHEET_LIMBAH, HEADERS_LIMBAH);
  const limbahs = sheetToObjects(lSheet);

  // Total materials
  const totalMaterials = materials.length;

  // Low stock
  let lowStockCount = 0;
  materials.forEach(m => {
    const ms = stocks.filter(s => s.material_id === m.id);
    const total = ms.reduce((sum, s) => sum + (parseFloat(s.current_qty) || 0), 0);
    if (total <= (parseFloat(m.low_stock_threshold) || 0)) lowStockCount++;
  });

  // Expiry checks
  const todayStr = today();
  let expiringSoonCount = 0;
  let expiredCount = 0;
  stocks.forEach(s => {
    if (!s.expiry_date) return;
    const exp = new Date(s.expiry_date);
    const now = new Date(todayStr);
    if (isNaN(exp.getTime())) return;
    if (exp < now) { expiredCount++; return; }
    const days = (exp - now) / (1000 * 60 * 60 * 24);
    if (days <= 30) expiringSoonCount++;
  });

  // Waste this month
  const thisMonth = todayStr.substring(0, 7); // YYYY-MM
  const wasteMonth = limbahs.filter(l => (l.tanggal_generasi || '').startsWith(thisMonth));
  const wasteMonthTotal = wasteMonth.reduce((s, l) => s + (parseFloat(l.qty) || 0), 0);
  const wastePending = limbahs.filter(l => l.disposal_method === 'Belum Dibuang').length;

  // Recent usage (last 10)
  pemakaians.sort((a, b) => {
    const d = b.tanggal.localeCompare(a.tanggal);
    if (d !== 0) return d;
    return b.jam.localeCompare(a.jam);
  });
  const recentUsage = pemakaians.slice(0, 10).map(r => ({ ...r, qty: parseFloat(r.qty) || 0 }));

  // Recent waste (last 5)
  limbahs.sort((a, b) => b.tanggal_generasi.localeCompare(a.tanggal_generasi));
  const recentWaste = limbahs.slice(0, 5).map(l => ({ ...l, qty: parseFloat(l.qty) || 0 }));

  return json({
    success: true,
    data: {
      total_materials: totalMaterials,
      low_stock_count: lowStockCount,
      expiring_soon_count: expiringSoonCount,
      expired_count: expiredCount,
      waste_month_total: wasteMonthTotal,
      waste_pending_count: wastePending,
      recent_usage: recentUsage,
      recent_waste: recentWaste,
    }
  });
}
