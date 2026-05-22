# Post-Deployment Tasks

> Lab Vision QC — RS Petrokimia Gresik  
> Deployment selesai: 11 Mei 2026  
> Dokumen ini adalah working checklist untuk pekerjaan selanjutnya.

---

## 🔴 Critical — Selesaikan Sekarang

### Task 1: Fix AI Extraction (Gemini API Key Leaked)

**Problem:** Key lama `AIzaSyDHWu3RBJYEt5ZEMnHF6dqB6TOqrACfat8` diblokir Google karena dilaporkan leaked.

**Steps:**

1. Buka https://aistudio.google.com/apikey
2. Klik **Create API Key** → pilih project
3. Copy key baru (format `AIzaSy...`)
4. Update Supabase secret:
   ```bash
   cd /Users/rama/ramscl_workspace/lab-vision-qc
   supabase secrets set GEMINI_API_KEY=<NEW_KEY>
   ```
5. Redeploy Edge Function:
   ```bash
   supabase functions deploy extract-qc --no-verify-jwt
   ```
6. Test di production:
   - Login → Input QC → Ambil Foto → upload struk CA-660
   - Verify response sukses

**Security:** Jangan commit key ke git. Simpan hanya di Supabase secrets.

---

## 🟡 High Priority — Minggu Ini

### Task 2: Input Konfigurasi Lot

Setelah login sebagai admin, buka **Konfigurasi Lot** dan isi:
- Nomor lot untuk setiap instrumen (CA-660, Easylite, OnCall 1, OnCall 2)
- Tanggal expiry masing-masing lot
- Nilai GDA (mean, SD) per parameter per level

Sistem akan otomatis menampilkan warning jika lot mendekati expired (≤7 hari).

### Task 3: User Training

Sesi training untuk staf laboratorium:

| Topik | Durasi | Target |
|-------|--------|--------|
| Login & navigasi portal | 10 menit | Semua user |
| Input QC manual | 15 menit | Petugas |
| Input QC via AI scan | 15 menit | Petugas |
| Baca Levey-Jennings chart | 20 menit | Petugas + Admin |
| Admin panel (kelola user) | 15 menit | Admin only |

### Task 4: Verifikasi Data Historis

Jika ada data QC historis dari sistem lama (Google Sheets), pertimbangkan:
- Export data dari Sheets
- Import ke tabel `qc_records` via SQL atau script
- Verifikasi format tanggal dan parameter sesuai schema

---

## 🟢 Medium Priority — Bulan Ini

### Task 5: AI Prompt Tuning

Setelah key baru aktif, kumpulkan data real usage untuk improve prompt:

| Instrumen | Target Accuracy | Status |
|-----------|----------------|--------|
| CA-660 (PT, APTT, INR) | ≥90% | ✅ Sudah berjalan |
| Easylite (GDA) | ≥80% | ⚠️ Perlu tuning |
| OnCall Sure (GDA) | ≥80% | ⚠️ Belum ditest |

**Cara tuning:**
1. Kumpulkan 10+ foto struk per instrumen dari production
2. Catat kasus yang gagal diekstrak
3. Update prompt di `supabase/functions/extract-qc/gemini.ts`
4. Test dengan foto yang sama
5. Deploy ulang: `supabase functions deploy extract-qc --no-verify-jwt`

### Task 6: Monitoring Setup

Query SQL berguna untuk monitoring rutin (jalankan di Supabase SQL Editor):

```sql
-- AI extraction success rate hari ini
SELECT
  COUNT(*) FILTER (WHERE success = true) * 100.0 / NULLIF(COUNT(*), 0) AS success_rate_pct,
  COUNT(*) AS total_attempts,
  COUNT(*) FILTER (WHERE success = false) AS failures
FROM qc_ai_logs
WHERE created_at >= CURRENT_DATE;

-- Usage per user (minggu ini)
SELECT
  p.username,
  p.nama,
  COUNT(l.id) AS scans_used,
  20 - COUNT(l.id) AS remaining
FROM profiles p
LEFT JOIN qc_ai_logs l ON l.user_id = p.id
  AND l.created_at >= date_trunc('day', NOW())
GROUP BY p.id, p.username, p.nama
ORDER BY scans_used DESC;

-- Error breakdown
SELECT
  error_message,
  COUNT(*) AS count
FROM qc_ai_logs
WHERE success = false
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY error_message
ORDER BY count DESC;

-- QC records per hari (bulan ini)
SELECT
  tanggal,
  alat,
  COUNT(*) AS total_records
FROM qc_records
WHERE tanggal >= date_trunc('month', CURRENT_DATE)::text
GROUP BY tanggal, alat
ORDER BY tanggal DESC, alat;
```

### Task 7: Cleanup

- [ ] Hapus akun `admin` (lowercase) jika sudah tidak dipakai — diganti `ADMIN`
- [ ] Fix ESLint warnings di Kunjungan module (83 warnings, `any` types)
- [ ] Hapus folder backup `lab-vision-qc-backup-*` setelah yakin production stabil
- [ ] Hapus project `lab-vision-qc-supabase` (sudah di-merge ke `lab-vision-qc`)

---

## 📋 Checklist Status

| Task | Priority | Status |
|------|----------|--------|
| Fix Gemini API key | 🔴 Critical | ⬜ Pending |
| Input konfigurasi lot | 🟡 High | ⬜ Pending |
| User training | 🟡 High | ⬜ Pending |
| Import data historis | 🟡 High | ⬜ Optional |
| AI prompt tuning — Easylite | 🟢 Medium | ⬜ Pending |
| AI prompt tuning — OnCall | 🟢 Medium | ⬜ Pending |
| Monitoring queries | 🟢 Medium | ⬜ Pending |
| Cleanup akun & folder | 🟢 Medium | ⬜ Pending |
