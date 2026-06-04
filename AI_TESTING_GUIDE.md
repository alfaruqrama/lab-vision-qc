# AI Extraction Testing Guide

## ✅ Setup Complete

### 1. Gemini API Key ✅
Gemini API key set in supabase/.env

### 2. Database Ready ✅
- qc_ai_logs table: 0 rows (ready for logging)
- Remaining scans for rama: 20/20 ✅

### 3. Edge Function Files ✅
All 5 TypeScript files created in supabase/functions/extract-qc/

---

## 🔍 Current Limitation

**Issue:** Supabase CLI not installed

**Impact:** Cannot run Edge Functions locally

**Solution:** Install Supabase CLI
```bash
brew install supabase/tap/supabase
```

---

## 📋 Next Steps

### Step 1: Install Supabase CLI
```bash
brew install supabase/tap/supabase
```

### Step 2: Start Edge Function Locally
```bash
cd /Users/rama/ramscl_workspace/lab-vision-qc-supabase
supabase functions serve extract-qc --env-file supabase/.env
```

### Step 3: Start Dev Server (New Terminal)
```bash
npm run dev
```

### Step 4: Test via Browser
1. Open http://localhost:8081
2. Login as rama / admin123
3. Go to Input QC
4. Upload struk image
5. Click "Scan dengan AI"

### Step 5: Verify Logging
```bash
docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -c "SELECT * FROM qc_ai_logs ORDER BY request_timestamp DESC LIMIT 5;"
```

---

See SUPABASE_AI_SETUP.md for complete documentation.
