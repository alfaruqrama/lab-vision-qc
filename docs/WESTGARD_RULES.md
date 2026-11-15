# Aturan Westgard di Lab Vision QC

Catatan belajar: apa arti tiap aturan, di mana kodenya, dan di mana implementasinya
berbeda satu sama lain. Ditulis 2026-11-15.

---

## 0. Dasar: Z-score

Semua aturan bekerja pada **z-score**, bukan nilai mentah:

```
z = (nilai_terukur − mean_target) / sd_target
```

Target (mean/SD) diambil dari **lot kontrol yang berlaku pada tanggal run itu**, bukan dari
nilai rata-rata data. Implementasinya:

| Fungsi | Lokasi | Kegunaan |
|---|---|---|
| `findActiveLot()` | `src/lib/zscore.ts:143` | Pilih lot: (1) lot yang tercatat di record, (2) lot yang belum kedaluwarsa dengan exp terdekat, (3) lot exp paling akhir |
| `getLotArrayForLevel()` | `src/lib/zscore.ts:107` | Ambil array lot untuk satu alat+level |
| `getParamConfigFromLot()` | `src/lib/zscore.ts:120` | Ambil mean/SD param dari lot; bentuk config beda per alat |
| `getParamTarget()` | `src/lib/zscore.ts:83` | Pembungkus: `(config, alat, level, param, tanggal, lot)` → `{mean, sd}` |
| `computeZScores()` | `src/lib/zscore.ts:22` | Hitung z untuk semua record satu level; melewati record `excluded` |

Bentuk config per alat (`getParamConfigFromLot`):

- `EASYLITE` → `config.EASYLITE[level].params[param]`
- `CA660` / `CLEVER1` / `CLEVER2` → `config[alat].Kontrol[param]`
- `ONCALL1` / `ONCALL2` → `config[alat][level][param]`

**Penting:** `|z| > 3` ditandai OOS. Ini satu-satunya aturan yang dipakai untuk label
per-run di grafik.

---

## 1. Enam aturan Westgard yang dipakai

| # | Aturan | Kondisi | Severity | Arti klinis |
|---|---|---|---|---|
| 1 | **1-3s** | 1 titik \|z\| > 3 | reject | Satu run meleset jauh. Paling kuat, paling sedikit false alarm |
| 2 | **1-2s** | 1 titik 2 < \|z\| ≤ 3 | warning | Di luar batas tapi belum tentu salah. Pemicu pemeriksaan lebih lanjut, bukan penolakan |
| 3 | **2-2s** | 2 titik berturut, \|z\| > 2, **searah** | reject | Systematic error (kalibrasi, reagen, suhu) |
| 4 | **4-1s** | 4 titik berturut, \|z\| > 1, searah | **reject** | Shift sistematik kecil. Dulu `warning` di panel grafik; diseragamkan 2026-11-15 — lihat §2 |
| 5 | **10x** | 10 titik berturut di satu sisi mean | reject | Bias sistematis |
| 6 | **R-4s** | Selisih z dua level di run yang sama > 4 | reject | Random error antar level (salah handling satu level) |

Aturan standar yang **tidak** diimplementasikan: **7T** (7 titik monoton naik/turun) dan
**3-1s**. Trend 7 titik muncul sebagai *pola*, bukan sebagai aturan penolak.

### Logika tiap aturan

**1-3s** — `src/lib/westgard-multi.ts:96-106`
```ts
const oos13s = points.filter((p) => Math.abs(p.zScore) > 3);
```
Satu titik saja sudah cukup.

**1-2s** — `src/lib/westgard-multi.ts:108-118`
```ts
const warn12s = points.filter((p) => Math.abs(p.zScore) > 2 && Math.abs(p.zScore) <= 3);
```
Batas atas `<= 3` membuat 1-3s dan 1-2s tidak tumpang tindih.

**2-2s** — `src/lib/westgard-multi.ts:120-138`
```ts
if (Math.abs(scores[i]) > 2 && Math.abs(scores[i - 1]) > 2 &&
    Math.sign(scores[i]) === Math.sign(scores[i - 1]))
```
Kedua titik harus di sisi yang sama. `+2.1` lalu `−2.1` bukan 2-2s.

**4-1s** — `src/lib/westgard-multi.ts:140-160`
```ts
if (Math.abs(scores[i]) > 1 && Math.abs(scores[i-1]) > 1 && Math.sign(...) === Math.sign(...))
  { streak1s++; if (streak1s >= 4) days41s.push(...); }
```

**10x** — `src/lib/westgard-multi.ts:162-181`
```ts
if (Math.sign(scores[i]) === Math.sign(scores[i-1]) && scores[i] !== 0)
```
Hanya sisi (positif/negatif) yang dihitung, besar z tidak dipedulikan. z = +0.05 sepuluh
kali tetap 10x.

**R-4s** — `src/lib/westgard-multi.ts:187-224`
```ts
if (Math.abs(a.zScore - b.zScore) > 4) affectedDays.push(date);
```
Berbeda dari lima aturan lain: ini **antar level**, dan hanya untuk tanggal yang punya
data di kedua level.

---

## 2. Tiga implementasi yang berbeda

Ini sumber inkonsistensi utama. Tiga file, tiga set aturan, tiga definisi severity.

### A. `src/lib/westgard.ts` — pemeriksaan satu titik

| Fungsi | Baris |
|---|---|
| `evaluateWestgard(value, config)` | `:9` |
| `evaluateR4s(v1, c1, v2, c2)` | `:29` |
| `getStatusLabel(status)` | `:38` |
| `getOverallStatus(statuses)` | `:46` |

Hanya **1-3s** dan **1-2s**. Dipakai oleh:

- `src/lib/zscore.ts:54` — jadi setiap z-score yang ditampilkan grafik memakai definisi ini
- `src/features/qc/components/ParamValueCard.tsx:30` — warning saat operator mengetik nilai
- `src/lib/mock-data.ts` — data demo

`evaluateR4s` **tidak dipanggil siapa pun** di kode aplikasi.

### B. `src/lib/westgard-engine.ts` — evaluasi per batch input

| Bagian | Baris |
|---|---|
| `evaluateSeries(points, {levelsCount})` | `:34` |
| 1-3s | `:58-67` |
| 1-2s | `:69-80` |
| 2-2s | `:82-92` |
| 4-1s | `:94-105` |
| 10x | `:107-129` |
| "R-4s" | `:141-152` |
| "2-2s" cross-level | `:154-163` |

Enam aturan, dan **mengelompokkan per lot lebih dulu** (`:51` `lots.forEach(...)`), jadi
urutan aturan **di-reset setiap ganti lot**.

Dipakai hanya di `src/pages/InputQC/StepForm.tsx:336`, dan hasilnya menghitung
`overall_status` yang **tidak pernah tersimpan** (lihat §4).

### C. `src/lib/westgard-multi.ts` — panel analisis di halaman L-J

| Bagian | Baris |
|---|---|
| `analyzeMultiLevel(levelPoints)` | `:48` |
| `scanRules()` | `:90` |
| `detectR4s()` | `:187` |
| `detectPatterns()` | `:227` |
| `analyzeCrossLevel()` | `:316` |
| `generateRecommendation()` | `:414` |

Enam aturan, dihitung **lintas seluruh bulan** (tidak reset per lot). Dipakai di
`src/pages/LeveyJennings.tsx:198`, dirender `src/features/qc/components/lj/LJAnalysis.tsx`.

### Perbandingan severity

| Aturan | `westgard.ts` | `westgard-engine.ts` | `westgard-multi.ts` |
|---|---|---|---|
| 1-3s | oos | reject | oos |
| 1-2s | warning | warning | warning |
| 2-2s | — | reject | oos |
| **4-1s** | — | reject | reject (diperbaiki 2026-11-15) |
| 10x | — | reject | oos |
| R-4s | tak dipakai | reject | oos |

**Bentrok 4-1s — sudah diperbaiki 2026-11-15.** Menurut Westgard, 4-1s adalah aturan
**penolakan**. `westgard-engine.ts` sudah benar sejak awal; `westgard-multi.ts:156`
menyimpang dengan `warning`. Sekarang keduanya memakai `ruleStatus('4-1s')` dari
`src/lib/westgard-rules.ts`, sehingga bernilai `oos` / reject.

Dampaknya terukur pada data 2026: **378 titik** memicu 4-1s di 10 grup. **347 di antaranya**
tidak tercakup 1-3s maupun 2-2s — jadi titik-titik itu kini tampil merah, bukan kuning.
Panel grafik dan kartu Resume ikut berubah karena keduanya membaca severity yang sama.

Catatan bias: banyak dari grup itu memang bias nyata (EASYLITE NORMAL K: mean z = −1.03,
46% run memicu 4-1s). Jadi kenaikan ini menyingkap masalah yang sebelumnya tersembunyi,
bukan menciptakan masalah baru.

### Dua rumusan R-4s di `westgard-engine.ts` vs `westgard-multi.ts`

Bukan bug penamaan — keduanya rumusan R-4s yang **sama-sama sah** di literatur, tapi
aplikasi memakai keduanya sekaligus sehingga hasilnya bisa berbeda:

| Sumber | Rumusan | Dipakai di |
|---|---|---|
| Westgard QC | 1 titik > +2s **dan** titik lain < −2s dalam run yang sama | `westgard-engine.ts:141-152` |
| Carroll 2003 / Tech Networks | Selisih nilai terbesar & terkecil dalam satu run > 4s | `westgard-multi.ts:187-224` |

Perbedaannya nyata pada data: run dengan z = +5.0 dan −1.1 punya selisih 6.1 (> 4s) tapi
tidak memenuhi "+2 dan −2". Pada data 2026, `westgard-multi` memicu R-4s di **3 run**,
`westgard-engine` di **1 run**, dan **3 run itu tidak beririsan** dengan cara yang sama —
keduanya melaporkan R-4s dengan ambang berbeda.

Blok `:154-163` di `westgard-engine.ts` dilabeli `2-2s` dengan `level: 'cross'` — dua level
di sisi yang sama melewati ±2SD. Ini aplikasi 2-2s lintas material, bukan R-4s, dan
penamaannya sudah tepat.

---

## 3. Pola dan Cross-Level — beda fungsi dari Aturan

Ketiganya muncul di kartu "Analisis Westgard Multi-Level", tapi menjawab pertanyaan berbeda.

| Bagian | Menjawab | Sifat | Kode |
|---|---|---|---|
| **Aturan** | Boleh laporan hasil pasien keluar? | Keras, berbasis aturan tetap | `scanRules` `:90`, `detectR4s` `:187` |
| **Pola** | Kenapa ini terjadi? | Lunak, statistik deskriptif | `detectPatterns` `:227` |
| **Cross-level** | Global satu instrumen, atau satu level saja? | Diagnostik | `analyzeCrossLevel` `:316` |

### Pola (threshold di `:37-40`)

```ts
const SHIFT_THRESHOLD = 6;  // titik searah berturut → shift
const TREND_THRESHOLD = 7;  // titik monoton → trend
const BIAS_TOTAL = 10;      // minimal titik untuk deteksi bias
const BIAS_RATIO = 0.8;     // 8 dari 10 di satu sisi → bias
```

| Pola | Kondisi | Baris | Tafsir |
|---|---|---|---|
| `shift` | ≥6 titik berturut di satu sisi mean | `:232-253` | Lompatan mendadak (ganti reagen, kalibrasi baru) |
| `trend_up` / `trend_down` | ≥7 titik monoton | `:254-280` | Degradasi bertahap (reagen menua, lampu melemah) |
| `bias_high` / `bias_low` | ≥10 titik, >80% di satu sisi | `:281-295` | Pergeseran tetap yang tidak terdeteksi sebagai streak |
| `random_error` | ada oos/warning tanpa shift/trend | `:296-307` | Kesalahan sporadis, bukan sistematik |

Pola **tidak pernah menolak hasil**. Fungsinya menunjukkan arah investigasi.

### Cross-level — `:316-411`

Syarat: minimal 5 titik per level (`:331-338`), kalau kurang hasilnya
`insufficient_data`.

Langkahnya:

1. Hitung `avgZ`, jumlah oos, jumlah warning per level (`:320-329`).
2. Hitung **korelasi arah** — untuk setiap pasang level, pada tanggal yang sama, apakah
   z naik/turun bersamaan (`:340-372`).
3. Klasifikasi (`:382-408`):

| Tipe | Kondisi | Arti |
|---|---|---|
| `systematic` | ≥50% level bermasalah **dan** korelasi > 0.5 | Semua level bergerak bersama → masalah instrumen (reagen, kalibrasi, suhu) |
| `specific` | hanya 1 level bermasalah, total oos+warning > 3 | Satu level saja → lot kontrol rusak, kontaminasi, preparasi |
| `stable` | selain itu | Semua terkendali |
| `insufficient_data` | <5 titik di satu level | Belum bisa dinilai |

Korelasi pada `:361-362` memakai arah **perubahan antar tanggal berurutan**, bukan arah
dari mean. Jadi dua level bisa berkorelasi tinggi walau keduanya bias ke bawah.

### Rekomendasi — `:414+`

Menggabungkan ketiganya: OOS + `systematic` → "hentikan pelaporan hasil pasien".

---

## 4. Inkonsistensi yang ditemukan (audit 2026-11-15)

Belum diperbaiki. Masing-masing mengubah verdict klinis.

### 4.1 Status per parameter tidak pernah dihitung saat disimpan

`src/pages/InputQC/StepForm.tsx:271` menulis `statuses[p] = 'ok'` untuk **setiap** nilai:

```ts
if (!isNaN(num)) {
  parsedParams[p] = num;
  statuses[p] = 'ok';       // ← selalu ok, z-score belum dihitung
}
```

`overall_status` dihitung di `:336-341` lewat `evaluateSeries`, tapi
`src/features/qc/hooks/useQCRecords.ts:73-85` tidak menyertakannya di `insert`, dan kolom
`overall_status` memang tidak ada di tabel `qc_records`.

Akibatnya Dashboard (`src/pages/Dashboard.tsx:91,101`), PortalHome
(`src/pages/PortalHome.tsx:37`), dan Laporan Bulanan (`src/pages/MonthlyReport.tsx:135`)
membaca status `'ok'` yang tidak pernah divalidasi. Grafik L-J tidak terpengaruh karena
menghitung ulang lewat `computeZScores`.

Pengukuran terhadap database 2026: **14 nilai** tersimpan `ok` padahal seharusnya
`warning` — 13 di CLEVER1/CLEVER2 GDA (z antara −2.10 dan −3.00) dan 1 di EASYLITE
(2026-03-31, Cl z = 2.08). Semuanya ditulis `scripts/import_clever_2026.py:122`
sebagai `{"GDA": "ok"}`.

### 4.2 Severity 4-1s berbeda — SUDAH DIPERBAIKI

`westgard-engine.ts:100` reject (sesuai standar), `westgard-multi.ts:156` warning
(menyimpang). Kini keduanya lewat `src/lib/westgard-rules.ts`. Dampak: 347 titik
berubah dari kuning ke merah pada data 2026.

### 4.3 Dua rumusan R-4s berbeda ambang

Lihat §2. `westgard-engine.ts:141-152` memakai "+2 dan −2"; `westgard-multi.ts:187-224`
memakai "selisih > 4s". Pada data 2026 keduanya memberi hasil berbeda (3 run vs 1 run).
Perlu dipilih satu rumusan sebagai standar lab.

### 4.4 Batas lot dihitung berbeda

`evaluateSeries` reset urutan per lot (`westgard-engine.ts:51`); `analyzeMultiLevel`
menelusuri sebulan penuh lintas lot.

Dari data 2026: **9 grup** memakai lebih dari satu lot dalam sebulan, **7 di antaranya**
menghasilkan jumlah 10x berbeda.

| Grup | 10x lintas-lot | 10x per-lot |
|---|---|---|
| CA660 INR | 105 | 101 |
| EASYLITE HIGH K | 58 | 49 |
| EASYLITE HIGH Cl | 54 | 44 |
| EASYLITE NORMAL Cl | 32 | 23 |
| CLEVER2 GDA | 45 | 30 |
| CA660 APTT | 66 | 62 |
| EASYLITE NORMAL K | 45 | 36 |

Tambahan: **4 grup lot** punya <3 run sebulan, sehingga pengelompokan per lot secara
struktural tidak bisa memicu aturan berurutan sama sekali (ONCALL1 2026-06 CTRL0 = 1 run;
ONCALL2 2026-07 CTRL2 = 1 run; EASYLITE 2026-04 NORMAL dan HIGH = 2 run).

Secara Westgard, streak **seharusnya** di-reset saat lot kontrol berganti — jadi
`analyzeMultiLevel` yang menyimpang.

### 4.5 Konvensi SD terbelah dua

| File | Pembagi | Dipakai di |
|---|---|---|
| `src/lib/stats-util.ts:15` | `n` (populasi) | `src/pages/LotConfig.tsx:59` — "hitung dari data lab" |
| `src/features/qc/lib/lj-print.ts:131` | `n − 1` (sampel) | Print L-J |
| `src/pages/LeveyJennings.tsx:137` | `n − 1` (sampel) | Baca "SD Terukur" |
| `src/pages/MonthlyReport.tsx` | `n − 1` (sampel) | Laporan bulanan |

Satu set data menghasilkan dua angka SD berbeda. Target yang dihitung lewat LotConfig
tidak akan cocok dengan SD terukur di halaman L-J.

### 4.6 Duplikasi definisi

| Yang diduplikasi | Lokasi |
|---|---|
| Daftar instrumen | `src/lib/types.ts::INSTRUMENTS`, `src/lib/lot-expiry.ts`, `InstrumentSelector.tsx::ALL_INSTRUMENTS` |
| Level per instrumen | `src/pages/LeveyJennings.tsx:38-42` dan `src/features/qc/lib/lj-report-pages.ts:27` (identik) |
| Label level | `LogSheetView.tsx:10` (`Kontrol`→"Control"), `StepLevel.tsx:23` ("CTRL 0"), label mentah `NORMAL`/`HIGH` di L-J dan print |
| Pencarian target | `src/pages/MonthlyReport.tsx:102-123` menulis ulang if/else per alat, melewati `getParamTarget` |

### 4.7 Bahaya config demo masih ada

`src/features/qc/hooks/useQCConfig.ts:38-43` — `normalizeLotConfig` menyuntik
`DEFAULT_LOT_CONFIG` ke setiap instrumen yang kosong:

```ts
CLEVER1: (config as any).CLEVER1 || DEFAULT_LOT_CONFIG.CLEVER1,
```

`DEFAULT_LOT_CONFIG` memuat lot demo (`CC1-2024-001` mean 100 / SD 5). Inilah penyebab
insiden OOS palsu: lot demo muncul di halaman Konfigurasi Lot, ikut tersimpan, lalu dipilih
otomatis oleh form input. `src/lib/lot-target.ts` sudah dibuat untuk mendeteksi lot
bertarget nol, tapi baris `:38-43` sendiri tidak diubah.

### 4.8 Cabang mati di `ParamValueCard`

`src/features/qc/components/ParamValueCard.tsx:80`:
```tsx
{hasValue && status === 'warning' && violatedRules.length === 0 && (
```
`violatedRules` diisi dari `evaluateWestgard(...).rules`, dan `evaluateWestgard` menambahkan
`'1-2s'` tepat ketika `status === 'warning'`. Jadi `violatedRules.length === 0` tidak pernah
benar bersamaan dengan `status === 'warning'` — blok ini tidak pernah tampil.

---

## 5. Ringkasan alur data

```
Input QC (StepForm)
  └─ parseParams: statuses[p] = 'ok'  ← tidak divalidasi
  └─ evaluateSeries (westgard-engine) → overall_status → DIBUANG (tidak tersimpan)
                                        ↓
                               qc_records.status = 'ok' selalu
                                        ↓
Dashboard / PortalHome / MonthlyReport  ← membaca status mentah ini
                                        ↓
                                Laporan bisa tampak 100% in-control

Grafik L-J (LeveyJennings)
  └─ computeZScores (zscore.ts) → evaluateWestgard (1-3s/1-2s)
  └─ analyzeMultiLevel (westgard-multi) → panel aturan/pola/cross-level
                                        ↓
                               Status run di grafik selalu benar
                               (tidak pernah membaca qc_records.status)
```

Dua jalur ini tidak pernah bertemu. Grafik menghitung ulang, laporan mempercayai data
tersimpan. Selama `parseParams` menulis `'ok'`, keduanya akan terus berbeda.

---

## 6. Kalau ingin membandingkan dengan standar Westgard

Aturan asli Westgard (1981) dan varian yang lazim dipakai:

- **1-2s**: peringatan saja, **bukan** penolakan. Sudah benar di sini.
- **1-3s**: penolakan. Benar.
- **2-2s**: penolakan. Benar.
- **R-4s**: penolakan; dalam **satu run**, satu titik > +2SD dan titik lain < −2SD
  (Westgard QC). Varian lain merumuskannya sebagai selisih > 4SD. Keduanya ada di
  aplikasi ini — perlu dipilih satu.
- **4-1s**: **penolakan**. Kedua engine kini konsisten (lihat §2). Catatan: pada multirule
  klasik, 4-1s baru diperiksa **setelah** ada pelanggaran 1-2s; pada versi "modern" tidak
  perlu didahului. Aplikasi ini memakai versi modern.
- **10x**: penolakan. Benar.
- **7T**: tren 7 titik, biasanya peringatan. Tidak ada di sini.

Referensi:

- Westgard JO, Barry PL, Hunt MR, Groth T. "A multi-rule Shewhart chart for quality control
  in clinical chemistry." *Clin Chem.* 1981;27(3):493-501.
- Westgard QC, "Westgard Rules — Multirules by James Westgard": <https://www.westgard.com/westgard-rules>
- Carroll TA, Pinnick HA. "Probability and the Westgard Rules." *Ann Clin Lab Sci.* 2003;33(1):113.
