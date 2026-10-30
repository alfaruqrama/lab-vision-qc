# Laporan Kode Modul QC — `lab-vision-qc`

**Basis audit:** `/root/work/lab-vision-qc`, branch `main`, commit `d81be7d`, working tree bersih.
**Metode:** audit statis (baca kode, migrasi, edge function). Build/lint/test tidak dijalankan — `node_modules` tidak tersedia di workspace.
**Catatan:** Di workspace hanya ada satu modul QC, yaitu `lab-vision-qc` (Portal Lab RS Petrokimia Gresik), jadi laporan ini mengacu ke sana.

---

## 1. Ringkasan Eksekutif

| Aspek | Kondisi |
|---|---|
| Fungsi | Input QC harian, evaluasi Westgard, grafik Levey-Jennings, laporan bulanan, konfigurasi lot, OCR struk via AI |
| Stack | React 18 + Vite + TypeScript, React Query, Supabase (Postgres + Edge Function), Tailwind + shadcn/ui, Recharts |
| Ukuran modul | **39 file, ±7.293 baris** (kode inti, di luar komponen UI bersama) |
| Domain | 6 instrumen: CA660, EASYLITE, ONCALL1/2, CLEVER1/2 — 7 parameter (PT, APTT, INR, Na, K, Cl, GDA) |
| Status klaim | README: "QC/PMI ✅ Production Ready", "AI Extraction ⚠️ In Progress" |
| Hasil audit | **3 isu P0, 7 isu P1, 14 isu P2.** Arsitektur rapi & termodularisasi, tetapi keamanan data, integritas konfigurasi, dan test logika QC belum layak produksi. |

---

## 2. Inventaris File

| Area | File | Baris | Peran |
|---|---|---|---|
| **features/qc** (14 file) | `components/*` | 1.479 | QCRecordCard, ParamValueCard, StatusBadge, InstrumentSelector, LogSheet (View/Table), LotExpiryBanner, DashboardSkeleton |
| | `hooks/useQCRecords.ts` | 200 | Query + mutation records (optimistic update) |
| | `hooks/useQCConfig.ts` | 153 | Query + mutation lot config + normalisasi legacy EASYLITE |
| | `hooks/useAIExtraction.ts` | 217 | Orkestrasi OCR: foto → API → isi form, simulasi demo |
| | `lib/constants.ts` | 52 | Label, ikon, warna, jumlah level per alat |
| **pages/InputQC** (6 file) | `index.tsx` | 106 | Wizard 2–3 langkah |
| | `StepForm.tsx` | 471 | Form nilai, validasi, evaluasi Westgard, simpan |
| | `PhotoCapture`, `AIResultPanel`, `StepLevel`, `StepIndicator` | 357 | Pendukung |
| **Halaman QC** (4 file) | `Dashboard.tsx` | 327 | Statistik bulan, filter status, daftar record, banner expiry |
| | `LeveyJennings.tsx` | 1.254 | Chart single & multi-level, analisis Westgard, export PNG/PDF/print |
| | `LotConfig.tsx` | 547 | CRUD lot + mean/SD (mode mean / range / CV) |
| | `MonthlyReport.tsx` | 529 | Rekap statistik, LJ overview, log sheet, Excel/print |
| **Lib inti** (5 file) | `types.ts`, `westgard.ts`, `westgard-multi.ts`, `zscore.ts`, `lot-expiry.ts` | 878 | Model data & mesin aturan |
| **State/API** | `use-qc-store.tsx`, `api.ts`, `mock-data.ts` | 545 | Facade store, AI API, data demo |
| **Edge Function** | `supabase/functions/extract-qc/*` | 502 | Auth sesi, rate limit, preprocess, Gemini, parser |
| **Migrasi QC** | `001_initial.sql`, `002_qc_ai_logs.sql` | 298 | Tabel `qc_records`, `lot_config`, `qc_ai_logs` + RPC |

Total `any`/`as any`: **24 titik** — terkonsentrasi di `zscore.ts`, `LotConfig.tsx`, `MonthlyReport.tsx`, `useQCConfig.ts`.

---

## 3. Arsitektur & Alur Data

```
App.tsx
└── QueryClientProvider → AuthProvider → QCProvider (use-qc-store)
      ├── useQCRecords ──► fetchRecords ──► Supabase: qc_records (12 bulan terakhir)
      ├── useQCConfig  ──► fetchConfig  ──► Supabase: lot_config (row terbaru)
      └── useAIExtraction ─► api.readStruk ─► Edge Function extract-qc
                                                ├─ validasi session (tabel sessions)
                                                ├─ rate limit 20/hari (RPC)
                                                ├─ preprocess → Gemini 2.5 Flash Lite
                                                └─ parser + log ke qc_ai_logs

Routes: /qc (Dashboard) · /qc/input · /qc/chart · /qc/report · /qc/config
```

**Alur input:** pilih alat → (level) → isi nilai → `evaluateWestgard()` per parameter → `addRecord()` (optimistic cache) → INSERT Supabase. EASYLITE mengirim 2 record (NORMAL & HIGH) sekaligus.

**Alur chart:** record 1 bulan + config → `computeZScores()` (z = (nilai − mean)/SD per lot) → chart single/multi-level → `analyzeMultiLevel()` (rule 1-3s/1-2s/2-2s/4-1s/10x, R-4s, shift/trend/bias, rekomendasi).

**Alur laporan:** record bulan → grouping `alat+level+param` → n, mean aktual, SD, CV, status → tabel ringkasan + LJ overview → print (PNG via html-to-image) / Excel (xlsx) / log sheet.

---

## 4. Model Data

**Tabel Supabase**

- `qc_records`: `id text PK`, `timestamp`, `tanggal date`, `alat`, `level`, `lot`, `params jsonb`, `status jsonb`, `analis`, `catatan`, `created_by` → index tanggal/alat/created_by.
- `lot_config`: `id serial`, `config jsonb`, `updated_at`, `updated_by` → append-only (audit trail), fetch `order by updated_at desc limit 1`.
- `qc_ai_logs`: user, success, tokens, response time, data hasil, image size + RPC `check_ai_rate_limit()` dan `get_remaining_ai_scans()`.

**Model config per alat** (sengaja berbeda bentuk): CA660/CLEVER → `Kontrol.{param}`; EASYLITE → `{NORMAL[], HIGH[]}` dengan `params`; ONCALL → `CTRL0/1/2.GDA`. Ada normalizer untuk format legacy EASYLITE (array tunggal).

**Tipe domain:** `InstrumentType`, `ControlLevel` (6 nilai: `Kontrol`, `NORMAL`, `HIGH`, `CTRL0-2`), `QCRecord`, `WestgardStatus` (`ok|warning|oos`).

---

## 5. Logika Inti

| Komponen | Isi | Catatan |
|---|---|---|
| `westgard.ts` | 1-3s → `oos`, 1-2s → `warning`, helper `getOverallStatus()` | Hanya single-point; dipakai saat simpan |
| `westgard-multi.ts` | 1-3s, 1-2s, 2-2s, 4-1s, 10x, R-4s antar level; shift ≥6, trend ≥7, bias ≥80%, random error; cross-level systematic/specific/stable; rekomendasi tindakan | Modul paling matang secara domain |
| `zscore.ts` | Konversi record → z-score; lookup lot per tanggal | Lihat temuan P1 #5 |
| `lot-expiry.ts` | Expired / expiring ≤7 hari / unknown; hash config untuk dismiss banner | Jalan baik |

**Validasi input:** hanya "minimal satu nilai terisi" + peringatan duplikat (bukan blokir). Tidak ada validasi rentang fisiologis atau tipe lot.

---

## 6. Fitur per Route / Halaman

| Route | Akses | Fungsi |
|---|---|---|
| `/qc` | semua role login | Statistik bulan berjalan, filter OK/warning/OOS, daftar record hari ini / bulan historis, banner lot expired, hapus record (role modify) |
| `/qc/input` | admin, petugas, developer | Wizard alat → level → form; input NORMAL+HIGH untuk EASYLITE; OCR struk (CA660/EASYLITE); peringatan expiry & duplikat; simpan ke Supabase |
| `/qc/chart` | semua role login | Grafik Levey-Jennings single & multi-level (z-score), analisis Westgard, resume kontrol, export PNG/PDF/print |
| `/qc/report` | semua role login | Rekap bulanan (n, mean target/aktual, SD, CV, status), LJ overview, log sheet, export Excel/print |
| `/qc/config` | admin, petugas, developer | CRUD lot per instrumen, mean/SD (mode mean/range/CV), tanggal expiry, indikator expiry |

---

## 7. Temuan Audit

### 🔴 P0 — Harus segera

**1. RLS Supabase nonaktif total → data & kredensial terbuka**
`supabase/migrations/001_initial.sql:80–86, 108–211` (semua policy di dalam komentar), dikonfirmasi `PRODUCTION_STATUS.md:91` "RLS Disabled". Dengan anon key yang ada di bundle JS, siapa pun bisa:

- `SELECT profiles` → **username + `password_hash`** (`001_initial.sql:10–18`);
- `SELECT sessions` → **token sesi aktif** (bisa dipakai sebagai siapa pun);
- baca/tulis/hapus `qc_records` dan `lot_config` (viewer pun bisa delete via console).

Ditambah `src/lib/auth-api.ts:55–68` melakukan **bcrypt.compare di browser**, jadi hash password memang dikirim ke client. `DEPLOYMENT.md:176–196` menyarankan policy `USING (true)` — itu **tidak menambah keamanan**.
*Rekomendasi:* login pindah ke RPC `SECURITY DEFINER`/Edge Function, `REVOKE` kolom `password_hash`, aktifkan RLS + policy berbasis session token, dan jangan pernah mengirim hash ke client.

**2. Konfigurasi lot bisa tertimpa default**
`src/pages/LotConfig.tsx:288–289`: `useState(() => JSON.parse(JSON.stringify(config)))` tanpa `useEffect` sinkronisasi. Jika halaman dibuka langsung/refresh saat config belum selesai di-fetch, state berisi `DEFAULT_LOT_CONFIG` (mock). Menekan Simpan akan **menulis mean/SD demo ke `lot_config` produksi**. Ini berpotensi merusak seluruh evaluasi QC.
*Rekomendasi:* inisialisasi hanya setelah `loading === false`, atau sync via `useEffect` + guard dirty state.

**3. Query Desember selalu gagal**
`src/features/qc/hooks/useQCRecords.ts:21–23`: `now.getMonth() + 2` menghasilkan `"2025-13-01"` untuk Desember. PostgREST gagal cast ke `date`, `error` ditelan (`return []`) → dashboard, chart, dan laporan **kosong di bulan Desember**.
*Rekomendasi:* pakai `new Date(y, m+1, 1)` lalu format ISO.

### 🟠 P1 — Bug fungsional / integritas data

**4. EASYLITE selalu menyimpan 2 record, termasuk yang kosong**
`src/pages/InputQC/StepForm.tsx:240–243` memanggil `addRecord` untuk NORMAL dan HIGH tanpa cek `hasNormal/hasHigh`. Jika petugas hanya mengisi HIGH, tersimpan record NORMAL dengan `params: {}` dan status `{}` → tampil sebagai kartu "OK" palsu di Dashboard.
*Fix:* simpan hanya level yang terisi; jika keduanya kosong tolak (sudah ada validasi).

**5. Z-score mengabaikan nomor lot pada record**
`src/lib/zscore.ts:44–49` + `findActiveLot():114–128` memilih lot berdasarkan **tanggal vs exp**, bukan `r.lot`. Jika ada 2 lot aktif/overlap atau lot lama masih dipakai, mean/SD yang dipakai bisa salah. Selain itu `src/pages/LeveyJennings.tsx:368–412` (mode single) memilih **lot paling sering** sebulan, sedangkan mode multi memakai lot per tanggal → **dua metode berbeda dalam satu halaman**.
*Fix:* lookup `r.lot` lebih dulu, fallback ke tanggal; satukan strategi.

**6. Tanggal default salah zona waktu**
`src/pages/InputQC/StepForm.tsx:38`: `new Date().toISOString().slice(0,10)` = tanggal UTC. Di WIB (UTC+7), input pukul 00:00–06:59 tercatat **kemarin**.
*Fix:* format lokal (`toLocaleDateString('en-CA')` atau komponen tanggal lokal).

**7. Status OOS under-reported**
Hanya 1-2s/1-3s yang dievaluasi & disimpan (`src/lib/westgard.ts:18–24`, `StepForm.tsx:217`). Aturan 2-2s, 4-1s, 10x, R-4s hanya dihitung di chart. Dashboard (`src/pages/Dashboard.tsx:96–108`) dan laporan (`src/pages/MonthlyReport.tsx:124–133`) memakai status tersimpan → kejadian sistematik tidak muncul di statistik bulanan.
*Fix:* jalankan `analyzeMultiLevel` saat simpan atau saat laporan, simpan `overall_status`.

**8. Duplikat & ID rawan tabrakan**
Tidak ada unique constraint `(alat, level, tanggal)`; `StepForm` hanya memberi peringatan lalu tetap menyimpan (`StepForm.tsx:419–435`). ID dibuat `qc-${Date.now()}-${level}` (`:226`) — dua simpan cepat bisa bentrok (PK `text`).
*Fix:* unique index parsial + konfirmasi eksplisit; gunakan `crypto.randomUUID()`.

**9. Kegagalan fetch/config ditelan diam-diam**
`useQCRecords.ts:33–36` return `[]` tanpa toast; `useQCConfig.ts:63–66` fallback ke `DEFAULT_LOT_CONFIG`. Di produksi, gangguan jaringan tampak seperti "tidak ada data" dan evaluasi memakai mean/SD demo tanpa indikator.
*Fix:* bedakan error vs empty, tampilkan retry + banner "mode default".

**10. Korelasi cross-level salah pasangkan titik**
`src/lib/westgard-multi.ts:342–355` membandingkan `zScores[i]` antar level **berdasarkan indeks**, bukan tanggal. Jika jumlah/hari pengukuran level berbeda, pergerakan yang dibandingkan berasal dari hari berbeda → klasifikasi systematic/specific bisa salah. Ambang bias juga tidak konsisten: komentar "8+ dari 10" (`:40`), tetapi kondisi `> 0.8` (`:285`) berarti 8/10 **tidak** terdeteksi.
*Fix:* join berdasarkan `tanggal`; ubah ke `>= 0.8` atau `8/10`.

### 🟡 P2 — Kualitas & ketahanan

| # | Temuan | Lokasi |
|---|---|---|
| 11 | `evaluateR4s()` tidak dipakai siapa pun dan bisa bagi nol (`sd = 0`) | `src/lib/westgard.ts:29–36` |
| 12 | `getRemainingAIScans()` dead code; memakai `supabase.auth.getUser()` padahal auth-nya custom session (selalu 0) | `src/lib/api.ts:150–182` |
| 13 | Log console membocorkan prefix token sesi + seluruh respons AI | `src/lib/api.ts:73, 89–107` |
| 14 | `LeveyJennings.tsx` 1.254 baris monolit; semua halaman diimpor statis + `jspdf/xlsx/html-to-image/recharts` → bundle besar, tanpa code-splitting | `src/App.tsx`, `src/pages/LeveyJennings.tsx` |
| 15 | Ambang "systematic" 50% level terlalu longgar untuk 3 level (2 dari 3 sudah dianggap sistemik) | `src/lib/westgard-multi.ts:369` |
| 16 | 2-2s menandai semua titik kedua-dst dalam run, bukan titik pemicu saja | `src/lib/westgard-multi.ts:120–138` |
| 17 | AI: prompt menyuruh isi `0` untuk level kosong → tersimpan 0 dengan "100% akurasi"; tidak ada validasi rentang nilai | `supabase/functions/extract-qc/gemini.ts`, `src/features/qc/hooks/useAIExtraction.ts:122–127` |
| 18 | AI hanya mendukung CA660/EASYLITE/ONCALL, padahal tombol foto disembunyikan untuk ONCALL/CLEVER (prompt & UI tidak sinkron) | `supabase/functions/extract-qc/parser.ts:4`, `src/pages/InputQC/StepForm.tsx:256` |
| 19 | `useAIExtraction` tak membersihkan `setTimeout` simulasi → setState setelah unmount | `src/features/qc/hooks/useAIExtraction.ts:159–177` |
| 20 | Export/print gagal hanya `console.error`, tanpa notifikasi; `window.open` bisa diblokir | `src/pages/LeveyJennings.tsx:540+`, `src/pages/MonthlyReport.tsx:198+` |
| 21 | Nama "Ka. Instalasi Lab" hardcoded di template cetak | `src/pages/LeveyJennings.tsx:~646` |
| 22 | Stat chip `role="button"` tanpa handler keyboard | `src/pages/Dashboard.tsx:210–212` |
| 23 | `useMemo` dengan ekspresi ternary di dependency array (melanggar exhaustive-deps) | `src/pages/Dashboard.tsx:94` |
| 24 | RLS policy di dokumen deploy `USING (true)` memberi rasa aman palsu | `DEPLOYMENT.md:176–196` |

---

## 8. Testing & Kualitas

- **Test QC: tidak ada yang menguji kode QC.** `src/lib/__tests__/api-mapping.test.ts` hanya meng-assert objek literal lokal (bukan fungsi aplikasi); `src/test/example.test.ts` placeholder.
- Tidak ada test untuk `westgard.ts`, `westgard-multi.ts`, `zscore.ts`, `lot-expiry.ts` — padahal ini inti keselamatan hasil lab.
- `npm run build/lint/test` tidak bisa dijalankan di workspace ini (dependensi belum terpasang).
- Kekuatan: pemisahan `features/qc` (komponen/hooks/lib) bagus, React Query + optimistic update konsisten, UI aksesibel di banyak komponen, edge function punya validasi enum + parser JSON tahan markdown.

---

## 9. Rekomendasi Berurutan

**Sprint 1 (P0, 1–2 hari)**

1. Pindahkan login ke RPC/Edge Function, cabut akses `password_hash`, aktifkan RLS + policy session-token, batasi `sessions`.
2. Perbaiki inisialisasi `LotConfig` (tunggu config selesai load, guard dirty).
3. Perbaiki batas tanggal Desember + tampilkan error fetch.

**Sprint 2 (P1, 3–5 hari)**

4. Simpan EASYLITE hanya level terisi; UUID + unique constraint `(alat, level, tanggal)`.
5. Z-score berdasarkan `r.lot`, satukan strategi lot chart & laporan.
6. Tanggal lokal; simpan status hasil semua rule (bukan hanya 1-2s/1-3s).
7. Perbaiki korelasi cross-level (join tanggal) & ambang bias.

**Sprint 3 (P2, 1 minggu)**

8. Vitest untuk 5 modul lib (target ≥80% branch) — mulai dari kasus batas 2SD/3SD, run 2-2s/4-1s/10x, lot expired, timezone.
9. Pecah `LeveyJennings` + `React.lazy` per route; hapus `evaluateR4s`/`getRemainingAIScans`.
10. Validasi numerik hasil AI, hapus log sensitif, notifikasi error export, template tanda tangan dari config.

---

## 10. Kesimpulan

Modul QC sudah **fungsional dan kaya domain** (Westgard multi-rule, multi-level, expiry, AI OCR), dengan struktur folder yang baik. Namun status "production ready" belum aman: **keamanan data (RLS/kredensial), risiko penimpaan konfigurasi lot, dan bug query Desember** adalah blocker. Setelah 3 P0 dan 7 P1 ditutup serta logika Westgard punya unit test, modul ini layak disebut production-grade.

Opsi next step:

1. Patch langsung P0 #2–#3 (LotConfig sync + batas tanggal Desember).
2. Buat unit test untuk `westgard*`/`zscore`/`lot-expiry` sebagai jaring pengaman refactor.
3. Simpan laporan ini sebagai dokumen acuan di `docs/` dan tautkan dari README.
