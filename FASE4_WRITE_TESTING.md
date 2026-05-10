# Fase 4: UI Write Operations Testing

**Date:** 2026-05-10  
**Tester:** rama  
**Environment:** Local dev (http://localhost:5174)  
**Database:** Supabase local (45 QC records seeded)

---

## Pre-Test Setup

- [x] Fase 3 completed (UI read operations working)
- [x] Login as: `rama` / `21241` (admin role)
- [ ] Browser DevTools open (Console + Network tabs)

---

## Test 4.1: Input QC Record (`/qc/input`)

**URL:** http://localhost:5174/qc/input

### Test Case 4.1.1: Input CA660 QC Record

**Steps:**
1. Navigate to `/qc/input`
2. Select instrument: **CA660**
3. Select level: **Kontrol**
4. Lot number should auto-populate: **CA-2024-001**
5. Enter values:
   - PT: `12.8` (within control)
   - APTT: `33.5` (within control)
   - INR: `1.02` (within control)
6. Analis: `rama` (or any name)
7. Catatan: (optional) "Test input from Supabase"
8. Click **Simpan**

**Expected:**
- ✅ Toast notification: "Data QC berhasil disimpan!"
- ✅ Form resets to empty state
- ✅ No console errors
- ✅ Network tab shows POST to Supabase `/rest/v1/qc_records`
- ✅ Response status: 201 Created

**Verify in Database:**
```sql
SELECT * FROM qc_records WHERE analis = 'rama' ORDER BY created_at DESC LIMIT 1;
```
- ✅ Record exists with correct values
- ✅ `created_by` = rama UUID
- ✅ `tanggal` = today's date (2026-05-10)
- ✅ `status` JSONB has `ok` values

**Verify in Dashboard:**
- Navigate to `/qc`
- ✅ "Status QC Hari Ini" section shows new record
- ✅ Total QC count increased by 1 (now 46)

---

### Test Case 4.1.2: Input EASYLITE NORMAL QC Record

**Steps:**
1. Navigate to `/qc/input`
2. Select instrument: **EASYLITE**
3. Select level: **NORMAL**
4. Lot number: **EL-2024-001**
5. Enter values:
   - Na: `142` (within control)
   - K: `4.2` (within control)
   - Cl: `102` (within control)
6. Analis: `rama`
7. Click **Simpan**

**Expected:**
- ✅ Toast: "Data QC berhasil disimpan!"
- ✅ Record saved to database
- ✅ Dashboard updated

---

### Test Case 4.1.3: Input Out-of-Control Value

**Steps:**
1. Navigate to `/qc/input`
2. Select instrument: **CA660**
3. Select level: **Kontrol**
4. Enter values:
   - PT: `15.0` (>3SD, should trigger `oos` status)
   - APTT: `32.0`
   - INR: `1.0`
5. Analis: `rama`
6. Catatan: "Test OOS value"
7. Click **Simpan**

**Expected:**
- ✅ Toast: "Data QC berhasil disimpan!"
- ✅ Record saved with `status.PT = "oos"`
- ✅ Dashboard shows increased "Diluar Kendali" count

**Verify in Database:**
```sql
SELECT params->>'PT' as pt_value, status->>'PT' as pt_status 
FROM qc_records 
WHERE catatan = 'Test OOS value';
```
- ✅ `pt_value` = 15.0
- ✅ `pt_status` = "oos"

---

### Test Case 4.1.4: Input Warning Value

**Steps:**
1. Navigate to `/qc/input`
2. Select instrument: **EASYLITE**
3. Select level: **NORMAL**
4. Enter values:
   - Na: `145` (>2SD but <3SD, should trigger `warning`)
   - K: `4.0`
   - Cl: `100`
5. Analis: `rama`
6. Catatan: "Test warning value"
7. Click **Simpan**

**Expected:**
- ✅ Record saved with `status.Na = "warning"`
- ✅ Dashboard shows increased "Peringatan" count

---

### Test Case 4.1.5: Validation - Empty Fields

**Steps:**
1. Navigate to `/qc/input`
2. Select instrument: **CA660**
3. Leave all param fields empty
4. Click **Simpan**

**Expected:**
- ✅ Form validation error (red border or error message)
- ✅ No API call made
- ✅ Toast error: "Harap isi semua parameter"

---

### Test Case 4.1.6: Validation - Invalid Number

**Steps:**
1. Navigate to `/qc/input`
2. Select instrument: **CA660**
3. Enter invalid value:
   - PT: `abc` (non-numeric)
4. Click **Simpan**

**Expected:**
- ✅ Form validation error
- ✅ No API call made

---

## Test 4.2: Update Lot Config (`/qc/config`)

**URL:** http://localhost:5174/qc/config

### Test Case 4.2.1: Update CA660 Lot Config

**Steps:**
1. Navigate to `/qc/config`
2. Find **CA660** section
3. Click **Edit** button (if exists) or directly edit fields
4. Update values:
   - Lot: `CA-2024-002` (new lot)
   - Expiry: `2027-01-31`
   - PT Mean: `12.8` (changed from 12.5)
   - PT SD: `0.35` (changed from 0.3)
5. Click **Simpan** or **Update**

**Expected:**
- ✅ Toast: "Konfigurasi lot berhasil diperbarui!"
- ✅ Page refreshes or updates to show new values
- ✅ No console errors

**Verify in Database:**
```sql
SELECT config->'CA660'->0->>'lot' as lot,
       config->'CA660'->0->'Kontrol'->'PT'->>'mean' as pt_mean,
       config->'CA660'->0->'Kontrol'->'PT'->>'sd' as pt_sd
FROM lot_config
ORDER BY updated_at DESC LIMIT 1;
```
- ✅ `lot` = "CA-2024-002"
- ✅ `pt_mean` = 12.8
- ✅ `pt_sd` = 0.35
- ✅ `updated_by` = rama UUID
- ✅ `updated_at` = current timestamp

**Verify in Input QC Page:**
- Navigate to `/qc/input`
- Select CA660
- ✅ Lot number dropdown shows new lot: **CA-2024-002**

---

### Test Case 4.2.2: Update EASYLITE NORMAL Config

**Steps:**
1. Navigate to `/qc/config`
2. Find **EASYLITE** section → **NORMAL** level
3. Update values:
   - Na Mean: `141` (changed from 140)
   - Na SD: `2.5` (changed from 2)
4. Click **Simpan**

**Expected:**
- ✅ Config updated in database
- ✅ Levey-Jennings chart reflects new mean/SD lines

**Verify in Chart:**
- Navigate to `/qc/chart`
- Select EASYLITE → Na → NORMAL
- ✅ Mean line moved to 141
- ✅ SD lines adjusted accordingly

---

### Test Case 4.2.3: Add New Lot (if supported)

**Steps:**
1. Navigate to `/qc/config`
2. Find **CA660** section
3. Click **Add Lot** button (if exists)
4. Enter new lot:
   - Lot: `CA-2024-003`
   - Expiry: `2027-06-30`
   - PT Mean: `12.3`
   - PT SD: `0.28`
5. Click **Simpan**

**Expected:**
- ✅ New lot added to config
- ✅ Input QC page shows both lots in dropdown

**Note:** If "Add Lot" feature not implemented, skip this test.

---

## Test 4.3: Role-Based Access Control

### Test Case 4.3.1: Admin Can Access All Pages

**Steps:**
1. Login as `rama` / `21241` (admin)
2. Navigate to:
   - `/qc` ✅
   - `/qc/input` ✅
   - `/qc/chart` ✅
   - `/qc/report` ✅
   - `/qc/config` ✅

**Expected:**
- ✅ All pages accessible
- ✅ No "Access Denied" errors

---

### Test Case 4.3.2: Petugas Can Input QC

**Steps:**
1. Logout (if logged in as admin)
2. Login as `dewi` / `09164` (petugas role)
3. Navigate to `/qc/input`

**Expected:**
- ✅ Page loads successfully
- ✅ Can input QC records
- ✅ Can save records

---

### Test Case 4.3.3: Viewer Cannot Input QC

**Steps:**
1. Logout
2. Login as `viewer` / `viewer` (viewer role)
3. Try to navigate to `/qc/input`

**Expected:**
- ✅ Redirected to `/qc` or shows "Access Denied"
- ✅ Cannot access input page

**Note:** If role-based routing not implemented, skip this test.

---

## Test 4.4: Network Error Handling

### Test Case 4.4.1: Save QC Record with Network Error

**Steps:**
1. Open DevTools → Network tab
2. Enable "Offline" mode (or throttle to "Offline")
3. Navigate to `/qc/input`
4. Fill in QC record
5. Click **Simpan**

**Expected:**
- ✅ Toast error: "Gagal menyimpan data QC" or "Network error"
- ✅ Form data preserved (not cleared)
- ✅ User can retry after network restored

---

### Test Case 4.4.2: Update Lot Config with Network Error

**Steps:**
1. Enable "Offline" mode
2. Navigate to `/qc/config`
3. Try to update lot config
4. Click **Simpan**

**Expected:**
- ✅ Toast error: "Gagal memperbarui konfigurasi"
- ✅ Changes not saved
- ✅ User can retry

---

## Test 4.5: Concurrent Updates

### Test Case 4.5.1: Multiple Users Input QC Simultaneously

**Steps:**
1. Open two browser windows (or incognito)
2. Login as `rama` in Window 1
3. Login as `dewi` in Window 2
4. Both users input QC records at the same time
5. Click **Simpan** in both windows

**Expected:**
- ✅ Both records saved successfully
- ✅ No conflicts or overwrites
- ✅ Dashboard shows both records

---

## Pass Criteria

Fase 4 dianggap **PASS** jika:

- ✅ Input QC record berhasil (in-control, warning, oos)
- ✅ Form validation works (empty fields, invalid input)
- ✅ Update lot config berhasil
- ✅ Database updated correctly (created_by, timestamps)
- ✅ Dashboard reflects new data immediately
- ✅ Role-based access enforced (if implemented)
- ✅ Network error handled gracefully
- ✅ No console errors during write operations

---

## Test Results

### Input QC (`/qc/input`)
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Update Lot Config (`/qc/config`)
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Role-Based Access
- [ ] PASS
- [ ] FAIL
- [ ] N/A (not implemented)
- Notes: _______________________________________________

### Network Error Handling
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

---

## Issues Found

| # | Feature | Issue | Severity | Status |
|---|---------|-------|----------|--------|
| 1 |         |       |          |        |
| 2 |         |       |          |        |

---

## Sign-off

- [ ] All critical tests passed
- [ ] All issues documented
- [ ] Ready for Fase 5 (Edge Cases)

**Tester:** ________________  
**Date:** ________________  
**Time:** ________________
