# Panduan Setup Spreadsheet B3

## 1. Buat Google Spreadsheet Baru

1. Buka [sheets.google.com](https://sheets.google.com) → **Blank spreadsheet**
2. Ganti nama spreadsheet: `B3-Lab-RSPG` (atau sesuai keinginan)
3. Buat **4 sheet** dengan nama persis ini (case-sensitive):
   - `Materials`
   - `Stock`
   - `Pemakaian`
   - `Limbah`

> **PENTING**: Nama sheet harus persis karena GAS script me-refer ke nama ini.

---

## 2. Setup Header di Setiap Sheet

Copy header berikut ke baris 1 masing-masing sheet. **Jangan diubah urutannya**.

### Sheet: `Materials`
| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| id | kode | nama | kategori | hazard_class | storage_location | satuan | low_stock_threshold | is_active | created_at |

### Sheet: `Stock`
| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| id | material_id | batch_lot | initial_qty | current_qty | satuan | expiry_date | received_date | supplier | created_at |

### Sheet: `Pemakaian`
| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| id | material_id | stock_id | qty | satuan | tujuan | tanggal | jam | analis | catatan | created_at |

### Sheet: `Limbah`
| A | B | C | D | E | F | G | H | I | J | K | L |
|---|---|---|---|---|---|---|---|---|---|---|---|
| id | material_id | waste_type | qty | satuan | sumber | tanggal_generasi | disposal_method | manifest_no | tps_location | catatan | created_at |

---

## 3. Deploy Google Apps Script

1. Buka **Extensions > Apps Script**
2. Hapus code default, **copy-paste** isi file `scripts/b3-gas-backend.js`
3. Klik **Deploy > New deployment**
4. Pilih type: **Web app**
5. Settings:
   - Execute as: **Me** (`your-email@gmail.com`)
   - Who has access: **Anyone** (karena frontend akan fetch via URL)
6. Klik **Deploy** → Authorize permissions → Copy URL yang muncul
7. URL-nya berbentuk: `https://script.google.com/macros/s/XXXX/exec`

---

## 4. Set Environment Variable

Di file `.env.local` project:

```bash
VITE_GAS_B3_URL=https://script.google.com/macros/s/XXXX/exec
```

---

## 5. Verifikasi

1. Test GAS endpoint langsung di browser:
   ```
   https://script.google.com/macros/s/XXXX/exec?action=ping
   ```
   Harus return: `{"status":"ok","time":"2026-06-01T..."}`

2. Jalankan dev server:
   ```bash
   npm run dev
   ```

3. Buka `http://localhost:5173/b3` → Dashboard B3 akan muncul

4. Card "Manajemen B3" juga muncul di Portal Home (`/`)

---

## 6. Input Data Awal (via Spreadsheet Langsung)

Sebelum form web digunakan, kamu bisa mengisi data awal langsung di sheet:

### Contoh data di `Materials`:
```
id: (kosongkan — GAS akan auto-generate UUID)
kode: B3-001
nama: Formalin 10%
kategori: Reagen
hazard_class: Beracun, Korosif
storage_location: Lemari Asam
satuan: L
low_stock_threshold: 2
is_active: TRUE
created_at: (kosongkan)
```

> **Catatan**: Lebih baik input via web app setelah deployed, karena GAS akan auto-generate UUID. Tapi untuk testing, isi manual juga bisa.

---

## Kategori yang Tersedia

| Kategori | Contoh Material |
|----------|----------------|
| Reagen | Formalin, Xylene, Ethanol, Methanol, Giemsa, Wright |
| Disinfektan | Alkohol 70%, Klorin, H2O2, Lysol |
| Pelarut | Aquades, Buffer solution, NaCl |
| Limbah Medis | Benda tajam, Darah, Cairan tubuh |
| Gas Medis | O2, N2O, CO2 |
| Lainnya | Aki bekas, Lampu UV, Termometer Hg |

## Kelas Bahaya

| Kelas | Simbol |
|-------|--------|
| Mudah Terbakar | 🔥 |
| Beracun | ☠️ |
| Korosif | 🧪 |
| Reaktif | 💥 |
| Iritan | ⚠️ |

---

## Troubleshooting

**GAS return error "Unknown action"**
→ Pastikan URL punya `?action=ping` di akhir

**Dashboard muncul "Modul B3 Belum Dikonfigurasi"**
→ Periksa `VITE_GAS_B3_URL` di `.env.local`, restart dev server

**Data tidak muncul setelah input**
→ Cek browser console untuk error. Pastikan GAS web app di-deploy ulang (setiap edit script harus deploy ulang: **Deploy > Manage deployments > Edit > Version: New version > Deploy**)
