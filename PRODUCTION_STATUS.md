# Production Status

> Lab Vision QC — RS Petrokimia Gresik  
> Last updated: 11 Mei 2026

---

## 🌐 Live URLs

| Service | URL |
|---------|-----|
| Frontend | https://lab-vision-qc.vercel.app |
| Supabase Dashboard | https://supabase.com/dashboard/project/tpyocjcjoucyymsptbbw |
| Edge Function | https://tpyocjcjoucyymsptbbw.supabase.co/functions/v1/extract-qc |
| Vercel Dashboard | https://vercel.com/alfaruqramas-projects/lab-vision-qc |

---

## 🔧 System Status

| Komponen | Status | Catatan |
|----------|--------|---------|
| Frontend (Vercel) | ✅ Live | Build 1.6 MB, gzip 470 KB |
| Database (Supabase) | ✅ Live | Singapore region |
| Auth (custom sessions) | ✅ Working | Case-insensitive username & password |
| Edge Function | ✅ Deployed | `--no-verify-jwt`, custom session auth |
| AI Extraction | 🔴 Broken | Gemini API key leaked — lihat POST_DEPLOYMENT_TASKS.md |
| Kunjungan Module | ✅ Working | GAS integration tidak berubah |
| Monitor Suhu | ✅ Working | Supabase backend |

---

## 👥 User Accounts (29 Total)

> Username dan password **case-insensitive**.

### Admin (4)

| Username | Password | Nama |
|----------|----------|------|
| ADMIN | admin123 | ADMIN (default) |
| LINA | 09164 | MARLINA SETYA DEWI |
| RAMA | 21241 | RAMA AL FARUQ MUKHLIS, AMD.KES. |
| admin | admin123 | Administrator (legacy) |

### Petugas (24)

| Username | Password | Nama |
|----------|----------|------|
| NILA | 17370 | TIEN MARNILA DIAN |
| YUDI | 05028 | AHMAD WAHYUDI |
| KRISNA | 11199 | KRISNA WIJAYANTI |
| ARINI | 13281 | ARINI RAHMAWATI |
| SANNY | 13256 | SANNY PARAMAMITHA |
| ZIDNI | 22063 | ZIDNI ALFIYAN BARIK |
| INDAH | 08127 | SRI INDAHWATI |
| IMA | 13250 | HALIMATUS SADIYAH |
| ALFI | 08126 | ALFI MASRUROH |
| ALIF | 23124 | ALIFIYAH YUNANDA |
| REVA | 25021 | MELVI REVALADIANI, A.MD.KES |
| GITA | 25123 | GITA RAHMA WATI SANTOSO |
| JASMINE | 25098 | FEYZA JASMINE AURANISA |
| REYVAL | 25186 | REYVALIANO SHEVALA PUTRA W |
| DAVINA | 23060 | DAVINA LEA PUTRI RACHMADANI |
| KIKI | 12240 | RIZKY SURYANTI |
| WAHYU | 19107 | WAHYU TRILAKSANA |
| DIAH | 22027 | DIAH OKTAVIANI |
| RIZAL | 25104 | MOHAMMAD RIZAL MAHENDRA |
| ZULI | 22494 | ZULI ASFIATIN |
| MIDAH | 17056 | KHAMIDATUS SARIROH |
| ILHAM | 19108 | ILHAM MUJIB |
| WILA | 22007 | IRNES WILAWARDANI |
| ROCHMAN | 16087 | NUR ROCHMAN YULYANTO |

### Viewer (1)

| Username | Password | Nama |
|----------|----------|------|
| VIEWER | viewer | VIEWER |

---

## 🗄️ Database

| Item | Detail |
|------|--------|
| Project ref | `tpyocjcjoucyymsptbbw` |
| Region | Southeast Asia (Singapore) |
| Tables | profiles, sessions, qc_records, lot_config, qc_ai_logs |
| Migrations applied | 001_initial.sql, 002_qc_ai_logs.sql |
| RLS | Disabled (custom session auth via Edge Function) |

---

## 🐛 Known Issues

### 🔴 Critical

**Gemini API Key Leaked**
- Error: `403 PERMISSION_DENIED — Your API key was reported as leaked`
- Impact: AI extraction tidak bisa jalan
- Workaround: Input manual tetap berfungsi
- Fix: Lihat `POST_DEPLOYMENT_TASKS.md` → Task 1

### 🟡 Non-Critical

- ESLint 83 warnings di Kunjungan module (legacy code, tidak blocking)
- AI prompt untuk Easylite & OnCall belum optimal (perlu tuning post-fix key)
