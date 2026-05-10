# GAS QC Backend — Setup Guide

> Version: 1.0.0 | 2026-05-10

---

## Step 1: Persiapan Google Sheet

Buka spreadsheet `database QC` (`1hB6rqKbV1WLE4CpN94T3kEYF_eDG0OCt4nmFhODzCzk`).

### Sheet "qc record"
Pastikan baris pertama (header) berisi kolom berikut persis:

| A | B | C | D | E | F | G | H | I | J | K | L | M |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| id | tanggal | alat | lot | level | nilai | mean | sd | cv | status | rules | petugas | catatan |

Jika belum ada header, GAS akan membuatnya otomatis saat pertama kali `save` dipanggil.

### Sheet "lot config"
Buat sheet baru bernama `lot config` (huruf kecil, ada spasi). Biarkan kosong — GAS akan mengisi header otomatis saat `saveKonfig` pertama kali dipanggil.

Header yang akan dibuat:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| alat | lot | exp | level | param | mean | sd |

---

## Step 2: Buat Google Apps Script

1. Buka [script.google.com](https://script.google.com)
2. Klik **New project**
3. Beri nama: `Lab Vision QC Backend`
4. Hapus semua kode default di editor
5. Copy seluruh kode dari `GAS_QC_CODE.md` (bagian dalam code block)
6. Paste ke editor
7. Klik **Save** (Ctrl+S)

---

## Step 3: Deploy

1. Klik **Deploy → New deployment**
2. Klik ikon gear ⚙️ di sebelah "Select type" → pilih **Web app**
3. Isi konfigurasi:
   - **Description**: `v1.0.0`
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. Klik **Deploy**
5. Klik **Authorize access** → pilih akun Google yang punya akses ke kedua spreadsheet
6. Salin **Web app URL** yang muncul

---

## Step 4: Update Environment Variables

### Lokal (`.env`)
```
VITE_GAS_QC_URL=https://script.google.com/macros/s/YOUR_NEW_URL/exec
```

### Vercel
```bash
vercel env add VITE_GAS_QC_URL production
vercel env add VITE_GAS_QC_URL preview
```

Lalu update `src/lib/api.ts` — ganti hardcoded URL dengan env var (lihat Step 5).

---

## Step 5: Update Frontend (`src/lib/api.ts`)

Ganti baris ini:
```ts
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/...';
```

Dengan:
```ts
const APPS_SCRIPT_URL = import.meta.env.VITE_GAS_QC_URL || '';
```

Dan update fungsi `post()` untuk menyertakan token:
```ts
async function post(action: string, payload: any, token?: string): Promise<any> {
  if (!isConnected()) throw new Error('Demo mode');
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action, token, ...payload }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
```

Dan update semua caller `saveRecord` dan `saveConfig` untuk pass token:
```ts
export async function saveRecord(record: QCRecord, token: string): Promise<any> {
  const sheetsData = mapRecordToSheets(record);
  return post('save', { data: sheetsData }, token);
}

export async function saveConfig(config: LotConfig, token: string): Promise<any> {
  return post('saveKonfig', { data: config }, token);
}
```

---

## Step 6: Testing

### 6.1 Ping (cURL)
```bash
curl "YOUR_GAS_URL?action=ping"
# Expected: {"status":"ok","version":"1.0.0"}
```

### 6.2 getByMonth (cURL)
```bash
curl "YOUR_GAS_URL?action=getByMonth&month=MEI&token=YOUR_TOKEN"
# Expected: {"status":"ok","data":[],"count":0}
```

### 6.3 save (cURL)
```bash
curl -X POST "YOUR_GAS_URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"save","token":"YOUR_TOKEN","data":{"id":"test-001","tanggal":"2026-05-10","alat":"CA660","lot":"LOT001","level":"Kontrol","params":{"PT":12.5,"APTT":28.3},"status":{"PT":"ok","APTT":"ok"},"catatan":""}}'
# Expected: {"status":"ok","message":"Record disimpan","id":"test-001"}
```

### 6.4 delete (cURL)
```bash
curl -X POST "YOUR_GAS_URL" \
  -H "Content-Type: text/plain" \
  -d '{"action":"delete","token":"YOUR_TOKEN","id":"test-001"}'
# Expected: {"status":"ok","message":"Record dihapus","id":"test-001"}
```

### 6.5 JavaScript test (browser console)
```js
const GAS_URL = 'YOUR_GAS_URL';
const TOKEN = 'YOUR_TOKEN'; // ambil dari localStorage key: lab-portal-auth → token

// Ping
fetch(`${GAS_URL}?action=ping`).then(r => r.json()).then(console.log);

// getByMonth
fetch(`${GAS_URL}?action=getByMonth&month=MEI&token=${TOKEN}`).then(r => r.json()).then(console.log);

// save
fetch(GAS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: JSON.stringify({
    action: 'save',
    token: TOKEN,
    data: {
      id: 'test-js-001',
      tanggal: '2026-05-10',
      alat: 'CA660',
      lot: 'LOT001',
      level: 'Kontrol',
      params: { PT: 12.5, APTT: 28.3, INR: 1.1 },
      status: { PT: 'ok', APTT: 'ok', INR: 'ok' },
      catatan: ''
    }
  })
}).then(r => r.json()).then(console.log);
```

---

## Troubleshooting

| Error | Penyebab | Solusi |
|---|---|---|
| `Sheet "qc record" tidak ditemukan` | Nama sheet salah | Pastikan nama sheet persis `qc record` (huruf kecil, ada spasi) |
| `Unauthorized — token tidak valid` | Token expired atau salah | Login ulang di app, ambil token baru dari localStorage |
| `Unknown action` | Typo di action name | Cek spelling: `getByMonth`, `save`, `saveKonfig`, dll |
| Response HTML bukan JSON | GAS URL expired | Redeploy GAS, update URL di Vercel env vars |
| Email error tidak masuk | Akun GAS tidak punya akses MailApp | Re-authorize script dengan scope MailApp |
| `Cannot read property of null` di validateToken | Users sheet tidak ditemukan di auth spreadsheet | Pastikan `AUTH_SPREADSHEET_ID` benar dan sheet bernama `Users` |

---

## Volume & Performance

- ~15 record/hari × 22 hari kerja = **~330 record/bulan**
- 1 tahun = **~3.960 record**
- Google Sheets limit: 10 juta sel — tidak akan tercapai dalam waktu dekat
- `getByMonth` hanya baca baris bulan tertentu — performa tetap baik meski data bertambah
- Jika data > 10.000 baris (±2.5 tahun), pertimbangkan arsip sheet per tahun
