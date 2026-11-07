# Panduan Downtime: Laporan Kunjungan

Panduan ini untuk kondisi **web tidak bisa diakses**. Catat data di formulir kertas atau salinan spreadsheet offline. Setelah layanan pulih, masukkan kembali data ke aplikasi/Google Sheets dan cocokkan tanggal serta totalnya.

## 1. Siapkan data

Catat tanggal, periode laporan (pagi atau siang), dan angka harian dari sumber operasional yang tersedia:

- Rawat jalan: jumlah basic, non-BPJS, Exclusive, Prioritas.
- Rawat inap: jumlah total dan non-BPJS.
- IGD: jumlah total dan non-BPJS.
- MCU: jumlah MCU perusahaan, serta jumlah peserta per promo.
- Rujukan: Grahu (RJ dan RI), PPK1, Satkal, dokter luar.
- Pasien PG: karyawan/keluarga untuk IGD, rawat jalan, rawat inap.
- Pasien AS Morula: terjadwal dan hadir.
- Pendapatan: omzet total, pendapatan MCU, pendapatan BPJS.
- Kumulatif sampai kemarin, target harian, dan target bulanan.

Nama penjamin dan badge mengikuti [mapping badge](src/lib/kunjungan-badge-map.json). File itu memuat tiap penjamin beserta badge, kolom rekap di sheet, kelompok, dan apakah dihitung sebagai BPJS.

### Kelompok per badge

| Badge | Kolom rekap sheet | Kelompok | Hitungan BPJS |
|---|---|---|---|
| PG | PT PETROKIMIA | PT Petrokimia (karyawan & keluarga) | tidak |
| INHEALTH PG | AJ INHEALTH PLUS | PT Petrokimia - InHealth | tidak |
| BRI LIFE PG | BRI (PG) | PT Petrokimia - BRI Life | tidak |
| NPG | PERUSAHAAN LAIN | Perusahaan lain (non-PG) | tidak |
| AS | ASURANSI KOMERSIAL | Asuransi komersial | tidak |
| BPJS | BPJS KES | BPJS Kesehatan | **ya** |
| JKK | BPJS TK | BPJS Tenaga Kerja | tidak |
| PROKESPEN | PROKESPEN MURNI | Prokespen murni | tidak |
| PROKESPEN BPJS | PROKESPEN BPJS | Prokespen BPJS COB | tidak |
| UMUM | TUNAI | Tunai/umum & paket promo | tidak |

Hanya badge `BPJS` yang dihitung sebagai BPJS. Badge `PROKESPEN BPJS` dan `JKK` tetap masuk hitungan non-BPJS, sesuai perhitungan aplikasi.

Catatan untuk rincian Pasien PG: kelompok karyawan adalah `KARYAWAN PG` dan `KARYAWAN PG INHEALTH PLUS`; kelompok keluarga adalah `KELUARGA PG` dan `KELUARGA PG INHEALTH PLUS`. `KARYAWAN PG INHEALTH` dan `KELUARGA PG INHEALTH` (tanpa PLUS) tidak masuk hitungan enam baris Pasien PG.

## 2. Hitung rincian kunjungan

Gunakan angka yang dihitung dari data hari itu. Rumus berikut mengikuti perhitungan tab **Laporan** aplikasi.

### Rawat jalan (RJ)

```text
Total RJ                 = RJ basic + Poli Exclusive + Poli Prioritas
Non-BPJS RJ yang dilapor = Non-BPJS RJ basic + Poli Exclusive + Poli Prioritas
BPJS RJ                  = RJ basic - Non-BPJS RJ basic
```

Isi `Non-BPJS RJ basic` sebagai angka dasar yang terpisah sebelum menambahkan Exclusive/Prioritas. Jangan mengurangi lagi Exclusive/Prioritas saat menghitung BPJS RJ; aplikasi memakai rumus di atas.

### Rawat inap (RI) dan IGD

```text
BPJS RI  = Total RI  - Non-BPJS RI
BPJS IGD = Total IGD - Non-BPJS IGD
```

### MCU dan promo

```text
Total promo            = jumlah peserta dari semua item promo
Total MCU yang dilapor = MCU perusahaan + Total promo
```

Cantumkan rincian nama promo dan jumlah pesertanya. Di data input harian, `mcuAuto` adalah jumlah MCU perusahaan; `promo` berisi jumlah peserta promo.

### Total kunjungan harian

```text
Total kunjungan = Total RJ
                + Total RI
                + Total IGD
                + Total MCU yang dilapor
                + Rujukan Grahu
                + Rujukan PPK1
                + Rujukan Satkal
                + Rujukan dokter luar
```

`Rujukan Grahu = rujukan Grahu RJ + rujukan Grahu RI`.

### Pasien PG

Kelompok karyawan: `KARYAWAN PG` + `KARYAWAN PG INHEALTH PLUS`.

Kelompok keluarga: `KELUARGA PG` + `KELUARGA PG INHEALTH PLUS`.

Jumlahkan kolom sesuai unit:

| Baris laporan | Hitung dari |
|---|---|
| IGD Kry PG | IGD kelompok karyawan |
| IGD Kel PG | IGD kelompok keluarga |
| Rajal Kry PG | (RJ basic + Exclusive) kelompok karyawan |
| Rajal Kel PG | (RJ basic + Exclusive) kelompok keluarga |
| Rawin Kry PG | RI kelompok karyawan |
| Rawin Kel PG | RI kelompok keluarga |

### Promo Lab

Untuk setiap penjamin/baris dengan jumlah promo lebih dari nol, catat nama penjamin/promo dan jumlah peserta. Jumlah seluruh item tersebut menjadi `Total promo` pada perhitungan MCU.

## 3. Hitung capaian dan pendapatan

```text
Capaian kunjungan harian (%) = Total kunjungan / Target kunjungan harian × 100
Capaian omzet harian (%)     = Total omzet harian / Target omzet harian × 100
Pendapatan selain MCU/BPJS  = max(0, Total omzet - Pendapatan MCU - Pendapatan BPJS)
Rerata pendapatan/pasien    = Total omzet / Total kunjungan
```

Jika target atau total kunjungan bernilai nol, tulis `0%` untuk capaian. Jika total kunjungan nol, tulis `Rp 0` untuk rerata. Pendapatan adalah rupiah; jangan jumlahkan angka rupiah ke jumlah pasien.

## 4. Hitung kumulatif bulanan

Ambil nilai **sampai kemarin** dari rekap terakhir yang tersedia. Pada hari pertama bulan, nilai sampai kemarin adalah nol. Jangan mengarang nilai kumulatif jika rekap lama tidak tersedia; tandai `belum dapat diverifikasi` dan lengkapi setelah akses kembali.

```text
Kumulatif omzet sampai hari ini = Omzet sampai kemarin + Total omzet hari ini
Kumulatif kunjungan             = Kunjungan sampai kemarin + Total kunjungan hari ini
Kumulatif omzet MCU             = Omzet MCU sampai kemarin + Pendapatan MCU hari ini
Kumulatif kunjungan MCU         = Kunjungan MCU sampai kemarin + Total MCU yang dilapor

Kumulatif omzet non-MCU         = max(0, Kumulatif omzet - Kumulatif omzet MCU)
Kumulatif kunjungan non-MCU     = max(0, Kumulatif kunjungan - Kumulatif kunjungan MCU)
Capaian omzet bulanan (%)       = Kumulatif omzet / Target omzet bulanan × 100
Capaian kunjungan bulanan (%)   = Kumulatif kunjungan / Target kunjungan bulanan × 100
```

Untuk pembagian dengan target bulanan nol, tulis `0%`. Target harian dan bulanan ambil dari dokumen target resmi, bukan perkiraan.

## 5. Pemeriksaan sebelum laporan dikirim

- Pastikan tanggal dan periode benar; laporan siang mencakup `00.00–12.00 WIB`.
- Pastikan `BPJS + Non-BPJS = Total` untuk RJ basic, RI, dan IGD.
- Pastikan Total MCU sama dengan MCU perusahaan ditambah semua peserta promo.
- Jumlahkan ulang Total kunjungan dari komponen di atas.
- Pastikan enam rincian pasien PG telah dijumlah per nama penjamin dan unit.
- Cocokkan total omzet dengan sumber keuangan; jangan menurunkan omzet dari jumlah pasien.
- Catat nama petugas dan waktu pencatatan. Minta pemeriksa kedua mengecek angka sebelum dikirim.

## 6. Template laporan WhatsApp

Ganti semua `[ ... ]` dengan angka hasil pencatatan. Hapus baris promo yang tidak ada.

```text
LAPORAN KUNJUNGAN
[Hari] [tanggal] [bulan] [tahun]
[Untuk laporan siang: 00.00 - 12.00 WIB]

Capaian Harian
• Total Kunj Harian: [total kunjungan] ([capaian kunjungan]%)
• Total Pendapatan: Rp [total omzet] ([capaian omzet]%)
  └ Pendapatan MCU: Rp [pendapatan MCU]
  └ Pendapatan BPJS: Rp [pendapatan BPJS]
  └ Pendapatan selain MCU dan BPJS: Rp [hasil rumus]
• Target harian: Rp [target omzet harian]
• Rerata pendapatan per pasien: Rp [hasil rumus]/Pasien

Rincian
▪️Rawat Jalan: [total RJ]
    * Non BPJS: [non-BPJS RJ yang dilapor] (Eks: [Exclusive], Prio: [Prioritas])
    * BPJS: [BPJS RJ]
▪️Rawat Inap: [total RI]
    * Non BPJS: [non-BPJS RI]
    * BPJS: [BPJS RI]
▪️IGD: [total IGD]
    * Non BPJS: [non-BPJS IGD]
    * BPJS: [BPJS IGD]
▪️MCU: [total MCU yang dilapor] (Perusahaan: [MCU perusahaan], Promo: [total promo])
    * Rincian Paket Promo:
        1. [nama promo]: [peserta]

Keterangan
▪️Rujukan SBU/Grahu: [RJ + RI]
▪️Rujukan SBU/PPK1: [jumlah]
▪️Rujukan SBU/Satkal: [jumlah]
▪️Rujukan dokter luar: [jumlah]
▪️Pasien PG:
    1. IGD Kry PG: [jumlah]
    2. IGD Kel PG: [jumlah]
    3. Rajal Kry PG: [jumlah]
    4. Rajal Kel PG: [jumlah]
    5. Rawin Kry PG: [jumlah]
    6. Rawin Kel PG: [jumlah]
▪️Pasien AS Morula:
    1. Terjadwal hari ini: [jumlah]
    2. Hadir hari ini: [jumlah]

CAPAIAN
01 - [tanggal] [bulan] [tahun]
• Total pendapatan: Rp [kumulatif omzet] ([capaian omzet bulanan]%)
  └ Pendapatan MCU: Rp [kumulatif omzet MCU]
  └ Pendapatan selain MCU: Rp [kumulatif omzet non-MCU]
• Total kunjungan: [kumulatif kunjungan] ([capaian kunjungan bulanan]%)
  └ Kunjungan MCU: [kumulatif kunjungan MCU]
  └ Kunjungan Non MCU: [kumulatif kunjungan non-MCU]

Target [bulan] [tahun]
• Kunjungan: [target kunjungan bulanan]
• Omzet: Rp [target omzet bulanan]
```

## 7. Setelah web pulih

1. Simpan lembar pencatatan dan salinan laporan WhatsApp sampai rekonsiliasi selesai.
2. Masukkan data harian ke aplikasi/Google Sheets dengan tanggal asli.
3. Hindari submit berulang sebelum memeriksa apakah tanggal tersebut sudah tercatat.
4. Cocokkan kunjungan, MCU, promo, omzet, dan kumulatif. Catat koreksi beserta petugas dan waktunya.

**Catatan:** jika format section atau target resmi berubah, perbarui panduan ini mengikuti konfigurasi laporan terbaru. Aplikasi dapat memiliki section tambahan yang tidak tercantum pada template dasar ini.
