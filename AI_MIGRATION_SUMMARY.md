# AI Extraction Migration Summary

## ✅ Completed: GAS → Supabase Edge Functions

**Date:** May 10, 2026  
**Status:** Implementation Complete (Testing Pending)

---

## 🎯 What Changed

### Before (GAS)
```
Frontend → Google Apps Script (external) → Gemini API
              ↓
         Supabase DB (separate)
```

**Problems:**
- External dependency (GAS)
- No rate limiting
- No logging/monitoring
- Harder to debug
- CORS complexity

### After (Supabase Edge Functions)
```
Frontend → Supabase Edge Function → Gemini API
              ↓
         Supabase DB (same platform)
              ↓
         qc_ai_logs table
```

**Benefits:**
- ✅ All backend in one platform
- ✅ Rate limiting: 20 scans/user/day
- ✅ Full logging & monitoring
- ✅ TypeScript (type-safe)
- ✅ Local development support
- ✅ Better security (auth required)

---

## 📦 Deliverables

### 1. Database Migration
**File:** `supabase/migrations/002_qc_ai_logs.sql`

**Created:**
- Table: `qc_ai_logs` (9 columns)
- Function: `check_ai_rate_limit(user_id, limit)`
- Function: `get_remaining_ai_scans(user_id, limit)`
- Indexes: user_id, timestamp

**Purpose:**
- Track all AI extraction requests
- Enforce 20 scans/user/day rate limit
- Monitor success rate, token usage, response time

### 2. Supabase Edge Function
**Directory:** `supabase/functions/extract-qc/`

**Files:**
- `index.ts` (4.7 KB) - Main handler (CORS, auth, rate limiting, logging)
- `gemini.ts` (2.3 KB) - Gemini API client
- `parser.ts` (3.0 KB) - Response validation
- `preprocessor.ts` (993 B) - Image preprocessing
- `types.ts` (947 B) - TypeScript interfaces

**Features:**
- Auth verification (session token required)
- Rate limiting (20/day per user)
- Image preprocessing (size calculation)
- Gemini API call (gemini-2.5-flash-lite)
- Response validation (strict enum checks)
- Database logging (success, errors, tokens, timing)
- CORS headers

### 3. Frontend Updates
**File:** `src/lib/api.ts`

**Changes:**
- Removed: `VITE_GAS_AI_URL` dependency
- Added: Supabase Function URL (`${VITE_SUPABASE_URL}/functions/v1/extract-qc`)
- Added: `getRemainingAIScans()` function
- Updated: `readStruk()` to call Supabase Function with auth token

**File:** `.env.local` & `.env.example`

**Changes:**
- Removed: `VITE_GAS_AI_URL` variable
- Added: Comments about Gemini API key (set as Supabase secret)
- Added: Rate limit documentation (20 scans/day)

### 4. Documentation
**Files:**
- `SUPABASE_AI_SETUP.md` (13 KB) - Complete setup guide
- `AI_MIGRATION_SUMMARY.md` (this file) - Migration summary

**Contents:**
- Quick start guide
- Local development setup
- Production deployment
- Monitoring & logs
- Troubleshooting
- API reference
- Security best practices

---

## 🔧 Setup Required (User Action)

### 1. Get Gemini API Key
```bash
# Visit: https://aistudio.google.com/apikey
# Create new API key
# Copy key
```

### 2. Set API Key as Supabase Secret

**Local Development:**
```bash
cd /Users/rama/ramscl_workspace/lab-vision-qc-supabase
echo "GEMINI_API_KEY=your_key_here" >> supabase/.env
```

**Production (when ready):**
```bash
supabase login
supabase link --project-ref your-project-ref
supabase secrets set GEMINI_API_KEY=your_key_here
supabase functions deploy extract-qc
```

### 3. Test Locally

**Option A: Via Frontend**
1. Start dev server: `npm run dev`
2. Login as rama
3. Go to Input QC
4. Upload struk image
5. Click "Scan dengan AI"
6. Verify extraction works

**Option B: Via curl**
```bash
# See SUPABASE_AI_SETUP.md for full curl examples
```

---

## 📊 Database Schema

### `qc_ai_logs` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | User who made request (FK to profiles) |
| `request_timestamp` | timestamptz | When request was made |
| `success` | boolean | Whether extraction succeeded |
| `error_message` | text | Error message if failed |
| `tokens_used` | integer | Gemini API tokens consumed |
| `response_time_ms` | integer | Response time in milliseconds |
| `extracted_data` | jsonb | Extracted QC data (JSON) |
| `image_size_kb` | integer | Size of uploaded image in KB |

**Indexes:**
- `idx_qc_ai_logs_user_id` on `user_id`
- `idx_qc_ai_logs_timestamp` on `request_timestamp DESC`

**Functions:**
- `check_ai_rate_limit(user_id, limit)` → boolean
- `get_remaining_ai_scans(user_id, limit)` → integer

---

## 🧪 Testing Checklist

### Phase 1: Database ✅
- [x] Migration applied successfully
- [x] Table `qc_ai_logs` created
- [x] Functions `check_ai_rate_limit` and `get_remaining_ai_scans` created
- [x] Functions return correct values (20 remaining for new user)

### Phase 2: Edge Function ✅
- [x] 5 TypeScript files created
- [x] No syntax errors
- [x] Frontend build successful

### Phase 3: Frontend Integration ✅
- [x] `api.ts` updated (GAS → Supabase Function)
- [x] `.env.local` updated (removed VITE_GAS_AI_URL)
- [x] Build successful (no TypeScript errors)

### Phase 4: Manual Testing ⏳ (Pending User Action)
- [ ] Set Gemini API key
- [ ] Test authentication (with/without token)
- [ ] Test rate limiting (20 scans, then 429 error)
- [ ] Test AI extraction (upload real struk image)
- [ ] Verify data extracted correctly
- [ ] Check `qc_ai_logs` table populated
- [ ] Test error handling (invalid image, blurry image)

### Phase 5: Production Deployment ⏳ (Future)
- [ ] Deploy Edge Function to Supabase Cloud
- [ ] Set production Gemini API key
- [ ] Update frontend .env for production
- [ ] Test production endpoint
- [ ] Monitor logs in production

---

## 🚨 Known Limitations

### 1. Image Preprocessing (MVP)
**Current:** Pass original image to Gemini  
**Future:** Resize to 1024px, compress to 80% quality  
**Impact:** Higher token cost, slower response

### 2. No Caching
**Current:** Every scan calls Gemini API  
**Future:** Cache results by image hash  
**Impact:** Duplicate scans waste tokens

### 3. No Retry Logic
**Current:** Single API call, fail if error  
**Future:** Retry with exponential backoff  
**Impact:** Transient errors not handled

### 4. Rate Limit Reset
**Current:** Resets at midnight (server timezone)  
**Future:** Configurable reset time  
**Impact:** May not align with user timezone

---

## 💰 Cost Estimate

### Gemini API (Free Tier)
- **Requests:** 15/minute, 1500/day
- **Tokens:** Free for gemini-2.5-flash-lite (experimental)
- **Cost:** $0/month (during experimental phase)

### Supabase Edge Functions (Free Tier)
- **Invocations:** 500,000/month
- **Bandwidth:** 2 GB/month
- **Cost:** $0/month (within free tier)

### Total Cost
- **Current:** $0/month (all free tier)
- **At Scale (100 users, 20 scans/day):** ~$0/month (still within free tier)
- **Future (paid tier):** ~$5-10/month (if exceed free tier)

---

## 📈 Monitoring Metrics

### Key Metrics to Track

1. **Success Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE success) * 100.0 / COUNT(*) as success_rate
   FROM qc_ai_logs
   WHERE DATE(request_timestamp) = CURRENT_DATE;
   ```

2. **Average Response Time**
   ```sql
   SELECT AVG(response_time_ms) as avg_ms
   FROM qc_ai_logs
   WHERE success = true
     AND DATE(request_timestamp) = CURRENT_DATE;
   ```

3. **Token Usage**
   ```sql
   SELECT SUM(tokens_used) as total_tokens
   FROM qc_ai_logs
   WHERE DATE(request_timestamp) = CURRENT_DATE;
   ```

4. **Top Errors**
   ```sql
   SELECT error_message, COUNT(*) as count
   FROM qc_ai_logs
   WHERE success = false
     AND DATE(request_timestamp) = CURRENT_DATE
   GROUP BY error_message
   ORDER BY count DESC;
   ```

---

## 🔄 Rollback Plan (If Needed)

If Edge Function has critical issues:

1. **Revert frontend changes:**
   ```bash
   git revert <commit_hash>
   ```

2. **Re-enable GAS (temporary):**
   ```bash
   # Add back to .env.local
   VITE_GAS_AI_URL=https://script.google.com/macros/s/.../exec
   ```

3. **Revert `api.ts`:**
   ```bash
   git checkout HEAD~1 -- src/lib/api.ts
   ```

4. **Rebuild:**
   ```bash
   npm run build
   ```

**Note:** Database migration (`qc_ai_logs` table) can stay (no harm, just unused).

---

## ✅ Next Steps

### Immediate (User Action Required)
1. **Get Gemini API key** from https://aistudio.google.com/apikey
2. **Set API key:** `echo "GEMINI_API_KEY=your_key" >> supabase/.env`
3. **Test locally:** Upload struk image via frontend
4. **Verify logs:** Check `qc_ai_logs` table

### Short Term (Optional Enhancements)
1. Add remaining scans indicator to UI
2. Add image preprocessing (resize + compress)
3. Add retry logic for transient errors
4. Add caching by image hash

### Long Term (Production)
1. Deploy Edge Function to Supabase Cloud
2. Set production Gemini API key
3. Monitor metrics (success rate, response time, token usage)
4. Optimize prompt for better accuracy
5. Add A/B testing for different prompts

---

## 📞 Support

**Questions or Issues:**
- Check `SUPABASE_AI_SETUP.md` for detailed guide
- Check `qc_ai_logs` table for error messages
- Check Supabase Function logs: `supabase functions logs extract-qc`
- Contact: rama (admin)

**Useful Commands:**
```bash
# View recent logs
docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -c "SELECT * FROM qc_ai_logs ORDER BY request_timestamp DESC LIMIT 10;"

# Check remaining scans for rama
docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -c "SELECT get_remaining_ai_scans('ba98d317-ae71-4138-9df8-07cf0480bd7d'::uuid, 20);"

# Reset rate limit for testing
docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -c "DELETE FROM qc_ai_logs WHERE user_id = 'ba98d317-ae71-4138-9df8-07cf0480bd7d'::uuid AND DATE(request_timestamp) = CURRENT_DATE;"
```

---

**Migration Complete! 🎉**

All code changes done. Ready for testing once Gemini API key is set.
