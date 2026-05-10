# Manual Verification Checklist — Supabase Migration

**Dev Server:** http://localhost:5174/  
**Branch:** `feature/supabase-migration`

---

## ⚠️ Prerequisites

Sebelum testing, pastikan:

1. **Supabase sudah running** (local atau cloud)
2. **Migration sudah dijalankan** (`001_initial.sql`)
3. **`.env.local` sudah dikonfigurasi**:
   ```env
   VITE_SUPABASE_URL=http://localhost:54321  # atau https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. **Admin password hash sudah diganti** (bukan placeholder)

---

## 🧪 Test Scenarios

### 1. Auth System

#### ✅ Login Flow
- [ ] Buka http://localhost:5174/
- [ ] Redirect ke `/login` (jika belum login)
- [ ] Login dengan `admin` / `admin123`
- [ ] Berhasil masuk ke Portal Home
- [ ] User info muncul di navbar (nama: "Administrator")

#### ✅ Session Persistence
- [ ] Refresh browser (F5)
- [ ] Tetap login (tidak redirect ke `/login`)
- [ ] User info tetap muncul

#### ✅ Logout
- [ ] Klik logout di navbar
- [ ] Redirect ke `/login`
- [ ] Session cleared (cek localStorage: `lab-portal-auth` hilang)

#### ✅ Invalid Credentials
- [ ] Login dengan username/password salah
- [ ] Error message muncul: "Username atau password salah"

---

### 2. Admin User Management

#### ✅ View Users
- [ ] Login sebagai admin
- [ ] Buka `/admin/users`
- [ ] Tabel user muncul (minimal 1 user: admin)
- [ ] Kolom: Username, Nama, Role, Status, Aksi

#### ✅ Create User
- [ ] Klik "Tambah User"
- [ ] Isi form:
  - Username: `petugas1`
  - Nama: `Petugas Test`
  - Password: `test123`
  - Role: `petugas`
- [ ] Klik "Simpan"
- [ ] Toast success muncul
- [ ] User baru muncul di tabel

#### ✅ Update User
- [ ] Klik icon edit (pensil) di user `petugas1`
- [ ] Ubah nama jadi `Petugas Updated`
- [ ] Ubah role jadi `viewer`
- [ ] Klik "Simpan"
- [ ] Toast success muncul
- [ ] Perubahan muncul di tabel

#### ✅ Reset Password
- [ ] Klik icon key di user `petugas1`
- [ ] Isi password baru: `newpass123`
- [ ] Klik "Reset Password"
- [ ] Toast success muncul
- [ ] Logout, login dengan `petugas1` / `newpass123` → berhasil

#### ✅ Delete User
- [ ] Klik icon trash di user `petugas1`
- [ ] Konfirmasi dialog muncul
- [ ] Klik "Hapus"
- [ ] Toast success muncul
- [ ] User hilang dari tabel

---

### 3. QC Module

#### ✅ Dashboard
- [ ] Login sebagai admin atau petugas
- [ ] Buka `/qc`
- [ ] Dashboard muncul dengan stat chips:
  - Total QC
  - In-Control
  - Peringatan
  - Diluar Kendali
- [ ] Status QC hari ini muncul (atau "Belum ada data QC hari ini")
- [ ] Connection status: "Terhubung ke Google Sheets" (seharusnya berubah jadi "Terhubung ke Supabase" — **minor bug**, tidak critical)

#### ✅ Input QC
- [ ] Klik tombol "+" (floating action button)
- [ ] Redirect ke `/qc/input`
- [ ] Step 1: Pilih alat (CA660, EASYLITE, ONCALL1, ONCALL2)
- [ ] Step 2: Pilih level (skip untuk CA660)
- [ ] Step 3: Form input muncul
  - Lot number (dropdown)
  - Tanggal (date picker)
  - Nama analis (text input)
  - Parameter values (input fields)
  - Catatan (textarea)
- [ ] Isi semua field
- [ ] Klik "Simpan Data QC"
- [ ] Toast success: "Data QC berhasil disimpan!"
- [ ] Redirect ke `/qc`
- [ ] Record baru muncul di "Status QC Hari Ini"

#### ✅ Levey-Jennings Chart
- [ ] Buka `/qc/chart`
- [ ] Pilih parameter (dropdown)
- [ ] Pilih level (jika ada)
- [ ] Pilih bulan (month picker)
- [ ] Chart muncul dengan:
  - Line chart (nilai QC)
  - Reference lines (mean, ±1SD, ±2SD, ±3SD)
  - Dots berwarna (ok=biru, warning=kuning, oos=merah)
- [ ] Stats muncul:
  - N (jumlah run)
  - Mean target vs actual
  - SD actual
  - CV
  - In-control %

#### ✅ Monthly Report
- [ ] Buka `/qc/report`
- [ ] Pilih bulan
- [ ] Pilih alat (ALL atau spesifik)
- [ ] Klik "Generate Laporan"
- [ ] Summary table muncul dengan:
  - Parameter
  - Alat
  - Level
  - N
  - Mean target vs actual
  - SD
  - CV
  - Status
- [ ] Klik "Export Excel" → file `.xlsx` terdownload
- [ ] Klik "Print" → print preview muncul

#### ✅ Lot Config
- [ ] Login sebagai admin atau petugas
- [ ] Buka `/qc/config`
- [ ] Form konfigurasi lot muncul untuk semua alat
- [ ] Edit nilai mean/SD untuk satu parameter
- [ ] Klik "Simpan Konfigurasi"
- [ ] Toast success muncul
- [ ] Refresh page → nilai baru tetap tersimpan

---

### 4. Role-Based Access Control

#### ✅ Admin Access
- [ ] Login sebagai `admin`
- [ ] Bisa akses semua menu:
  - Dashboard Kunjungan
  - Lab QC (semua submenu)
  - Monitor Suhu
  - Kelola User

#### ✅ Petugas Access
- [ ] Login sebagai `petugas1` (atau create user baru dengan role petugas)
- [ ] Bisa akses:
  - Dashboard Kunjungan
  - Lab QC (semua submenu)
- [ ] **Tidak bisa** akses:
  - Monitor Suhu (tidak muncul di Portal Home)
  - Kelola User (tidak muncul di Portal Home)

#### ✅ Viewer Access
- [ ] Login sebagai user dengan role `viewer`
- [ ] Bisa akses:
  - Dashboard Kunjungan
  - Lab QC (Dashboard, Chart, Report)
- [ ] **Tidak bisa** akses:
  - Input QC (tombol "+" tidak muncul atau redirect dengan error)
  - Lot Config (tidak muncul di sidebar)
  - Monitor Suhu
  - Kelola User

---

### 5. Demo Mode (Offline)

#### ✅ Tanpa Supabase Config
- [ ] Stop dev server
- [ ] Hapus `VITE_SUPABASE_URL` dari `.env.local`
- [ ] Start dev server lagi
- [ ] Buka http://localhost:5174/
- [ ] Login page muncul
- [ ] Login gagal dengan error: "Supabase belum dikonfigurasi"
- [ ] **Expected:** Demo mode dengan localStorage (seperti sebelum migrasi)

---

### 6. Database Verification (Supabase Dashboard)

#### ✅ Profiles Table
- [ ] Buka Supabase Dashboard → Table Editor → `profiles`
- [ ] Ada minimal 1 row (admin user)
- [ ] Kolom `password_hash` berisi bcrypt hash (bukan plaintext)
- [ ] Kolom `is_active` = `true`

#### ✅ Sessions Table
- [ ] Setelah login, buka `sessions` table
- [ ] Ada row baru dengan:
  - `token` = UUID
  - `user_id` = UUID dari profiles
  - `expires_at` = 4 jam dari sekarang
- [ ] Setelah logout, row hilang

#### ✅ QC Records Table
- [ ] Setelah input QC, buka `qc_records` table
- [ ] Ada row baru dengan:
  - `id` = string (format: `qc-{timestamp}`)
  - `tanggal` = date (format: `2026-05-10`)
  - `params` = JSONB (contoh: `{"PT": 12.5, "APTT": 32.0}`)
  - `status` = JSONB (contoh: `{"PT": "ok", "APTT": "ok"}`)
  - `created_by` = UUID dari profiles

#### ✅ Lot Config Table
- [ ] Setelah update lot config, buka `lot_config` table
- [ ] Ada row baru (audit trail — tidak update existing)
- [ ] Kolom `config` = JSONB (full lot config)
- [ ] Kolom `updated_by` = UUID dari profiles

---

### 7. Edge Cases

#### ✅ Expired Session
- [ ] Login
- [ ] Tunggu 4 jam (atau ubah `SESSION_DURATION` di `auth-types.ts` jadi 10 detik untuk testing)
- [ ] Refresh page
- [ ] Redirect ke `/login` dengan session expired

#### ✅ Concurrent Sessions
- [ ] Login di browser A
- [ ] Login dengan user yang sama di browser B
- [ ] Kedua session tetap valid (multi-session allowed)
- [ ] Logout di browser A
- [ ] Browser B tetap login (session independent)

#### ✅ SQL Injection Protection
- [ ] Login dengan username: `admin' OR '1'='1`
- [ ] Login gagal (Supabase parameterized queries)

#### ✅ XSS Protection
- [ ] Input QC dengan catatan: `<script>alert('XSS')</script>`
- [ ] Simpan
- [ ] View di dashboard → script tidak dieksekusi (React auto-escape)

---

## 🐛 Known Issues (Expected)

1. **Connection status text** — masih "Google Sheets", seharusnya "Supabase"
   - **Location:** `src/pages/Dashboard.tsx:126`
   - **Fix:** Ganti text jadi "Terhubung ke Supabase"

2. **bcryptjs warning saat build** — "Module crypto has been externalized"
   - **Impact:** None (bcryptjs pure JS, works in browser)
   - **Action:** Ignore

3. **Default admin password** — placeholder hash di migration
   - **Impact:** Login gagal jika tidak diganti
   - **Action:** Generate real hash sebelum testing

---

## 📊 Performance Checks

- [ ] Login response time < 1s
- [ ] QC record save < 500ms
- [ ] Dashboard load < 2s
- [ ] Chart render < 1s
- [ ] No console errors di browser DevTools

---

### 7. QC Module Database Integration

#### ✅ QC Dashboard (`/qc`)
- [ ] Navigate to `/qc`
- [ ] Stats cards show correct counts (Total QC, In-Control, Peringatan, Diluar Kendali)
- [ ] "Status QC Hari Ini" section displays today's records
- [ ] Connection indicator shows "Supabase" (not "Google Sheets")
- [ ] No console errors

**Verify Data Source:**
- [ ] Open DevTools → Network tab
- [ ] Refresh page
- [ ] See Supabase API calls to `/rest/v1/qc_records`
- [ ] No localStorage fallback

#### ✅ Levey-Jennings Chart (`/qc/chart`)
- [ ] Navigate to `/qc/chart`
- [ ] Select CA660 → PT → Kontrol
- [ ] Chart renders with data points
- [ ] Mean line (blue) and SD lines (green/yellow/red) visible
- [ ] Stats panel shows: n, Mean, SD, CV, In-Control %
- [ ] Select EASYLITE → Na → NORMAL
- [ ] Chart updates with new data
- [ ] No console errors

#### ✅ Monthly Report (`/qc/report`)
- [ ] Navigate to `/qc/report`
- [ ] Month selector shows current month
- [ ] Summary table populates with all instruments
- [ ] Rows show: Alat, Parameter, Level, n, Mean, SD, CV, Status
- [ ] Export Excel button works (downloads file)
- [ ] Export Word button works (downloads file)
- [ ] Select future month → shows empty state
- [ ] No console errors

#### ✅ Lot Config Page (`/qc/config`)
- [ ] Navigate to `/qc/config`
- [ ] All 4 instruments display: CA660, EASYLITE, ONCALL1, ONCALL2
- [ ] Each instrument shows: Lot number, Expiry, Levels, Parameters, Mean, SD
- [ ] CA660: Kontrol level with PT, APTT, INR
- [ ] EASYLITE: NORMAL and HIGH levels with Na, K, Cl
- [ ] ONCALL1/2: CTRL0, CTRL1, CTRL2 levels with GDA
- [ ] All values match DEFAULT_LOT_CONFIG
- [ ] No empty fields
- [ ] No console errors

**Verify Data Source:**
- [ ] Open DevTools → Network tab
- [ ] Refresh page
- [ ] See Supabase API call to `/rest/v1/lot_config`

#### ✅ Input QC Record (`/qc/input`)
- [ ] Navigate to `/qc/input`
- [ ] Select CA660 → Kontrol
- [ ] Lot number auto-populates
- [ ] Enter values: PT=12.8, APTT=33.5, INR=1.02
- [ ] Analis: rama
- [ ] Click **Simpan**
- [ ] Toast: "Data QC berhasil disimpan!"
- [ ] Form resets
- [ ] Navigate to `/qc` → new record appears in "Status QC Hari Ini"

**Verify in Database:**
```sql
SELECT * FROM qc_records WHERE analis = 'rama' ORDER BY created_at DESC LIMIT 1;
```
- [ ] Record exists with correct values
- [ ] `created_by` = rama UUID
- [ ] `tanggal` = today's date
- [ ] `status` JSONB has `ok` values

#### ✅ Update Lot Config (`/qc/config`)
- [ ] Navigate to `/qc/config`
- [ ] Edit CA660 config (if edit button exists)
- [ ] Update PT Mean: 12.8 (from 12.5)
- [ ] Click **Simpan**
- [ ] Toast: "Konfigurasi lot berhasil diperbarui!"
- [ ] Page refreshes with new values

**Verify in Database:**
```sql
SELECT config->'CA660'->0->'Kontrol'->'PT'->>'mean' as pt_mean
FROM lot_config ORDER BY updated_at DESC LIMIT 1;
```
- [ ] `pt_mean` = 12.8
- [ ] `updated_by` = rama UUID

#### ✅ QC Data Integrity
- [ ] Run verification script:
  ```bash
  node scripts/verify-qc-data.cjs
  ```
- [ ] All 6 checks pass:
  - [ ] Count by instrument (CA660: 10, EASYLITE: 15, ONCALL1: 10, ONCALL2: 10)
  - [ ] Count by month (current month: 45+ records)
  - [ ] No orphan records
  - [ ] Lot config structure valid
  - [ ] Tanggal format (ISO YYYY-MM-DD)
  - [ ] JSONB structure valid

---

## ✅ Success Criteria

Migrasi dianggap berhasil jika:

1. ✅ Semua test scenarios di atas pass
2. ✅ Tidak ada console errors
3. ✅ Data tersimpan di Supabase (bukan localStorage)
4. ✅ RLS policies berfungsi (role-based access) — **DISABLED for local dev**
5. ✅ Session management works (login/logout/expired)
6. ✅ QC module reads/writes to Supabase correctly
7. ✅ Lot config and QC records verified in database

---

## 📚 Additional Test Documents

For comprehensive QC module testing, see:

- **FASE3_UI_TESTING.md** - UI read operations (Dashboard, Chart, Report, Config)
- **FASE4_WRITE_TESTING.md** - Write operations (Input QC, Update Config, Role-based access)
- **FASE5_EDGE_CASES_TESTING.md** - Edge cases (Empty state, Invalid data, Network errors, Performance)

---

**Testing by:** _____________  
**Date:** _____________  
**Result:** ⬜ PASS  ⬜ FAIL  
**Notes:**

---
