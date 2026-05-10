# Fase 3: UI Read Operations Testing

**Date:** 2026-05-10  
**Tester:** rama  
**Environment:** Local dev (http://localhost:5174)  
**Database:** Supabase local (45 QC records, 10 days)

---

## Pre-Test Setup

- [x] Supabase DB running and healthy
- [x] Lot config seeded (1 row, 4 instruments)
- [x] QC records seeded (45 rows, May 1-10, 2026)
- [x] Dev server running on http://localhost:5174
- [ ] Browser: Chrome/Firefox/Safari
- [ ] Login as: `rama` / `21241`

---

## Test 3.1: Dashboard (`/qc`)

**URL:** http://localhost:5174/qc

### Expected Data
- **Total QC bulan ini:** 45 records
- **In-Control:** ~35-40 records (most should be in control)
- **Peringatan:** ~3-5 records (2s violations)
- **Diluar Kendali:** ~2-3 records (3s violations, injected on day 5, 8, 12, 15)

### Test Steps

1. **Navigate to Dashboard**
   - [ ] URL loads without errors
   - [ ] No console errors in DevTools
   - [ ] Page renders completely

2. **Check Stats Cards (Top Section)**
   - [ ] "Total QC Bulan Ini" shows number (should be 45)
   - [ ] "In-Control" shows number and percentage
   - [ ] "Peringatan" shows number and percentage
   - [ ] "Diluar Kendali" shows number and percentage
   - [ ] All cards have correct styling (green/yellow/red)

3. **Check "Status QC Hari Ini" Section**
   - [ ] Section title visible
   - [ ] If today (May 10) has records: table shows 5 records
   - [ ] If no records today: shows empty state message
   - [ ] Table columns: Waktu, Alat, Level, Parameter, Nilai, Status
   - [ ] Status badges colored correctly (green/yellow/red)

4. **Check Connection Indicator**
   - [ ] Bottom of page shows connection status
   - [ ] Should say "Terhubung ke Supabase" or similar (NOT "Google Sheets")
   - [ ] Green indicator if connected

5. **Check Data Freshness**
   - [ ] Stats reflect actual database counts
   - [ ] No stale localStorage data showing

### Pass Criteria
- ✅ All stats cards show numbers
- ✅ No console errors
- ✅ Connection indicator shows Supabase
- ✅ Today's records display correctly (or empty state if none)

---

## Test 3.2: Levey-Jennings Chart (`/qc/chart`)

**URL:** http://localhost:5174/qc/chart

### Expected Data
- **CA660 → PT:** 10 data points (May 1-10), 1 outlier on day 5
- **EASYLITE → Na → NORMAL:** 10 data points, 1 outlier on day 8
- **ONCALL1 → GDA → CTRL1:** 10 data points, 1 outlier on day 15 (if exists)

### Test Steps

1. **Navigate to Chart Page**
   - [ ] URL loads without errors
   - [ ] Dropdowns render (Alat, Parameter, Level)
   - [ ] Chart canvas visible

2. **Test CA660 → PT**
   - [ ] Select "CA660" from Alat dropdown
   - [ ] Parameter dropdown populates with: PT, APTT, INR
   - [ ] Select "PT"
   - [ ] Level dropdown shows: Kontrol
   - [ ] Select "Kontrol"
   - [ ] Chart renders with data points
   - [ ] X-axis shows dates (May 1-10)
   - [ ] Y-axis shows values around 12.5 (mean)
   - [ ] Mean line (blue) visible
   - [ ] ±1SD lines (green) visible
   - [ ] ±2SD lines (yellow) visible
   - [ ] ±3SD lines (red) visible
   - [ ] Data points plotted correctly
   - [ ] Outlier on day 5 visible (should be above +3SD line)

3. **Check Stats Panel (Right Side)**
   - [ ] n = 10
   - [ ] Mean ≈ 12.5 (may vary due to random generation)
   - [ ] SD ≈ 0.3
   - [ ] CV calculated correctly
   - [ ] In-Control % shows (should be 90% = 9/10)

4. **Test EASYLITE → Na → NORMAL**
   - [ ] Select "EASYLITE" from Alat dropdown
   - [ ] Parameter dropdown populates with: Na, K, Cl
   - [ ] Select "Na"
   - [ ] Level dropdown shows: NORMAL, HIGH
   - [ ] Select "NORMAL"
   - [ ] Chart updates with new data
   - [ ] 10 data points visible
   - [ ] Mean line around 140
   - [ ] Outlier on day 8 visible (should be above +3SD line)
   - [ ] Stats panel updates (n=10, mean≈140, SD≈2)

5. **Test EASYLITE → K → HIGH**
   - [ ] Select "K" parameter
   - [ ] Select "HIGH" level
   - [ ] Chart updates
   - [ ] Only 5 data points visible (HIGH only on even days)
   - [ ] Mean around 6.5
   - [ ] Stats panel shows n=5

6. **Test ONCALL1 → GDA → CTRL1**
   - [ ] Select "ONCALL1" from Alat dropdown
   - [ ] Parameter dropdown shows: GDA
   - [ ] Level dropdown shows: CTRL0, CTRL1, CTRL2
   - [ ] Select "CTRL1"
   - [ ] Chart renders with 10 data points
   - [ ] Mean around 134
   - [ ] SD around 13.5

### Pass Criteria
- ✅ All dropdowns populate correctly
- ✅ Chart renders for all instrument/param/level combinations
- ✅ Data points match expected counts
- ✅ Stats panel calculates correctly
- ✅ Outliers visible where expected
- ✅ No console errors

---

## Test 3.3: Monthly Report (`/qc/report`)

**URL:** http://localhost:5174/qc/report

### Expected Data
- **Month:** May 2026
- **Total rows:** ~20-25 (unique param/alat/level combinations)
- **Example rows:**
  - CA660 | PT | Kontrol | n=10 | mean≈12.5 | SD≈0.3 | CV≈2.4% | Status: In-Control (or Peringatan if outlier)
  - EASYLITE | Na | NORMAL | n=10 | mean≈140 | SD≈2 | CV≈1.4%
  - EASYLITE | Na | HIGH | n=5 | mean≈155 | SD≈2 | CV≈1.3%

### Test Steps

1. **Navigate to Report Page**
   - [ ] URL loads without errors
   - [ ] Month selector visible
   - [ ] Table renders

2. **Check Month Selector**
   - [ ] Dropdown shows months
   - [ ] Current month (May 2026) selected by default
   - [ ] Can change month (try April - should show empty or no data)

3. **Check Summary Table**
   - [ ] Table headers: Alat, Parameter, Level, n, Mean, SD, CV, Status
   - [ ] Rows populate with data
   - [ ] All 4 instruments present (CA660, EASYLITE, ONCALL1, ONCALL2)
   - [ ] CA660 has 3 rows (PT, APTT, INR)
   - [ ] EASYLITE has 6 rows (Na/K/Cl × NORMAL/HIGH, but HIGH only 5 samples)
   - [ ] ONCALL1 has 3 rows (GDA × CTRL0/CTRL1/CTRL2, but only CTRL1 has data)
   - [ ] ONCALL2 has 3 rows (GDA × CTRL0/CTRL1/CTRL2, but only CTRL1 has data)
   - [ ] n values correct (10 for daily, 5 for even days)
   - [ ] Mean/SD/CV calculated correctly
   - [ ] Status badges colored (green/yellow/red)

4. **Check Export Buttons**
   - [ ] "Export Excel" button visible
   - [ ] "Export Word" button visible
   - [ ] Buttons enabled (not grayed out)
   - [ ] Click "Export Excel" - file downloads (optional: verify content)
   - [ ] Click "Export Word" - file downloads (optional: verify content)

5. **Check Empty State**
   - [ ] Select a future month (e.g., June 2026)
   - [ ] Table shows empty state message
   - [ ] Export buttons disabled or hidden

### Pass Criteria
- ✅ Table populates with all instruments
- ✅ Row counts match expected (based on param/level combinations)
- ✅ Stats calculated correctly
- ✅ Export buttons functional
- ✅ Empty state works for months with no data
- ✅ No console errors

---

## Test 3.4: Lot Config Page (`/qc/config`)

**URL:** http://localhost:5174/qc/config

### Expected Data
- **CA660:** 1 lot (CA-2024-001, exp 2026-12-31)
  - Kontrol: PT (12.5±0.3), APTT (32.0±1.5), INR (1.0±0.05)
- **EASYLITE:** 1 lot (EL-2024-001, exp 2026-09-30)
  - NORMAL: Na (140±2), K (4.0±0.2), Cl (100±2)
  - HIGH: Na (155±2), K (6.5±0.3), Cl (115±2)
- **ONCALL1:** 1 lot (1790338, exp 2026-05-28)
  - CTRL0: GDA (47±7.5)
  - CTRL1: GDA (134±13.5)
  - CTRL2: GDA (364±36.5)
- **ONCALL2:** Same as ONCALL1

### Test Steps

1. **Navigate to Config Page**
   - [ ] URL loads without errors
   - [ ] All 4 instrument sections visible
   - [ ] No console errors

2. **Check CA660 Section**
   - [ ] Section title: "CA660"
   - [ ] Lot number: CA-2024-001
   - [ ] Expiry: 2026-12-31
   - [ ] Level: Kontrol
   - [ ] Parameters table shows: PT, APTT, INR
   - [ ] Mean values: 12.5, 32.0, 1.0
   - [ ] SD values: 0.3, 1.5, 0.05
   - [ ] All fields populated (no empty cells)

3. **Check EASYLITE Section**
   - [ ] Section title: "EASYLITE"
   - [ ] Lot number: EL-2024-001
   - [ ] Expiry: 2026-09-30
   - [ ] Two levels visible: NORMAL, HIGH
   - [ ] NORMAL level:
     - [ ] Na: 140 ± 2
     - [ ] K: 4.0 ± 0.2
     - [ ] Cl: 100 ± 2
   - [ ] HIGH level:
     - [ ] Na: 155 ± 2
     - [ ] K: 6.5 ± 0.3
     - [ ] Cl: 115 ± 2

4. **Check ONCALL1 Section**
   - [ ] Section title: "ONCALL1"
   - [ ] Lot number: 1790338
   - [ ] Expiry: 2026-05-28
   - [ ] Three levels visible: CTRL0, CTRL1, CTRL2
   - [ ] CTRL0: GDA (47 ± 7.5)
   - [ ] CTRL1: GDA (134 ± 13.5)
   - [ ] CTRL2: GDA (364 ± 36.5)

5. **Check ONCALL2 Section**
   - [ ] Section title: "ONCALL2"
   - [ ] Same config as ONCALL1
   - [ ] All values match ONCALL1

6. **Check Data Source**
   - [ ] Config loaded from Supabase (not localStorage)
   - [ ] Check Network tab: should see Supabase API call
   - [ ] No "Demo Mode" indicator

### Pass Criteria
- ✅ All 4 instruments display
- ✅ All lot numbers, expiry dates correct
- ✅ All mean/SD values match DEFAULT_LOT_CONFIG
- ✅ No empty fields
- ✅ Data loaded from Supabase
- ✅ No console errors

---

## Overall Pass Criteria

Fase 3 dianggap **PASS** jika:

- ✅ Dashboard menampilkan stats yang benar (45 records total)
- ✅ Levey-Jennings chart render untuk semua kombinasi alat/param/level
- ✅ Monthly report generate tabel dengan data lengkap
- ✅ Lot config page menampilkan semua 4 instruments dengan config lengkap
- ✅ Tidak ada console errors di semua halaman
- ✅ Data loaded dari Supabase (bukan localStorage)
- ✅ Connection indicator shows Supabase

---

## Test Results

### Dashboard (`/qc`)
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Levey-Jennings Chart (`/qc/chart`)
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Monthly Report (`/qc/report`)
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Lot Config Page (`/qc/config`)
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

---

## Issues Found

| # | Page | Issue | Severity | Status |
|---|------|-------|----------|--------|
| 1 |      |       |          |        |
| 2 |      |       |          |        |
| 3 |      |       |          |        |

---

## Sign-off

- [ ] All tests completed
- [ ] All critical issues resolved
- [ ] Ready for Fase 4 (Write Operations)

**Tester:** ________________  
**Date:** ________________  
**Time:** ________________
