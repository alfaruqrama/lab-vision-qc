# Supabase Migration — Lab Vision QC

Branch: `feature/supabase-migration`

## Summary

Migrasi dari Google Apps Script (GAS) ke Supabase untuk:
- ✅ **Auth system** — custom username + bcrypt hash + UUID token sessions
- ✅ **QC Records** — data QC harian dengan RLS policies
- ✅ **Lot Config** — konfigurasi lot dengan audit trail
- ⚠️ **AI Extraction** — tetap via GAS (Gemini Vision)
- ⚠️ **Kunjungan module** — tidak dimigrasi (tetap GAS)

---

## Changes Made

### Phase 1: Database Schema

**File:** `supabase/migrations/001_initial.sql`

- Tabel `profiles` — user management dengan bcrypt password hash
- Tabel `sessions` — custom token auth (UUID)
- Tabel `qc_records` — data QC dengan JSONB params & status
- Tabel `lot_config` — konfigurasi lot dengan audit trail
- RLS policies — role-based access control via `x-session-token` header
- Helper function `get_user_role_from_token()` untuk RLS
- Seed data: default admin user (username: `admin`, password: `admin123`)

### Phase 2: Auth Migration

**Modified:**
- `src/lib/supabase.ts` — Supabase client factory dengan session token injection
- `src/lib/auth-types.ts` — tambah `id: string` ke `AuthUser`
- `src/lib/auth-api.ts` — ganti total GAS → Supabase + bcryptjs
- `src/hooks/use-auth.tsx` — hapus polling 60s, pertahankan `DEV_BYPASS_AUTH`

**Mapping:**
| Fungsi lama (GAS) | Implementasi baru (Supabase) |
|-------------------|-------------------------------|
| `login(username, password)` | Query `profiles`, `bcrypt.compare()`, insert `sessions` |
| `logout(token)` | Delete dari `sessions` |
| `validateToken(token)` | Query `sessions` join `profiles`, cek `expires_at` |
| `getUsers(token)` | Query `profiles` dengan authenticated client |
| `createUser(...)` | `bcrypt.hash()`, insert `profiles` |
| `updateUser(...)` | Update `profiles` |
| `resetPassword(...)` | `bcrypt.hash()`, update `password_hash` |
| `deleteUser(...)` | Delete dari `profiles` (cascade ke sessions) |

### Phase 3: QC Data Migration

**Modified:**
- `src/lib/api.ts` — trim total, hanya `readStruk()` + `isConnected()`
- `src/features/qc/hooks/useQCRecords.ts` — fetch/save via Supabase
- `src/features/qc/hooks/useQCConfig.ts` — fetch/save via Supabase

**Removed:**
- `fetchAllRecords()`, `fetchRecordsByMonth()`, `fetchConfig()`, `saveRecord()`, `saveConfig()`
- `mapRecordFromSheets()`, `mapRecordToSheets()`
- `ALAT_TO_SHEETS`, `SHEETS_TO_ALAT`
- GAS transport layer (`gasRequest()`, Safari ITP workaround)

**Query changes:**
- Filter by month: `r.tanggal.startsWith('2026-05')` → `.gte('tanggal', '2026-05-01').lt('tanggal', '2026-06-01')`
- Tanggal format: sudah ISO (`2026-05-10`) — tidak ada perubahan

### Phase 4: Dependencies & Config

**Modified:**
- `package.json` — tambah `@supabase/supabase-js`, `bcryptjs`, `@types/bcryptjs`
- `.env.example` — hapus `VITE_GAS_AUTH_URL` & `VITE_GAS_QC_URL`, tambah Supabase vars

---

## Setup Instructions

### 1. Install Dependencies

```bash
cd /Users/rama/ramscl_workspace/lab-vision-qc-supabase
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase (required)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# GAS AI (optional — for QC struk OCR)
VITE_GAS_AI_URL=https://script.google.com/macros/s/XXXXXXX/exec

# Kunjungan (optional — not migrated)
VITE_GAS_INPUT_URL=...
VITE_GAS_LAPORAN_URL=...
```

### 3. Initialize Supabase

**Option A: Local Development (Docker required)**

```bash
# Install Supabase CLI
npm install -g supabase

# Start local Supabase
supabase start

# Apply migration
supabase db reset
```

**Option B: Supabase Cloud**

1. Create project di [supabase.com](https://supabase.com)
2. Copy `SUPABASE_URL` dan `ANON_KEY` dari project settings
3. Run migration via Supabase Dashboard → SQL Editor:
   - Copy-paste isi `supabase/migrations/001_initial.sql`
   - Execute

### 4. Generate Real Admin Password Hash

Default admin password (`admin123`) menggunakan placeholder hash. Generate hash yang benar:

```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 10, (e,h) => console.log(h))"
```

Update hash di Supabase:

```sql
UPDATE profiles 
SET password_hash = '$2a$10$...' -- paste hash dari command di atas
WHERE username = 'admin';
```

### 5. Run Development Server

```bash
npm run dev
```

Login dengan:
- Username: `admin`
- Password: `admin123`

---

## Testing Checklist

- [ ] Login dengan admin user
- [ ] Create new user via AdminUserPanel
- [ ] Input QC record baru
- [ ] View Levey-Jennings chart
- [ ] Update lot config
- [ ] Logout dan login ulang
- [ ] Test role-based access (petugas, viewer)
- [ ] Test AI extraction (jika GAS AI URL dikonfigurasi)

---

## Migration Notes

### What Changed

- **Auth**: GAS → Supabase custom auth (bcrypt + UUID sessions)
- **QC Data**: GAS Sheets → Supabase PostgreSQL
- **Lot Config**: GAS Sheets → Supabase PostgreSQL
- **Session management**: Polling 60s → on-demand validation
- **Token format**: GAS string → UUID v4

### What Didn't Change

- **UI components** — tidak ada perubahan
- **QC logic** (`westgard.ts`, `types.ts`) — tidak berubah
- **Tanggal format** — sudah ISO, tidak perlu migrasi
- **AI extraction** — tetap via GAS
- **Kunjungan module** — tetap via GAS
- **`use-qc-store.tsx`** — interface tetap sama

### Known Issues

- ⚠️ bcryptjs warning saat build — expected, aman diabaikan
- ⚠️ Default admin password hash adalah placeholder — harus diganti setelah setup
- ⚠️ `DEV_BYPASS_AUTH` di `use-auth.tsx` default `false` — set `true` untuk dev bypass

---

## Rollback Plan

Jika ada masalah, rollback ke main branch:

```bash
cd /Users/rama/ramscl_workspace/lab-vision-qc
git checkout main
```

Worktree tetap ada di `/Users/rama/ramscl_workspace/lab-vision-qc-supabase` untuk investigasi.

---

## Next Steps

1. ✅ Review PR ini
2. ⬜ Setup Supabase project (local atau cloud)
3. ⬜ Run migration SQL
4. ⬜ Generate real admin password hash
5. ⬜ Test semua fitur
6. ⬜ Merge ke main setelah testing OK

---

**Developed by:** RAMA  
**Date:** 2026-05-10  
**Branch:** `feature/supabase-migration`
