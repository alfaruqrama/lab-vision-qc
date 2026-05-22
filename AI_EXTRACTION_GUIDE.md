# AI Extraction — Troubleshooting & Guide

> Edge Function: `supabase/functions/extract-qc/`  
> Model: Gemini 2.5 Flash Lite  
> Rate limit: 20 scans/user/day

---

## 🔴 Current Issue: API Key Leaked

### Error

```
POST /functions/v1/extract-qc → 500
{
  "success": false,
  "error": "Gemini API error: 403 - Your API key was reported as leaked. Please use another API key.",
  "status": "PERMISSION_DENIED"
}
```

### Fix

```bash
# 1. Generate key baru di https://aistudio.google.com/apikey

# 2. Update secret
cd /Users/rama/ramscl_workspace/lab-vision-qc
supabase secrets set GEMINI_API_KEY=<NEW_KEY>

# 3. Redeploy
supabase functions deploy extract-qc --no-verify-jwt

# 4. Verify
curl -X POST https://tpyocjcjoucyymsptbbw.supabase.co/functions/v1/extract-qc \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"test","sessionToken":"00000000-0000-0000-0000-000000000000"}'
# Expected: {"success":false,"error":"Invalid or expired session"}
# (bukan 403 Gemini error)
```

---

## 🏗️ Architecture

```
Frontend (React)
  │  POST { imageBase64, sessionToken }
  ▼
Edge Function: extract-qc
  ├── 1. Validate sessionToken → sessions table
  ├── 2. Check rate limit → qc_ai_logs (20/day)
  ├── 3. Preprocess image (base64 size check)
  ├── 4. Call Gemini API (gemini-2.5-flash-lite)
  ├── 5. Parse & validate response
  ├── 6. Log to qc_ai_logs
  └── Return { success, data } or { success: false, error }
```

### Files

| File | Ukuran | Fungsi |
|------|--------|--------|
| `index.ts` | 4.7 KB | Main handler — CORS, auth, rate limit, logging |
| `gemini.ts` | 2.3 KB | Gemini API client + prompt |
| `parser.ts` | 3.0 KB | Validate & normalize response |
| `preprocessor.ts` | 993 B | Image size check |
| `types.ts` | 947 B | TypeScript interfaces |

---

## 🧪 Testing

### Test 1: Edge Function Live Check

```bash
curl -X POST https://tpyocjcjoucyymsptbbw.supabase.co/functions/v1/extract-qc \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"test","sessionToken":"00000000-0000-0000-0000-000000000000"}'
```

Expected: `{"success":false,"error":"Invalid or expired session"}`

### Test 2: CA-660 Extraction (via browser)

1. Login → Input QC → Step 1 (Pilih Instrumen: CA-660)
2. Klik **Ambil Foto** → upload foto struk
3. Expected response:
   ```json
   {
     "success": true,
     "data": {
       "tanggal": "2026-05-11",
       "alat": "CA660",
       "level": "Kontrol 1",
       "lot": "XXXXX",
       "params": { "PT": 12.5, "APTT": 32.1, "INR": 1.02 }
     }
   }
   ```

### Test 3: Rate Limit

Scan 21x dengan user yang sama dalam satu hari.  
Scan ke-21 harus return: `{"success":false,"error":"Rate limit exceeded"}`

---

## 🔧 Prompt Tuning

Prompt ada di `supabase/functions/extract-qc/gemini.ts`.

### CA-660 (Status: ✅ Berjalan)

Ekstrak: PT, APTT, INR dari struk Sysmex CA-660.  
Accuracy: ~85%. Sudah production-ready.

### Easylite (Status: ⚠️ Perlu Tuning)

Ekstrak: GDA (glukosa darah acak) dari struk Easylite.  
Accuracy: ~60%. Variasi format struk menyebabkan parse error.

**Cara improve:**
1. Kumpulkan 5-10 foto struk Easylite yang gagal
2. Identifikasi pola format yang tidak ter-handle
3. Update prompt dengan contoh format tersebut (few-shot)
4. Test → deploy

### OnCall Sure (Status: ⚠️ Belum Ditest)

Ekstrak: GDA dari struk OnCall Sure.  
Belum ada sample struk untuk testing.

**Cara test:**
1. Ambil foto struk OnCall Sure
2. Test via Input QC → Ambil Foto
3. Catat hasil dan error
4. Tuning prompt sesuai format struk

---

## 📊 Monitoring

### Logs di Supabase Dashboard

1. Buka https://supabase.com/dashboard/project/tpyocjcjoucyymsptbbw/functions
2. Klik `extract-qc` → tab **Logs**

### SQL Queries

```sql
-- Success rate hari ini
SELECT
  COUNT(*) FILTER (WHERE success = true) * 100.0 / NULLIF(COUNT(*), 0) AS success_pct,
  COUNT(*) AS total
FROM qc_ai_logs
WHERE created_at >= CURRENT_DATE;

-- Error terbaru
SELECT created_at, error_message, response_time_ms
FROM qc_ai_logs
WHERE success = false
ORDER BY created_at DESC
LIMIT 20;

-- Sisa scan per user hari ini
SELECT
  p.username,
  20 - COUNT(l.id) AS remaining
FROM profiles p
LEFT JOIN qc_ai_logs l ON l.user_id = p.id
  AND l.created_at >= CURRENT_DATE
GROUP BY p.id, p.username
ORDER BY remaining ASC;
```

---

## 🚨 Common Errors

| Error | Penyebab | Fix |
|-------|----------|-----|
| `Invalid or expired session` | Token expired (4 jam) atau tidak valid | Logout → login ulang |
| `Rate limit exceeded` | Sudah 20 scan hari ini | Tunggu besok |
| `403 PERMISSION_DENIED` | Gemini API key invalid/leaked | Generate key baru (lihat atas) |
| `503 Service Unavailable` | Gemini overload (temporary) | Retry setelah beberapa detik |
| `Failed to parse response` | Format struk tidak dikenali prompt | Input manual, laporkan ke developer |
| `VITE_SUPABASE_URL not configured` | Env var tidak set di Vercel | Check Vercel → Settings → Env Vars |

---

## 🔒 Security

- Gemini API key **hanya** disimpan di Supabase secrets — tidak pernah di frontend
- Session token divalidasi di Edge Function sebelum call Gemini
- Rate limiting mencegah abuse (20 scan/user/day)
- Jangan commit key ke git — sudah ada di `.gitignore`

**Rotate key jika:**
- Key ter-commit ke public repo
- Key ter-log di console atau error message
- Curiga ada unauthorized usage
