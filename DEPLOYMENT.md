# Portal Lab Internal — Deployment Guide

> RS Petrokimia Gresik · Lab QC System  
> Last updated: May 2026

---

## Daftar Isi

1. [Overview Arsitektur](#1-overview-arsitektur)
2. [Prerequisites](#2-prerequisites)
3. [Setup Supabase Production](#3-setup-supabase-production)
4. [Database Migrations](#4-database-migrations)
5. [Edge Function Deploy](#5-edge-function-deploy)
6. [Frontend Deploy (Vercel)](#6-frontend-deploy-vercel)
7. [Environment Variables](#7-environment-variables)
8. [Post-Deploy Checklist](#8-post-deploy-checklist)
9. [User Management](#9-user-management)
10. [Troubleshooting](#10-troubleshooting)
11. [Rollback Plan](#11-rollback-plan)

---

## 1. Overview Arsitektur

```
┌─────────────────────────────────────────────────────┐
│                   Browser / PWA                      │
│         React 18 + TypeScript + Vite                 │
│              (Deployed: Vercel)                      │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
          ┌────────────┴────────────┐
          │                         │
          ▼                         ▼
┌─────────────────┐      ┌──────────────────────┐
│  Supabase REST  │      │  Supabase Edge Func  │
│  (PostgREST)    │      │  /functions/v1/      │
│                 │      │  extract-qc          │
│  - qc_records   │      │  (Gemini 2.5 Flash)  │
│  - profiles     │      └──────────┬───────────┘
│  - sessions     │                 │
│  - lot_config   │                 ▼
│  - qc_ai_logs   │      ┌──────────────────────┐
└─────────────────┘      │  Google Gemini API   │
          │               │  (AI OCR Extraction) │
          ▼               └──────────────────────┘
┌─────────────────┐
│  PostgreSQL DB  │
│  (Supabase)     │
└─────────────────┘
```

### Modul & Status

| Modul | Backend | Status Deploy |
|-------|---------|---------------|
| QC / PMI | Supabase (PostgreSQL) | ✅ Ready |
| Auth | Supabase (custom sessions) | ✅ Ready |
| AI Extraction | Supabase Edge Function + Gemini | ⚠️ In Progress |
| Monitor Suhu | Supabase | ✅ Ready |
| Kunjungan | Google Apps Script (GAS) | ✅ Ready (GAS) |
| TCM Form | Static (no backend) | ✅ Ready |
| Admin Panel | Supabase | ✅ Ready |

> **Catatan AI Extraction:** Fitur AI OCR (scan struk QC) sudah berjalan di local dev tapi masih dalam penyempurnaan prompt per instrumen. Deploy tetap dilakukan — fitur AI bisa digunakan, fallback ke input manual jika gagal.

---

## 2. Prerequisites

### Tools yang Dibutuhkan

```bash
# Node.js >= 18
node --version   # v18.x atau v20.x

# Supabase CLI >= 2.x
supabase --version   # 2.98.2+

# Git
git --version
```

### Install Supabase CLI (jika belum)

```bash
# macOS
brew install supabase/tap/supabase

# Windows / Linux
npm install -g supabase
```

### Akun yang Dibutuhkan

- [x] Supabase account → https://supabase.com
- [x] Vercel account → https://vercel.com
- [x] Google AI Studio (Gemini API key) → https://aistudio.google.com

---

## 3. Setup Supabase Production

### 3.1 Buat Project Baru

1. Login ke https://supabase.com/dashboard
2. Klik **New Project**
3. Isi:
   - **Name:** `lab-portal-petrokimia` (atau sesuai preferensi)
   - **Database Password:** Buat password kuat, **simpan di tempat aman**
   - **Region:** `Southeast Asia (Singapore)` — paling dekat dengan Indonesia
4. Tunggu project selesai dibuat (~2 menit)

### 3.2 Ambil Credentials

Setelah project dibuat, buka **Project Settings → API**:

```
Project URL:    https://xxxxxxxxxxxx.supabase.co
Anon Key:       eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service Role:   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  ← RAHASIA, jangan expose
```

> **Simpan semua credentials ini** — dibutuhkan di langkah berikutnya.

### 3.3 Link Project ke Local

```bash
cd /path/to/lab-vision-qc-supabase

# Login ke Supabase CLI
supabase login

# Link ke project production
supabase link --project-ref YOUR_PROJECT_REF

# Verifikasi
supabase status
```

> `YOUR_PROJECT_REF` = bagian dari URL: `https://YOUR_PROJECT_REF.supabase.co`

---

## 4. Database Migrations

### 4.1 Push Migrations ke Production

```bash
# Dari root project
supabase db push
```

Ini akan menjalankan secara berurutan:
1. `001_initial.sql` — Tabel utama (profiles, sessions, qc_records, lot_config)
2. `002_qc_ai_logs.sql` — Tabel AI logs + rate limit functions

### 4.2 Verifikasi Tabel

Buka **Supabase Dashboard → Table Editor**, pastikan tabel berikut ada:

| Tabel | Keterangan |
|-------|------------|
| `profiles` | Data user (username, role, password_hash) |
| `sessions` | Custom auth tokens (UUID) |
| `qc_records` | Data QC harian |
| `lot_config` | Konfigurasi lot kontrol per instrumen |
| `qc_ai_logs` | Log AI extraction + rate limiting |

### 4.3 Setup RLS (Row Level Security)

> Untuk production, aktifkan RLS. Jalankan di **SQL Editor** Supabase:

```sql
-- Enable RLS untuk semua tabel
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE lot_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE qc_ai_logs ENABLE ROW LEVEL SECURITY;

-- Policy: semua operasi via service role (Edge Function)
-- Frontend menggunakan anon key + custom session validation
-- Tidak perlu policy berbasis auth.uid() karena auth custom
CREATE POLICY "Allow all via service role" ON profiles
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all via service role" ON sessions
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all via service role" ON qc_records
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all via service role" ON lot_config
  USING (true) WITH CHECK (true);

CREATE POLICY "Allow all via service role" ON qc_ai_logs
  USING (true) WITH CHECK (true);
```

> **Catatan:** Sistem ini menggunakan custom auth (bukan Supabase Auth bawaan). Session validation dilakukan di aplikasi level, bukan di RLS. Untuk keamanan lebih lanjut, pertimbangkan migrasi ke Supabase Auth di versi berikutnya.

### 4.4 Seed Data Awal (Admin User)

Jalankan di **SQL Editor** Supabase untuk membuat user admin pertama:

```sql
-- Buat admin user pertama
-- Password hash untuk 'admin123' (ganti setelah login pertama!)
INSERT INTO profiles (username, nama, role, password_hash, is_active)
VALUES (
  'admin',
  'Administrator',
  'admin',
  '$2a$10$YourBcryptHashHere',  -- Generate dengan: https://bcrypt-generator.com
  true
);
```

> **Penting:** Generate bcrypt hash yang benar untuk password yang diinginkan. Gunakan cost factor 10.

---

## 5. Edge Function Deploy

### 5.1 Set Secrets (Gemini API Key)

```bash
# Set Gemini API key sebagai secret
supabase secrets set GEMINI_API_KEY=AIzaSyDHWu3RBJYEt5ZEMnHF6dqB6TOqrACfat8

# Verifikasi
supabase secrets list
```

> **Catatan:** Gunakan API key production yang berbeda dari development jika memungkinkan.

### 5.2 Deploy Edge Function

```bash
# Deploy extract-qc function
supabase functions deploy extract-qc --no-verify-jwt
```

> Flag `--no-verify-jwt` **wajib** karena sistem menggunakan custom UUID session tokens, bukan Supabase JWT.

### 5.3 Verifikasi Edge Function

```bash
# Test endpoint (ganti dengan URL production)
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/extract-qc \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"test","sessionToken":"invalid-token"}'

# Expected response:
# {"success":false,"error":"Invalid or expired session"}
```

Jika response seperti di atas, Edge Function berhasil deploy dan berjalan.

### 5.4 Konfigurasi --no-verify-jwt di Production

Untuk production Supabase, `--no-verify-jwt` dikonfigurasi saat deploy (sudah dilakukan di langkah 5.2). Tidak perlu konfigurasi tambahan.

---

## 6. Frontend Deploy (Vercel)

### 6.1 Persiapan Build

```bash
# Pastikan build berhasil tanpa error
npm run build

# Output di dist/
ls dist/
```

### 6.2 Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (dari root project)
vercel --prod
```

### 6.3 Deploy via Vercel Dashboard (Alternatif)

1. Push code ke GitHub/GitLab
2. Buka https://vercel.com/new
3. Import repository
4. Set **Framework Preset:** Vite
5. Set **Build Command:** `npm run build`
6. Set **Output Directory:** `dist`
7. Tambahkan Environment Variables (lihat bagian 7)
8. Klik **Deploy**

### 6.4 Custom Domain (Opsional)

Di Vercel Dashboard → Project → Settings → Domains:
```
lab.rspetrokimia.co.id   (atau domain yang tersedia)
```

---

## 7. Environment Variables

### 7.1 Variabel yang Dibutuhkan

| Variable | Nilai | Keterangan |
|----------|-------|------------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | URL project Supabase production |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` | Anon/publishable key |

### 7.2 Set di Vercel

**Via Dashboard:**
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Tambahkan masing-masing variable
3. Set untuk environment: **Production**, **Preview**, **Development**

**Via CLI:**
```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

### 7.3 File `.env.local` (Local Dev Only)

```env
# Local development only — JANGAN commit ke git
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

> File `.env.local` sudah ada di `.gitignore` — aman, tidak akan ter-commit.

### 7.4 Variabel yang TIDAK Perlu di Frontend

| Variable | Keterangan |
|----------|------------|
| `GEMINI_API_KEY` | Disimpan sebagai Supabase Secret, bukan di frontend |
| `SUPABASE_SERVICE_ROLE_KEY` | Hanya untuk server-side, jangan expose ke frontend |

---

## 8. Post-Deploy Checklist

### 8.1 Functional Testing

Setelah deploy, test semua fitur berikut:

#### Auth
- [ ] Login dengan username/password berhasil
- [ ] Session expired setelah 4 jam
- [ ] Role-based access: admin bisa akses `/admin/users`, viewer tidak bisa
- [ ] Logout bersihkan session

#### QC Module
- [ ] Dashboard `/qc` load data dari Supabase
- [ ] Input QC `/qc/input` — pilih instrumen, level, isi nilai, simpan
- [ ] Data tersimpan dan muncul di dashboard
- [ ] Westgard rules berjalan (status OK/Warning/OOC)
- [ ] Levey-Jennings chart `/qc/chart` tampil dengan benar
- [ ] Laporan bulanan `/qc/report` bisa di-export
- [ ] Konfigurasi lot `/qc/config` bisa edit dan simpan

#### Lot Expiry Warning
- [ ] Banner muncul di dashboard jika ada lot expired/expiring
- [ ] Badge muncul di Lot Config page
- [ ] Warning muncul di Input QC saat pilih lot expired
- [ ] Banner dismiss dan reappear setelah update lot

#### AI Extraction (⚠️ In Progress)
- [ ] Tombol "Scan dengan AI" muncul di Input QC (CA660 & Easylite)
- [ ] Upload foto → Edge Function dipanggil
- [ ] Jika berhasil: nilai terisi otomatis
- [ ] Jika gagal: pesan error yang jelas, bisa input manual
- [ ] Rate limit 20 scan/hari berjalan

#### Monitor Suhu
- [ ] Data suhu tampil
- [ ] Input suhu baru berhasil

#### Kunjungan
- [ ] Dashboard kunjungan load data dari GAS
- [ ] Input harian berfungsi

#### Admin
- [ ] `/admin/users` tampil daftar user
- [ ] Bisa tambah/edit/nonaktifkan user

### 8.2 Performance Check

```bash
# Lighthouse score (via Chrome DevTools)
# Target:
# Performance: > 80
# Accessibility: > 90
# Best Practices: > 90
```

### 8.3 Error Monitoring

Pantau di **Supabase Dashboard → Logs**:
- **API Logs:** Request ke database
- **Edge Function Logs:** AI extraction requests
- **Auth Logs:** Login attempts

---

## 9. User Management

### 9.1 Role System

| Role | Akses |
|------|-------|
| `admin` | Semua fitur + manajemen user |
| `petugas` | Input QC, konfigurasi lot, semua view |
| `viewer` | View only (dashboard, chart, laporan) |

### 9.2 Tambah User Baru

**Via Admin Panel (Recommended):**
1. Login sebagai admin
2. Buka `/admin/users`
3. Klik "Tambah User"
4. Isi username, nama, role, password

**Via SQL (Emergency):**
```sql
-- Generate bcrypt hash dulu di: https://bcrypt-generator.com (cost: 10)
INSERT INTO profiles (username, nama, role, password_hash, is_active)
VALUES ('username_baru', 'Nama Lengkap', 'petugas', '$2a$10$...hash...', true);
```

### 9.3 Reset Password User

**Via Admin Panel:**
1. `/admin/users` → klik user → Edit → ubah password

**Via SQL:**
```sql
UPDATE profiles
SET password_hash = '$2a$10$...new_hash...'
WHERE username = 'username_target';
```

### 9.4 Nonaktifkan User

```sql
UPDATE profiles SET is_active = false WHERE username = 'username_target';
```

---

## 10. Troubleshooting

### 10.1 Login Gagal

**Gejala:** "Username atau password salah" padahal benar

**Cek:**
```sql
-- Pastikan user ada dan aktif
SELECT username, nama, role, is_active FROM profiles WHERE username = 'target_user';

-- Pastikan password_hash valid (bcrypt format)
-- Harus dimulai dengan $2a$10$ atau $2b$10$
SELECT password_hash FROM profiles WHERE username = 'target_user';
```

---

### 10.2 Data QC Tidak Muncul

**Gejala:** Dashboard kosong padahal sudah ada data

**Cek:**
1. Buka browser DevTools → Network tab
2. Cari request ke `supabase.co/rest/v1/qc_records`
3. Cek response — apakah ada error?

**Kemungkinan penyebab:**
- `VITE_SUPABASE_URL` salah di Vercel env vars
- `VITE_SUPABASE_ANON_KEY` salah
- RLS policy terlalu ketat

```sql
-- Cek data ada di database
SELECT COUNT(*) FROM qc_records;
SELECT * FROM qc_records ORDER BY created_at DESC LIMIT 5;
```

---

### 10.3 AI Extraction Gagal

**Gejala:** "AI gagal baca otomatis, isi manual ya"

**Cek Edge Function logs:**
```
Supabase Dashboard → Edge Functions → extract-qc → Logs
```

**Error umum:**

| Error | Penyebab | Solusi |
|-------|----------|--------|
| `Invalid or expired session` | Session token tidak valid | User login ulang |
| `Rate limit exceeded` | Sudah 20 scan hari ini | Tunggu besok |
| `GEMINI_API_KEY not configured` | Secret belum di-set | `supabase secrets set GEMINI_API_KEY=...` |
| `503 UNAVAILABLE` | Gemini API overload | Coba lagi beberapa menit |
| `Missing required field: alat` | Gemini tidak bisa identifikasi instrumen | Foto lebih jelas, pencahayaan cukup |

---

### 10.4 Edge Function 401 Error

**Gejala:** HTTP 401 saat call Edge Function

**Penyebab:** Function di-deploy tanpa `--no-verify-jwt`

**Solusi:**
```bash
supabase functions deploy extract-qc --no-verify-jwt
```

---

### 10.5 Build Error di Vercel

**Gejala:** Deploy gagal di Vercel

**Cek:**
```bash
# Test build lokal dulu
npm run build

# Cek TypeScript errors
npx tsc --noEmit
```

**Error umum:**
- Missing env vars → tambahkan di Vercel dashboard
- Node version mismatch → set di `package.json`:
  ```json
  "engines": { "node": ">=18" }
  ```

---

### 10.6 Session Expired Terlalu Cepat

**Gejala:** User sering diminta login ulang

**Konfigurasi:** `src/lib/auth-types.ts`
```typescript
export const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 jam
```

Ubah ke 8 jam jika diperlukan:
```typescript
export const SESSION_DURATION = 8 * 60 * 60 * 1000; // 8 jam
```

---

## 11. Rollback Plan

### 11.1 Rollback Frontend

```bash
# Via Vercel CLI — list deployments
vercel ls

# Promote deployment lama ke production
vercel promote DEPLOYMENT_URL --scope=TEAM_SLUG
```

**Via Vercel Dashboard:**
1. Project → Deployments
2. Klik deployment yang ingin di-rollback
3. Klik "..." → "Promote to Production"

### 11.2 Rollback Database

> **Penting:** Tidak ada auto-rollback untuk database. Selalu backup sebelum migration.

**Backup sebelum deploy:**
```bash
# Dump database production
supabase db dump --file backup_$(date +%Y%m%d).sql
```

**Restore jika diperlukan:**
```bash
# Restore dari backup
psql postgresql://postgres:PASSWORD@db.YOUR_REF.supabase.co:5432/postgres \
  < backup_20260511.sql
```

### 11.3 Rollback Edge Function

```bash
# Deploy versi sebelumnya dari git
git checkout PREVIOUS_COMMIT -- supabase/functions/extract-qc/
supabase functions deploy extract-qc --no-verify-jwt
```

---

## Appendix A: Local Development Setup

```bash
# Clone & install
git clone <repo-url>
cd lab-vision-qc-supabase
npm install

# Start Supabase local
supabase start

# Copy env
cp .env.example .env.local
# Edit .env.local dengan credentials local

# Start Edge Function (terminal terpisah)
supabase functions serve extract-qc \
  --env-file supabase/.env \
  --no-verify-jwt

# Start dev server
npm run dev
# → http://localhost:5173 (atau port lain jika 5173 occupied)
```

---

## Appendix B: Struktur Database

```
profiles          → User accounts (custom auth)
  id, username, nama, role, password_hash, is_active

sessions          → Auth tokens
  token (UUID), user_id, expires_at

qc_records        → QC data harian
  id, timestamp, tanggal, alat, level, lot,
  params (jsonb), status (jsonb), analis, catatan

lot_config        → Konfigurasi lot kontrol
  id, instrument, config (jsonb), updated_at, updated_by

qc_ai_logs        → AI extraction logs
  id, user_id, request_timestamp, success,
  error_message, tokens_used, response_time_ms,
  extracted_data (jsonb), image_size_kb
```

---

## Appendix C: AI Extraction — Status & Roadmap

### Status Saat Ini (May 2026)

| Instrumen | Status | Catatan |
|-----------|--------|---------|
| CA-660 (Koagulasi) | ✅ Berjalan | PT, APTT, INR berhasil diekstrak |
| Easylite (Elektrolit) | ⚠️ Partial | Na, K, Cl — prompt perlu tuning |
| OnCall Sure (Glukosa) | ⚠️ Belum ditest | Perlu sample struk |

### Known Issues

- Gemini 2.5 Flash Lite kadang 503 (overload) — temporary, coba lagi
- Prompt belum optimal untuk semua format struk
- Fallback ke input manual selalu tersedia

### Roadmap

- [ ] Instrument-specific prompts (per format struk)
- [ ] Retry logic dengan exponential backoff
- [ ] Model fallback (2.5 Flash Lite → 2.0 Flash → 1.5 Flash)
- [ ] Better error messages per instrumen

---

## Appendix D: Kontak & Support

| Kebutuhan | Kontak |
|-----------|--------|
| Bug report / feature request | Hubungi developer |
| Reset password user | Admin panel atau SQL |
| Database issue | Supabase Dashboard → Support |
| Gemini API quota | Google AI Studio → Billing |

---

*Dokumen ini dibuat untuk keperluan deployment internal RS Petrokimia Gresik.*  
*Jangan distribusikan credentials atau API keys yang tercantum di dokumen ini.*
