# Handover — Scan Berkas Transfusi → Google Drive

> Status: **kode OAuth siap, menunggu mint token + deploy.**
> Terakhir dikerjakan: 27 September 2026
> Keputusan: **jalan A** — OAuth akun Gmail pribadi. Workspace RS tidak dipakai.

---

## TL;DR

Workspace Google ≠ Gmail biasa. Workspace = paket kantor berbayar (Shared Drive,
admin console, domain-wide delegation). Gmail `@gmail.com` = My Drive 15 GB,
tanpa Shared Drive. Keputusan: **tetap Drive, akun Gmail pribadi.**

Service account **tidak bisa** menulis ke My Drive Gmail (kuota 0, HTTP 403).
Kode sudah diganti ke **OAuth refresh token** milik Gmail pemilik folder.

**Belum deploy.** Upload end-to-end **masih belum pernah sukses.** Jangan anggap
modul jalan sebelum PDF muncul di Drive.

Langkah kamu (sekali, di laptop):

1. Cloud Console → OAuth consent screen → User type **External** → **Publish app**
   (In production). Jangan tinggal Testing — token Testing mati 7 hari.
2. Credentials → Create → OAuth client ID → tipe **Desktop app** → unduh JSON.
3. `bash scripts/mint-gdrive-oauth.sh ~/Downloads/<client>.json`
   Login Gmail pemilik folder. Kalau "unverified app": Advanced → Go to app.
4. `bash scripts/setup-drive-secrets.sh ~/.config/lab-vision-qc/gdrive-oauth.env <FOLDER_ID> <SHEET_ID>`
   SHEET_ID opsional (untuk auto-isi Google Sheet). Hapus argumen ke-3 bila belum perlu.
5. Scan uji dari HP. PDF harus ada di `Berkas Transfusi / YYYY / MM`,
   dan satu baris baru muncul di tab "Arsip Transfusi" pada Google Sheet.

---

## Apa yang sudah selesai

| Item | Status |
|---|---|
Kode modul + ganti auth ke OAuth Gmail | ✅ di working tree, **belum deploy** |
`npx tsc --noEmit` / build / test (sebelum ganti OAuth) | ✅ dulu bersih; fungsi Deno tidak ikut `tsc` app |
Deploy Edge Function versi **OAuth** | ❌ belum |
Mint refresh token | ❌ belum |
Berkas benar-benar tersimpan di Drive | ❌ **belum pernah berhasil sekali pun** |

Baris terakhir itu penting: sejak awal sampai sekarang, **belum ada satu upload pun
yang sukses end-to-end.** Jangan anggap modul ini jalan sebelum PDF benar-benar
muncul di folder Drive.

---

## Blocker: kenapa gagal

### Pesan asli dari Google

```json
{
  "error": {
    "code": 403,
    "message": "Service Accounts do not have storage quota. Leverage shared drives
                (https://developers.google.com/workspace/drive/api/guides/about-shareddrives),
                or use OAuth delegation (http://support.google.com/a/answer/7281227) instead."
  }
}
```

### Penjelasannya

Saat service account mengunggah file, **file itu menjadi miliknya** — bukan milik
pemilik folder. Service account tidak punya jatah penyimpanan sama sekali.

Membagikan folder ke service account memberi dia **izin menulis**, tapi tidak
menyelesaikan masalah **kepemilikan**. Dua hal berbeda.

> ⚠️ **Koreksi:** panduan `gdrive-setup.html` menyebut "share folder ke service
> account" sebagai solusinya. Itu benar untuk izin, **tapi tidak menyelesaikan
> kuota.** Handover ini menggantikan bagian itu.

### Kenapa akun Gmail pribadi mempersulit

Kedua saran Google sama-sama butuh Google Workspace berbayar:

| Saran Google | Kenapa tidak bisa |
|---|---|
**Shared Drive** | Tidak tersedia di akun `@gmail.com` pribadi. Butuh Workspace |
**OAuth delegation** | Yang dimaksud adalah *domain-wide delegation* — butuh admin console Workspace |

---

## Pilihan Jalan

### A. OAuth dengan refresh token (paling mungkin berhasil di Gmail pribadi)

Ganti service account dengan **OAuth Client ID** + **refresh token** milik akun Gmail
pemilik folder. File jadi milik akun itu, kuota Gmail yang dipakai.

- ✅ Bisa di akun Gmail pribadi
- ⚠️ Setup: OAuth Client ID (Desktop atau Web) → consent sekali → simpan refresh token
  sebagai secret Supabase
- ✅ **Q1 terjawab — tidak mati tiap 7 hari IF published to In production.**
  Lihat [Jawaban Q1](#jawaban-q1--refresh-token-7-hari). Testing = 7 hari. Production
  (unverified OK) = tidak ada timer 7 hari. Token lama yang di-mint saat Testing
  **tidak** otomatis memanjang — harus consent ulang setelah publish.
- ✅ **Dipilih 27 Sep 2026.** Kode sudah diganti. Belum di-deploy, belum di-mint.
- ⚠️ Scope tetap **`drive`** (restricted), bukan `drive.file`. Folder "Berkas
  Transfusi" sudah ada di Drive — `drive.file` tidak melihat folder yang tidak
  dibuat/dibuka lewat app ini, jadi `files.get` folder ID 404. Personal-use
  (<100 user dikenal) **tidak wajib verifikasi**. Consent pertama: klik Advanced
  → Go to {app}.
- ⚠️ App unverified: warning + cap 100 user. 1 akun Gmail arsip RS = tidak relevan.
- ⚠️ Token tetap bisa mati karena: revoke, 6 bulan idle, password reset, >50
  refresh token per user/client. Kode handle `invalid_grant` dengan pesan jelas.

### B. Google Workspace rumah sakit

Kalau RS Petrokimia Gresik punya Google Workspace, **ini jalan paling bersih**:

1. Buat **Shared Drive** di akun Workspace
2. Undang service account sebagai **Content Manager**
3. Isi file jadi milik Shared Drive — tidak ada masalah kuota

Perlu dicek: apakah RS punya Workspace, dan apakah Anda punya akses untuk membuat
Shared Drive. Kalau ya, perubahan kode yang dibutuhkan **minimal** — tinggal ganti
`GDRIVE_TRANSFUSI_FOLDER_ID` ke ID Shared Drive, dan sepertinya semua parameter
`supportsAllDrives=true` di kode sudah siap untuk ini.

### C. Supabase Storage (paling sederhana, tapi keluar dari Drive)

Simpan PDF di Supabase Storage, bukan Drive.

- ✅ Tidak ada urusan service account, kuota, OAuth, atau verifikasi Google
- ✅ Semua di infrastruktur yang sudah dipakai
- ✅ Preview & unduh tetap bisa (`createSignedUrl`)
- ❌ Berkas **tidak** masuk ke Drive — kalau arsip RS sudah mengumpul di Drive,
  ini memecah lokasi penyimpanan
- ❌ Perlu migrasi data & sesuaikan komponen preview

**Catatan:** kalau tujuan aslinya "berkas aman tersimpan dan bisa dicari lagi" —
bukan "harus ada di Drive" — ini jauh lebih sedikit kerja dan lebih sedikit
titik gagal. Perlu dikonfirmasi ke pemilik kebutuhan.

---

## Kondisi deployment saat ini

### Yang sudah dilakukan

- ✅ `supabase link --project-ref tpyocjcjoucyymsptbbw`
- ✅ Edge Function versi **service account** pernah ter-deploy (masih yang live sampai OAuth di-deploy)
- ✅ Kode fungsi di working tree sudah OAuth user, bukan JWT service account
- ✅ Alur folder pakai ID, bukan cari nama (lihat [Bug #13](#bug-yang-diperbaiki))

### Yang BELUM diverifikasi

- ⬜ OAuth consent screen **In production** (bukan Testing)
- ⬜ OAuth client Desktop app + JSON terunduh
- ⬜ `mint-gdrive-oauth.sh` jalan, file `~/.config/lab-vision-qc/gdrive-oauth.env` ada
- ⬜ `setup-drive-secrets.sh` pasang 4 secret + deploy fungsi **baru**
- ⬜ Migration 004 & 009 sudah di SQL Editor (PRODUCTION_STATUS.md hanya 001 & 002)
- ⬜ Satu PDF uji benar-benar muncul di Drive

Cek cepat:

```bash
cd ~/ramscl_workspace/lab-vision-qc
supabase secrets list
```

```sql
-- di Supabase Dashboard → SQL Editor
select column_name from information_schema.columns
where table_name = 'transfusion_documents';
-- harus muncul: blood_product, bag_number, blood_type_rh, origin, dst.
```

---

## Secret yang dibutuhkan

| Nama | Isi | Catatan |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | dari JSON Desktop client | |
| `GOOGLE_OAUTH_CLIENT_SECRET` | dari JSON Desktop client | |
| `GOOGLE_OAUTH_REFRESH_TOKEN` | hasil `mint-gdrive-oauth.sh` | Jangan mint saat Testing. Harus punya scope `drive` **dan** `spreadsheets` |
| `GDRIVE_TRANSFUSI_FOLDER_ID` | ID folder Drive | Hanya bagian setelah `/folders/`, tanpa `?usp=...` |
| `GTRANSFUSI_SHEET_ID` | ID spreadsheet arsip | Opsional. Hanya bagian di antara `/spreadsheets/d/` dan `/edit`. Bila kosong, auto-isi Sheet dilewati |

`GOOGLE_SERVICE_ACCOUNT_KEY` **tidak dipakai lagi**. Boleh dihapus dari dashboard
Supabase setelah fungsi OAuth ter-deploy.

### Scope OAuth

Refresh token butuh akses ke Drive **dan** Sheets. Dalam praktiknya scope
`https://www.googleapis.com/auth/drive` **sudah cukup untuk keduanya** — scope
`drive` adalah scope luas yang juga mengizinkan `spreadsheets.values.append`.
Scope `https://www.googleapis.com/auth/spreadsheets` ditambahkan di
`mint-gdrive-oauth.sh` sebagai eksplisit/pertahanan, tetapi **token lama dengan
`drive` saja tetap bisa mengisi Sheet**.

Yang WAJIB adalah **mengaktifkan Google Sheets API** di project Google Cloud.
Kalau belum, Sheets API menjawab `403 SERVICE_DISABLED`:

1. Aktifkan Google Sheets API di project yang sama:
   `https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=<PROJECT_ID>`
   Tunggu 1–2 menit.
2. Uji: `Transfusi → Scan Baru`. Baris harus muncul di tab "Arsip Transfusi".

**Kalau diperlukan mint ulang** (mis. token dicabut): Google kini menyembunyikan
tombol unduh JSON client, jadi pakai mode `--from-env` yang membaca
`client_id`/`client_secret` dari file env yang ada:

```
bash scripts/mint-gdrive-oauth.sh --from-env ~/.config/lab-vision-qc/gdrive-oauth.env
```

File env lama otomatis dicadangkan ke `gdrive-oauth.env.bak`.
(Mode lama tetap didukung: `bash scripts/mint-gdrive-oauth.sh <client.json>`.)

> **Mint ulang TIDAK selalu perlu.** Cek dulu apakah masalahnya hanya Sheets API
> belum aktif atau `GTRANSFUSI_SHEET_ID` belum di-set — dua hal itu tidak butuh
> token baru.

### Auto-isi Google Sheet

Setiap unggahan menambah **satu baris** ke tab **"Arsip Transfusi"**. Bila tab
masih kosong, header otomatis ditulis. Kolomnya (16):

1. Waktu Input
2. Nama Pasien
3. No. Rekam Medis
4. Tanggal Permintaan
5. Produk Darah
6. Jumlah Kantong
7. Golongan Darah / Rh
8. Nomor Kantong
9. Asal Kantong
10. Inform Concern
11. Surat Permintaan Darah
12. Form Reaksi Transfusi
13. Catatan
14. Petugas Input
15. Status PDF
16. Link Drive

Sifatnya **best-effort**: bila penulisan Sheet gagal, PDF **tetap** dianggap
sukses (Drive + database adalah sumber utama). Kegagalan dilaporkan sebagai
`sheet_warning` di respons API, lalu ditampilkan sebagai toast peringatan kuning
di klien — bukan error. Ini mencegah operator mengunggah ulang dan membuat PDF
duplikat.

**Syarat penting:** spreadsheet harus dimiliki atau di-share (sebagai Editor) ke
**akun Gmail yang sama** dengan pemilik folder Drive, karena token itulah yang
menulis. Kalau beda akun, append akan gagal 403/404.

---

## File yang berubah

15 file diubah, 2 file baru. **Belum ada yang di-commit** — semua masih di working tree.

### Modul Transfusi

| File | Perubahan |
|---|---|
| `supabase/migrations/009_transfusi_scan_fields.sql` | **baru** — 8 kolom bank darah + 2 index |
| `src/lib/transfusi-types.ts` | 8 field, konstanta produk darah/goldar, batas ukuran payload |
| `src/features/transfusi/hooks/usePdfBuilder.ts` | kompresi gambar otomatis + cover page + pesan error HEIC |
| `src/features/transfusi/components/TransfusiForm.tsx` | 10 field, validasi, checklist berkas, error ke pengguna |
| `src/features/transfusi/hooks/useTransfusiRecords.ts` | payload lengkap, pesan error spesifik |
| `src/lib/transfusi-api.ts` | baca respons sebagai teks dulu; penjaga ukuran; berhenti tulis data pasien ke localStorage |
| `supabase/functions/upload-transfusi/index.ts` | **perbaikan utama** — lihat tabel bug di bawah |
| `src/features/transfusi/components/TransfusiCard.tsx` | tampilkan produk darah, goldar, nomor kantong |
| `src/features/transfusi/components/TransfusiSearch.tsx` | filter produk darah |
| `src/pages/TransfusiDashboard.tsx` | filter produk, `LucideIcon` ganti `any` |
| `src/pages/TransfusiDetail.tsx` | tampilkan data kantong & checklist berkas |
| `src/hooks/use-transfusi-store.tsx` | signature metadata lengkap |
| `src/components/layout/TransfusiLayout.tsx` | perbaiki badge nav |

### Di luar modul Transfusi

| File | Perubahan |
|---|---|
| `src/components/kunjungan/DevLaporanPanel.tsx` | **perbaiki pelanggaran Rules of Hooks** + hapus `catch (e: any)` |
| `.gitignore` | abaikan `.claude/worktrees/` |
| `eslint.config.js` | worktree tidak ikut di-lint |

### Berkas pendukung

| File | Isi |
|---|---|
| `src/features/transfusi/__tests__/pdfGenerator.test.ts` | **baru** — 13 test (kompresi & format tanggal) |
| `scripts/setup-drive-secrets.sh` | pasang secret dengan validasi JSON sebelum menulis |
| `scripts/diagnose-drive-upload.sh` | diagnosis upload, menerjemahkan pesan error jadi penyebab |
| `.scratch/gdrive-setup.html` | panduan setup Drive (⚠️ lihat koreksi di atas) |

---

## Bug yang diperbaiki

Dicatat supaya jelas kenapa kode berubah — dan supaya tidak terulang.

| # | Bug | Akibat |
|---|---|---|
| 1 | Foto tidak dikompres sama sekali | PDF 5 halaman bisa 75 MB |
| 2 | **`Content-Transfer-Encoding: base64` pada part biner** | Google menjawab `Malformed multipart body` — ini yang menyebabkan error parse JSON misterius berhari-hari |
| 3 | `Content-Length` di-set manual pada body `Uint8Array` | Berisiko memotong body |
| 4 | `requestDate` dari form diabaikan backend | Tanggal permintaan selalu = tanggal upload |
| 5 | Badge nav pakai `d.upload_date` yang tidak ada | Hitungan "hari ini" selalu 0 |
| 6 | Tidak ada validasi identitas pasien | Berkas bisa masuk Drive tanpa nama/RM |
| 7 | Data pasien ditulis ke `localStorage` walau terhubung Supabase | Data pasien tersimpan di browser tanpa perlu |
| 8 | `res.json()` tanpa penjagaan di klien | Error asli server tertutup error parse |
| 9 | Tidak ada penjagaan `.json()` di Edge Function | Idem, di sisi server |
| 10 | HEIC gagal senyap | Tombol berputar tanpa pesan apa pun |
| 11 | `DevLaporanPanel` — hook dipanggil setelah `return null` | React bisa melempar "Rendered more hooks than during the previous render" |
| 12 | Scope `drive.file` | Service account tidak bisa melihat folder yang di-share dari luar |
| 13 | Folder dicari berdasarkan nama | Bikin folder baru di Drive service account → error kuota |

Bug **#2** adalah biang keladi error `Unexpected token 'M', "Malformed "...`
yang menyesatkan. `"Malformed "` ternyata 10 karakter pertama dari
`"Malformed multipart body."` — pesan teks dari Google, bukan dari kode kita.

---

## Jawaban Q1 — refresh token 7 hari

Sumber resmi (bukan forum):

> "A Google Cloud Platform project with an OAuth consent screen configured for
> an external user type and a publishing status of **Testing** is issued a
> refresh token expiring in 7 days, unless the only OAuth scopes requested are
> a subset of name, email address, and user profile (`userinfo.email`,
> `userinfo.profile`, `openid`)."
>
> — [Using OAuth 2.0 to Access Google APIs → Refresh token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)

Drive scopes **bukan** identity scopes, jadi pengecualian itu tidak berlaku.

| Publishing status | User type | Refresh token |
|---|---|---|
| **Testing** | External | **Mati 7 hari.** Tidak layak arsip RS. |
| **In production** (unverified OK) | External | **Tidak ada timer 7 hari.** Mati hanya jika revoke / 6 bulan idle / event keamanan / limit 50 token. |
| Internal | Workspace org | Tidak kena 7 hari; verifikasi tidak wajib. Tidak tersedia di Gmail pribadi. |

Publish **tidak sama** dengan verified:

| Sumbu | Apa | Efek pada token | Butuh review Google? |
|---|---|---|---|
| Publishing status Testing → In production | Toggle di consent screen | Menghapus timer 7 hari | Tidak — instant |
| Verification unverified → verified | Review Google | Menghapus warning + cap 100 user | Ya, bisa berminggu-minggu. Restricted scope (`drive`) bisa minta CASA assessment berbayar |

App boleh **In production + unverified**. Combo itu valid. Token longevity
mengikuti publishing status, bukan verification. Token yang di-mint saat
Testing **tetap** 7 hari meski status sudah diubah — harus consent ulang
setelah publish. Cek response token: ada `refresh_token_expires_in: 604800`
= masih 7 hari; field itu **absen** = tidak ada timer.

Pengecualian verifikasi resmi: [personal use](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
— "you are the only user … or … a few users, all of whom are known personally
to you." Arsip internal RS dengan 1 akun Drive masuk sini. User klik lewat
warning "unverified app" sekali saat consent.

Klasifikasi scope Drive ([docs](https://developers.google.com/drive/api/guides/api-specific-auth)):

| Scope | Kelas | Untuk kita |
|---|---|---|
| `drive.file` | Non-sensitive | **Tidak dipakai.** Folder tujuan sudah ada; `drive.file` tidak melihatnya. |
| `drive` | Restricted | **Dipakai.** Personal-use exception = verifikasi tidak wajib. |
| `drive.readonly` | Restricted | Tidak perlu |

Jalan A **dipilih.** Kode OAuth sudah di working tree. Sisa: mint + deploy.

---

## Urutan sekarang

1. ~~Jawab pertanyaan refresh token.~~ Selesai.
2. ~~Pilih jalan.~~ A — Gmail pribadi, tetap Drive.
3. **Mint + pasang secret + deploy** (lihat TL;DR). Jangan mint saat Testing.
4. Verifikasi migration 004 & 009 di SQL Editor.
5. Scan uji. PDF harus muncul di Drive sebelum angkat WIP.
6. Setelah upload sukses:
   - Bersihkan `PRODUCTION_STATUS.md` (password 29 user plaintext).
   - Angkat bendera WIP di `TransfusiLayout.tsx` dan `PortalHome.tsx`.

---

## Catatan tambahan

- **`PRODUCTION_STATUS.md` memuat password 29 akun user dalam teks biasa.** Daftar
  itu sebaiknya tidak ikut ter-commit. Perlu ditinjau terpisah.
- **Key Gemini bocor** (`403 PERMISSION_DENIED`) — memblokir modul QC, terpisah
  dari pekerjaan ini. Kalau sedang di halaman Credentials, sekalian perbaiki.
- **`Multiple GoTrueClient instances detected`** di console — muncul karena
  `createSupabaseClient()` dipanggil berkali-kali. Sifatnya pra-ada dan tidak
  menyebabkan error upload. Tidak disentuh.
- **`.heic`** tidak bisa diproses di browser non-Safari. Sudah ada pesan yang
  menjelaskan, tapi dukungan penuh perlu library decoder WASM (menambah ~ratusan KB).
- **Masih ada ~110 warning & error `any`** di modul Kunjungan/B3/QC. Semuanya
  **sudah ada sebelum** pekerjaan ini dan sengaja tidak disentuh.

---

## Cara cepat mereproduksi masalahnya

Payload 5 byte dengan token asli — untuk memisahkan masalah konfigurasi dari
masalah ukuran/format:

```bash
cd ~/ramscl_workspace/lab-vision-qc

# token: login ke portal → DevTools Console →
#   JSON.parse(localStorage.getItem('lab-portal-auth')).token
bash scripts/diagnose-drive-upload.sh <session-token>
```

Skrip itu menerjemahkan respons menjadi diagnosis spesifik: secret kosong,
folder belum di-share, token kedaluwarsa, atau kuota (kasus kita sekarang).

Untuk memeriksa versi Edge Function yang ter-deploy:

```bash
printf '{"pdfBase64":"JVBERi0xLjQK","sessionToken":"probe"}' \
  | curl -sS -X POST "https://tpyocjcjoucyymsptbbw.supabase.co/functions/v1/upload-transfusi" \
      -H "Content-Type: application/json" --data-binary @-
```

Versi **baru** menjawab `"Nama pasien dan No. RM wajib diisi"` (validasi nama/RM
jalan sebelum cek sesi). Versi **lama** menjawab `"Invalid or expired session"`.
