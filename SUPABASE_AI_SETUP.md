# Supabase AI Setup Guide

Panduan lengkap untuk setup AI QC extraction menggunakan Supabase Edge Functions + Gemini 2.5 Flash Lite.

---

## 📋 Overview

### Architecture

```
Frontend (React)
   ↓
Supabase Edge Function (Deno/TypeScript)
   ├─→ Auth verification
   ├─→ Rate limiting (20 scans/user/day)
   ├─→ Image preprocessing
   ├─→ Gemini API call
   ├─→ Response validation
   └─→ Logging to qc_ai_logs table
```

### Key Features

- ✅ **Integrated:** All backend logic in Supabase (no external GAS dependency)
- ✅ **Secure:** API key hidden server-side, auth required
- ✅ **Rate Limited:** 20 scans/user/day (configurable)
- ✅ **Monitored:** Full logging in `qc_ai_logs` table
- ✅ **TypeScript:** Type-safe Edge Function code
- ✅ **Local Development:** Test locally before deploy

---

## 🚀 Quick Start

### Prerequisites

1. **Gemini API Key**
   - Get from: https://aistudio.google.com/apikey
   - Free tier: 15 requests/minute, 1500 requests/day
   - Model: `gemini-2.5-flash-lite`

2. **Supabase Project**
   - Local: Already running via `supabase start`
   - Production: Create project at https://supabase.com

3. **Database Migration**
   - Already applied: `002_qc_ai_logs.sql`
   - Tables: `qc_ai_logs`, functions: `check_ai_rate_limit`, `get_remaining_ai_scans`

---

## 🔧 Setup Steps

### Step 1: Set Gemini API Key

**Local Development:**
```bash
cd /Users/rama/ramscl_workspace/lab-vision-qc-supabase

# Set secret (stored in .env file, not committed to git)
echo "GEMINI_API_KEY=your_gemini_api_key_here" >> supabase/.env

# Verify
cat supabase/.env
```

**Production (Supabase Cloud):**
```bash
# Install Supabase CLI if not already installed
brew install supabase/tap/supabase

# Login
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Set secret
supabase secrets set GEMINI_API_KEY=your_gemini_api_key_here

# Verify
supabase secrets list
```

### Step 2: Test Edge Function Locally

**Start Function Server:**
```bash
# Serve all functions
supabase functions serve

# Or serve specific function
supabase functions serve extract-qc --env-file supabase/.env

# Function will be available at:
# http://localhost:54321/functions/v1/extract-qc
```

**Test with curl:**
```bash
# 1. Login to get session token
SESSION_TOKEN=$(curl -s -X POST http://localhost:54321/rest/v1/rpc/login \
  -H "Content-Type: application/json" \
  -H "apikey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH" \
  -d '{"p_username":"rama","p_password":"admin123"}' \
  | jq -r '.session_token')

echo "Session Token: $SESSION_TOKEN"

# 2. Test AI extraction (replace with actual base64 image)
curl -X POST http://localhost:54321/functions/v1/extract-qc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"imageBase64":"YOUR_BASE64_IMAGE_HERE"}' \
  | jq
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tanggal": "2026-05-10",
    "alat": "CA660",
    "level": "Kontrol",
    "lot": "LOT12345",
    "params": {
      "PT": 12.5,
      "APTT": 32.0,
      "INR": 1.0
    }
  },
  "remaining_scans": 19
}
```

### Step 3: Deploy to Production

**Deploy Edge Function:**
```bash
# Deploy
supabase functions deploy extract-qc

# Function will be available at:
# https://your-project-ref.supabase.co/functions/v1/extract-qc
```

**Update Frontend .env:**
```bash
# Production .env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### Step 4: Verify Deployment

**Test Production Endpoint:**
```bash
# Login
SESSION_TOKEN=$(curl -s -X POST https://your-project-ref.supabase.co/rest/v1/rpc/login \
  -H "Content-Type: application/json" \
  -H "apikey: your_anon_key" \
  -d '{"p_username":"rama","p_password":"admin123"}' \
  | jq -r '.session_token')

# Test extraction
curl -X POST https://your-project-ref.supabase.co/functions/v1/extract-qc \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SESSION_TOKEN" \
  -d '{"imageBase64":"YOUR_BASE64_IMAGE_HERE"}' \
  | jq
```

---

## 📊 Monitoring & Logs

### View AI Logs

**Via Supabase Studio:**
1. Open http://127.0.0.1:54323 (local) or https://supabase.com/dashboard (production)
2. Go to **Table Editor** → `qc_ai_logs`
3. View all AI extraction requests

**Via psql:**
```bash
# Connect to database
docker exec -it supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres

# View recent logs
SELECT 
  request_timestamp,
  success,
  error_message,
  tokens_used,
  response_time_ms,
  image_size_kb
FROM qc_ai_logs
ORDER BY request_timestamp DESC
LIMIT 10;

# View logs by user
SELECT 
  p.nama,
  COUNT(*) as total_scans,
  SUM(CASE WHEN success THEN 1 ELSE 0 END) as successful,
  SUM(tokens_used) as total_tokens
FROM qc_ai_logs l
JOIN profiles p ON l.user_id = p.id
WHERE DATE(request_timestamp) = CURRENT_DATE
GROUP BY p.nama
ORDER BY total_scans DESC;
```

### Check Rate Limit

**For Specific User:**
```sql
-- Check if user can scan
SELECT check_ai_rate_limit('ba98d317-ae71-4138-9df8-07cf0480bd7d'::uuid, 20);

-- Get remaining scans
SELECT get_remaining_ai_scans('ba98d317-ae71-4138-9df8-07cf0480bd7d'::uuid, 20);
```

**Via Frontend:**
```typescript
import { getRemainingAIScans } from '@/lib/api';

const remaining = await getRemainingAIScans();
console.log(`Remaining scans today: ${remaining}/20`);
```

---

## 🔍 Troubleshooting

### Error: "GEMINI_API_KEY not configured"

**Cause:** API key not set as Supabase secret

**Fix:**
```bash
# Local
echo "GEMINI_API_KEY=your_key" >> supabase/.env

# Production
supabase secrets set GEMINI_API_KEY=your_key
```

### Error: "Rate limit exceeded"

**Cause:** User has used all 20 scans for today

**Fix:**
- Wait until midnight (resets daily)
- Or manually reset in database:
```sql
DELETE FROM qc_ai_logs 
WHERE user_id = 'user_uuid_here' 
  AND DATE(request_timestamp) = CURRENT_DATE;
```

### Error: "Unauthorized"

**Cause:** Missing or invalid session token

**Fix:**
- Ensure user is logged in
- Check `localStorage.getItem('session_token')`
- Re-login if token expired

### Error: "Gemini API error: 429"

**Cause:** Gemini API rate limit exceeded (15 requests/minute)

**Fix:**
- Wait 1 minute
- Or upgrade Gemini API tier

### Error: "Invalid date format"

**Cause:** Gemini returned date in wrong format (e.g., DD/MM/YYYY instead of YYYY-MM-DD)

**Fix:**
- Prompt already instructs ISO format
- Parser validates and rejects invalid dates
- User should re-upload clearer image

### Error: "Missing required field: params"

**Cause:** Gemini couldn't extract any parameters from image

**Fix:**
- Image too blurry or low quality
- Struk format not recognized
- User should re-upload clearer image

---

## 📈 Performance Optimization

### Image Preprocessing

**Current:** Pass original image to Gemini (MVP)

**Future Enhancement:**
```typescript
// Add to preprocessor.ts
import { Image } from 'https://deno.land/x/imagescript/mod.ts';

export async function preprocessImage(base64Image: string) {
  const image = await Image.decode(Uint8Array.from(atob(base64Image), c => c.charCodeAt(0)));
  
  // Resize to max 1024px
  if (image.width > 1024 || image.height > 1024) {
    const scale = Math.min(1024 / image.width, 1024 / image.height);
    image.resize(image.width * scale, image.height * scale);
  }
  
  // Compress to 80% quality
  const compressed = await image.encodeJPEG(80);
  
  return {
    processedBase64: btoa(String.fromCharCode(...compressed)),
    originalSizeKB: Math.round(base64Image.length / 1024),
    processedSizeKB: Math.round(compressed.length / 1024)
  };
}
```

### Caching (Future)

**Strategy:** Cache extraction results by image hash

```typescript
// Add to index.ts
import { createHash } from 'https://deno.land/std/crypto/mod.ts';

const imageHash = createHash('sha256').update(base64Image).toString();

// Check cache
const { data: cached } = await supabaseClient
  .from('qc_ai_cache')
  .select('*')
  .eq('image_hash', imageHash)
  .single();

if (cached) {
  return cached.result; // Return cached result
}

// ... call Gemini ...

// Store in cache
await supabaseClient.from('qc_ai_cache').insert({
  image_hash: imageHash,
  result: parseResult.data
});
```

---

## 🔐 Security Best Practices

### 1. API Key Protection

- ✅ **DO:** Store in Supabase secrets
- ❌ **DON'T:** Commit to git or expose in frontend

### 2. Rate Limiting

- ✅ **DO:** Enforce per-user limits
- ✅ **DO:** Log all requests for audit
- ❌ **DON'T:** Allow unlimited scans (cost risk)

### 3. Authentication

- ✅ **DO:** Require valid session token
- ✅ **DO:** Verify user exists in database
- ❌ **DON'T:** Allow anonymous access

### 4. Input Validation

- ✅ **DO:** Validate base64 format
- ✅ **DO:** Validate image size (prevent abuse)
- ✅ **DO:** Validate Gemini response format
- ❌ **DON'T:** Trust user input blindly

---

## 📚 API Reference

### Endpoint

```
POST ${VITE_SUPABASE_URL}/functions/v1/extract-qc
```

### Request

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <session_token>
```

**Body:**
```json
{
  "imageBase64": "base64_encoded_image_string"
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "data": {
    "tanggal": "2026-05-10",
    "alat": "CA660|EASYLITE|ONCALL1|ONCALL2",
    "level": "Kontrol|NORMAL|HIGH|CTRL0|CTRL1|CTRL2",
    "lot": "string",
    "params": {
      "PT": number,
      "APTT": number,
      "INR": number,
      "Na": number,
      "K": number,
      "Cl": number,
      "GDA": number
    }
  },
  "remaining_scans": 19
}
```

**Error (400/401/429/500):**
```json
{
  "success": false,
  "error": "Error message",
  "remaining_scans": 0
}
```

### Error Codes

| Code | Meaning | Fix |
|------|---------|-----|
| 400 | Bad Request (missing imageBase64) | Include imageBase64 in body |
| 401 | Unauthorized (missing/invalid token) | Login and include valid token |
| 429 | Rate Limit Exceeded (20 scans used) | Wait until midnight |
| 500 | Internal Server Error | Check logs, contact admin |

---

## 🧪 Testing

### Unit Tests (Future)

```typescript
// tests/parser.test.ts
import { assertEquals } from 'https://deno.land/std/testing/asserts.ts';
import { parseGeminiResponse } from '../parser.ts';

Deno.test('parseGeminiResponse - valid response', () => {
  const mockResponse = {
    candidates: [{
      content: {
        parts: [{
          text: '{"tanggal":"2026-05-10","alat":"CA660","level":"Kontrol","lot":"LOT123","params":{"PT":12.5}}'
        }]
      }
    }],
    usageMetadata: { totalTokenCount: 100 }
  };

  const result = parseGeminiResponse(mockResponse);
  assertEquals(result.success, true);
  assertEquals(result.data?.alat, 'CA660');
  assertEquals(result.tokensUsed, 100);
});
```

### Integration Tests

```bash
# Run test script
node scripts/test-ai-extraction.cjs
```

---

## 📖 Resources

- **Gemini API Docs:** https://ai.google.dev/docs
- **Supabase Edge Functions:** https://supabase.com/docs/guides/functions
- **Deno Runtime:** https://deno.land/manual
- **TypeScript:** https://www.typescriptlang.org/docs

---

## 🆘 Support

**Issues:**
- Check logs in `qc_ai_logs` table
- Check Supabase Function logs: `supabase functions logs extract-qc`
- Check Gemini API status: https://status.google.com

**Contact:**
- Internal: Ask rama (admin)
- External: Create issue in project repo
