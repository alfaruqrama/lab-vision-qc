# Portal Lab Internal — RS Petrokimia Gresik

Sistem informasi laboratorium terintegrasi untuk Pemantapan Mutu Internal (PMI), monitoring suhu, dan manajemen operasional laboratorium.

---

## Fitur

| Modul | Deskripsi | Status |
|-------|-----------|--------|
| **QC / PMI** | Input kontrol harian, grafik Levey-Jennings, laporan bulanan | ✅ Production Ready |
| **Monitor Suhu** | Pemantauan suhu peralatan laboratorium | ✅ Production Ready |
| **Kunjungan** | Dashboard statistik kunjungan pasien | ✅ Production Ready |
| **TCM Form** | Formulir pengiriman spesimen (akses publik) | ✅ Production Ready |
| **Admin** | Manajemen user & role-based access | ✅ Production Ready |
| **AI Extraction** | Scan struk QC otomatis via Gemini AI | ⚠️ In Progress |

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React 18 · TypeScript · Vite |
| UI | Tailwind CSS · shadcn/ui · Recharts |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| AI | Google Gemini 2.5 Flash Lite |
| Auth | Custom (bcrypt + UUID session tokens) |
| Deploy | Vercel (frontend) · Supabase (backend) |
| Export | XLSX · DOCX |

---

## Quick Start (Local Development)

### Prerequisites

- Node.js >= 18
- Supabase CLI >= 2.x (`brew install supabase/tap/supabase`)

### Setup

```bash
# Install dependencies
npm install

# Start Supabase local stack
supabase start

# Copy env file
cp .env.example .env.local
# Edit .env.local dengan URL dan key dari output `supabase start`

# Start Edge Function (terminal terpisah — untuk AI extraction)
supabase functions serve extract-qc \
  --env-file supabase/.env \
  --no-verify-jwt

# Start dev server
npm run dev
```

### Scripts

| Command | Keterangan |
|---------|------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run test` | Run unit tests |
| `npm run lint` | ESLint check |
| `npx tsc --noEmit` | TypeScript check |

---

## Project Structure

```
src/
├── components/
│   ├── layout/         # AppLayout, PortalLayout, ProtectedRoute
│   └── ui/             # shadcn/ui components
├── features/
│   └── qc/
│       ├── components/ # QCRecordCard, LotExpiryBanner, dll
│       ├── hooks/      # useAIExtraction, useQCRecords, useQCConfig
│       └── lib/        # constants (instrument labels, icons, colors)
├── hooks/              # use-auth, use-qc-store, use-suhu-store
├── lib/                # api, auth-api, types, lot-expiry, westgard
├── pages/
│   ├── InputQC/        # Multi-step QC input form
│   ├── Dashboard.tsx   # QC dashboard
│   ├── LeveyJennings.tsx
│   ├── LotConfig.tsx
│   ├── MonthlyReport.tsx
│   └── ...
└── main.tsx
supabase/
├── functions/
│   └── extract-qc/     # AI extraction Edge Function (Gemini)
├── migrations/
│   ├── 001_initial.sql
│   └── 002_qc_ai_logs.sql
└── config.toml
```

---

## Routes

| Path | Akses | Keterangan |
|------|-------|------------|
| `/login` | Public | Halaman login |
| `/tcm` | Public | Form TCM |
| `/` | Auth | Portal home |
| `/qc` | Auth | Dashboard QC |
| `/qc/input` | admin, petugas | Input QC harian |
| `/qc/chart` | Auth | Levey-Jennings chart |
| `/qc/report` | Auth | Laporan bulanan |
| `/qc/config` | admin, petugas | Konfigurasi lot |
| `/kunjungan` | Auth | Dashboard kunjungan |
| `/suhu` | Auth | Monitor suhu |
| `/admin/users` | admin | Manajemen user |

---

## Auth System

Sistem menggunakan **custom auth** (bukan Supabase Auth bawaan):

- Password di-hash dengan **bcrypt** (cost factor 10)
- Session token berupa **UUID** disimpan di tabel `sessions`
- Token disimpan di `localStorage` dengan key `lab-portal-auth`
- Session duration: **4 jam**
- Role: `admin` · `petugas` · `viewer`

---

## Database Schema

```sql
profiles     -- User accounts
sessions     -- Auth tokens (UUID, expires_at)
qc_records   -- QC data harian (params & status sebagai JSONB)
lot_config   -- Konfigurasi lot kontrol per instrumen
qc_ai_logs   -- AI extraction logs + rate limiting (20/user/hari)
```

---

## AI Extraction

Fitur scan struk QC otomatis menggunakan **Supabase Edge Function** + **Google Gemini 2.5 Flash Lite**:

- Token auth dikirim di request body (bukan header) — bypass JWT validation
- Rate limit: **20 scan/user/hari** (enforced via `check_ai_rate_limit()`)
- Fallback: input manual selalu tersedia jika AI gagal
- Edge Function harus di-deploy dengan flag `--no-verify-jwt`

**Status per instrumen:**

| Instrumen | Status |
|-----------|--------|
| CA-660 (PT, APTT, INR) | ✅ Berjalan |
| Easylite (Na, K, Cl) | ⚠️ In Progress |
| OnCall Sure (GDA) | ⚠️ Belum ditest |

---

## Deployment

Lihat **[DEPLOYMENT.md](./DEPLOYMENT.md)** untuk panduan lengkap.

**Ringkasan:**

```bash
# 1. Push database migrations
supabase link --project-ref YOUR_REF
supabase db push

# 2. Deploy Edge Function
supabase secrets set GEMINI_API_KEY=your_key
supabase functions deploy extract-qc --no-verify-jwt

# 3. Deploy frontend
vercel --prod
# Set env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
```

---

## License

Internal use only — RS Petrokimia Gresik

---

*Dikembangkan untuk Unit Laboratorium RS Petrokimia Gresik.*
