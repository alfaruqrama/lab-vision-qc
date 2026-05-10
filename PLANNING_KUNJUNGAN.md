# Planning: Production Readiness — Modul Dashboard Kunjungan

**Tanggal**: 2026-05-10  
**Scope**: Modul `/kunjungan` — read-only dashboard (Omzet, Kunjungan, MCU, Laporan)  
**Tidak termasuk**: Tab Input Harian, fitur baru, refactor arsitektur besar

---

## Status Saat Ini

| Aspek | Status | Catatan |
|---|---|---|
| UI / Visualisasi | ✅ Siap | Chart, tabel, KPI card lengkap |
| Fallback embedded data | ✅ Siap | JSON Jan–Mar tersedia |
| Auth & role guard | ✅ Siap | Protected route, canAccess |
| GAS URL kunjungan | ❌ Hardcoded | Langsung di source, bukan env var |
| GAS URL auth | ⚠️ Exposed | Sudah di-purge dari history, perlu redeploy |
| Embedded data coverage | ⚠️ Stale | Hanya Jan–Mar, belum Apr–Mei |
| Error boundary | ❌ Tidak ada | Crash jika data GAS malformed |
| Type safety payer | ⚠️ `as any` | Silent bug jika key berubah |
| `kumulatif` data | ⚠️ Dead code | Di-fetch tapi tidak dirender |

---

## Fase 1 — Critical Fixes (Blocker Production)

> Harus selesai sebelum go-live. Tanpa ini, data live tidak akan masuk.

### 1.1 Pindahkan GAS URL ke environment variable

**File**: `src/lib/kunjungan-api.ts`

Saat ini URL di-hardcode langsung di source:
```ts
// SEKARANG — berbahaya, URL bocor ke git
const GS_URL = 'https://script.google.com/macros/s/AKfycbw3...'
```

Ubah ke:
```ts
// TARGET
const GS_URL = import.meta.env.VITE_GAS_KUNJUNGAN_URL || '';
```

Lalu tambahkan ke Vercel env vars:
```bash
vercel env add VITE_GAS_KUNJUNGAN_URL production
vercel env add VITE_GAS_KUNJUNGAN_URL preview
```

### 1.2 Redeploy semua GAS scripts

URL yang sudah terlanjur publik di GitHub (meski sudah di-purge dari history, bisa ada di cache/fork):
- `VITE_GAS_AUTH_URL` — endpoint auth
- `VITE_GAS_QC_URL` — endpoint QC
- `VITE_GAS_KUNJUNGAN_URL` — endpoint kunjungan

Langkah di Google Apps Script editor:
1. Buka setiap script
2. Deploy → Manage deployments → New deployment
3. Hapus deployment lama
4. Update URL baru di Vercel env vars

### 1.3 Update embedded JSON data

**File**: `src/lib/kunjungan-data.json`

Data saat ini hanya Jan–Mar. Bulan Apr dan Mei belum ada, sehingga saat GAS offline/error, user melihat data kosong untuk bulan berjalan.

- Export data Apr–Mei dari Google Sheets
- Update `kunjungan-data.json` dengan format yang sama
- Ini fallback data — tidak harus real-time, cukup snapshot terbaru

---

## Fase 2 — Stability & Correctness

> Mencegah crash dan silent bug di production.

### 2.1 Tambah Error Boundary

Saat ini tidak ada error boundary. Jika GAS mengembalikan data malformed (misal field null, struktur berubah), component bisa crash tanpa pesan yang jelas.

Buat `ErrorBoundary` wrapper di sekitar `KunjunganDashboard`:
```tsx
<ErrorBoundary fallback={<ErrorFallback />}>
  <KunjunganDashboard />
</ErrorBoundary>
```

Fallback minimal: pesan error + tombol refresh.

### 2.2 Fix type safety payer (`as any`)

**File**: `src/pages/KunjunganDashboard.tsx` — `OmzetTab`

```ts
// SEKARANG — silent bug jika key berubah
data.reduce((s, r) => s + ((r as any)[p.k] || 0), 0)
```

`PAYERS` sudah pakai `as const`, tapi `OmzetRow` tidak memetakan key-nya secara eksplisit. Solusi: tambahkan index signature ke `OmzetRow` atau gunakan type-safe accessor.

### 2.3 Validasi response GAS sebelum setState

Di `use-kunjungan-data.tsx`, data dari GAS langsung di-set ke state tanpa validasi struktur. Tambahkan guard minimal:

```ts
if (!result.omzet || typeof result.omzet !== 'object') {
  throw new Error('Response GAS tidak valid');
}
```

---

## Fase 3 — UX Polish

> Tidak blocking, tapi penting untuk pengalaman user harian.

### 3.1 Tampilkan data `kumulatif` di UI

Hook `useKunjunganData` sudah fetch `getKumulatif` dari GAS tapi hasilnya tidak dirender sama sekali. Data ini berisi:
- `kumOmzet` — omzet kumulatif YTD
- `kumKunj` — kunjungan kumulatif YTD
- `targetOmzetBulan` / `targetKunjBulan` — target bulan berjalan

Tampilkan sebagai KPI card di bagian atas dashboard (sebelum tab bar), visible di semua tab.

### 3.2 Indikator "data stale" yang lebih jelas

Saat ini jika GAS error, status badge menampilkan `ERROR` tapi data lama masih tampil tanpa keterangan kapan data itu dari. User bisa salah baca data lama sebagai data terkini.

Tambahkan banner kecil: _"Menampilkan data terakhir — [tanggal]. Koneksi ke server gagal."_

### 3.3 Empty state bulan berjalan lebih informatif

Saat bulan berjalan belum ada di embedded data dan GAS offline, user melihat `EmptyState` generik. Ubah pesan agar lebih kontekstual:

> "Data MEI belum tersedia secara offline. Pastikan koneksi aktif untuk memuat data terbaru."

---

## Fase 4 — Maintenance & Ops

> Untuk keberlanjutan jangka panjang.

### 4.1 Jadwal update embedded JSON

Embedded JSON adalah safety net saat GAS tidak bisa dihubungi. Perlu diupdate secara berkala (minimal bulanan) agar fallback data tidak terlalu stale.

Buat konvensi: setiap awal bulan, export data bulan sebelumnya dari Sheets dan update `kunjungan-data.json`.

### 4.2 Dokumentasi GAS endpoint

Saat ini tidak ada dokumentasi tentang struktur response GAS (`getSummary`, `getKumulatif`). Jika GAS script diubah orang lain, frontend bisa break tanpa warning.

Buat `GAS_KUNJUNGAN_SCHEMA.md` yang mendokumentasikan:
- Setiap action yang tersedia
- Struktur response yang diharapkan
- Field yang wajib ada

---

## Urutan Pengerjaan

```
Fase 1 (blocker)     → Fase 2 (stability) → Fase 3 (UX) → Fase 4 (ops)
1.2 Redeploy GAS     → 2.1 Error boundary  → 3.1 Kumulatif UI
1.1 Env var fix      → 2.2 Type safety fix  → 3.2 Stale indicator
1.3 Update JSON      → 2.3 Response guard   → 3.3 Empty state
                                             → 4.1 JSON update SOP
                                             → 4.2 GAS docs
```

**Fase 1 harus dikerjakan manual** (redeploy GAS tidak bisa dilakukan dari kode).  
**Fase 2–3 bisa dikerjakan langsung** setelah Fase 1 selesai.

---

## File yang Akan Diubah

| File | Fase | Perubahan |
|---|---|---|
| `src/lib/kunjungan-api.ts` | 1.1 | Hardcoded URL → `import.meta.env` |
| `src/lib/kunjungan-data.json` | 1.3 | Tambah data Apr–Mei |
| `src/pages/KunjunganDashboard.tsx` | 2.2, 3.1, 3.2, 3.3 | Type fix, kumulatif UI, stale banner |
| `src/hooks/use-kunjungan-data.tsx` | 2.3 | Response validation |
| `src/App.tsx` | 2.1 | Wrap dengan ErrorBoundary |
| `src/components/ErrorBoundary.tsx` | 2.1 | Buat baru |
| `GAS_KUNJUNGAN_SCHEMA.md` | 4.2 | Buat baru |
