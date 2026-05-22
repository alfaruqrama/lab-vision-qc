# 🔧 Auth Fix Applied - Ready to Test!

## ✅ Root Cause Found & Fixed

### The Problem:
The Edge Function was using **Supabase's built-in auth** (`supabaseClient.auth.getUser()`), but we're using **custom session tokens** stored in the `sessions` table.

**Result:** Every AI extraction request failed with "Sesi login habis" because the Edge Function couldn't validate our custom tokens.

### The Fix:
Updated Edge Function to:
1. ✅ Query `sessions` table directly with the token
2. ✅ Validate session expiry
3. ✅ Check user active status
4. ✅ Extract user info from `profiles` join

**Commit:** `c2cbed6` - "fix: Edge Function auth to use custom session tokens"

---

## 🚀 How to Test (3 Steps)

### Step 1: Restart Edge Function

**In Terminal 1 (where Edge Function is running):**
```bash
# Press Ctrl+C to stop
# Then restart:
cd /Users/rama/ramscl_workspace/lab-vision-qc-supabase
supabase functions serve extract-qc --env-file supabase/.env
```

**Expected output:**
```
Serving functions on http://127.0.0.1:54321/functions/v1/
  - http://127.0.0.1:54321/functions/v1/extract-qc
```

### Step 2: Refresh Browser

**In your browser:**
```
Press: Cmd+Shift+R (hard refresh)
```

This ensures the latest frontend code is loaded.

### Step 3: Test AI Extraction

1. **Go to Input QC page**
2. **Select instrument:** CA660
3. **Upload the struk image** (the one from your screenshot)
4. **Click "Ulang"** or re-upload if needed
5. **Watch for success!**

---

## 🎯 Expected Results

### Success Flow:

**Terminal 1 (Edge Function):**
```
[timestamp] Incoming request to extract-qc
[timestamp] Session validated for user: rama
[timestamp] Calling Gemini API...
[timestamp] Extraction successful
[timestamp] Logged to qc_ai_logs
```

**Browser:**
```
Toast: "AI berhasil baca struk! Periksa sebelum simpan."
Form auto-fills with:
- PT: [extracted value]
- APTT: [extracted value]
- INR: [extracted value]
```

**Database:**
```bash
# Check logs
docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -c "SELECT * FROM qc_ai_logs ORDER BY request_timestamp DESC LIMIT 1;"

# Should show:
# - success: true
# - extracted_data: {...}
# - tokens_used: ~150
# - response_time_ms: ~2000
```

**Remaining scans:**
```bash
docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -c "SELECT get_remaining_ai_scans('ba98d317-ae71-4138-9df8-07cf0480bd7d'::uuid, 20);"

# Should show: 19 (decreased from 20)
```

---

## 🐛 If Still Not Working

### Check 1: Edge Function Logs
Look for errors in Terminal 1:
- "Invalid or expired session" → Session token issue
- "GEMINI_API_KEY not configured" → Check supabase/.env
- "Gemini API error" → API issue

### Check 2: Browser Console
F12 → Console tab:
- Look for network errors
- Check request to `/functions/v1/extract-qc`
- Verify Authorization header is sent

### Check 3: Session Token
In browser console:
```javascript
console.log('Token:', localStorage.getItem('session_token'));
```

Should show a UUID. If null, re-login.

### Check 4: Database Session
```bash
# Check if session exists
docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -c "SELECT token, expires_at, user_id FROM sessions WHERE user_id = 'ba98d317-ae71-4138-9df8-07cf0480bd7d'::uuid;"
```

Should show active session with future expires_at.

---

## 📊 Progress Summary

### ✅ Completed:
- [x] Database migration (qc_ai_logs table)
- [x] Edge Function created (5 TypeScript files)
- [x] Frontend integration (api.ts updated)
- [x] Error messages improved
- [x] **Auth fix applied (custom session tokens)**
- [x] Build successful
- [x] Git committed (4 commits total)

### ⏳ Pending (User Action):
- [ ] Restart Edge Function (Terminal 1)
- [ ] Refresh browser (Cmd+Shift+R)
- [ ] Test AI extraction
- [ ] Verify results

---

## 🎯 Success Criteria

After testing, you should see:
- ✅ No "Sesi login habis" error
- ✅ AI extraction works
- ✅ Form auto-fills with extracted data
- ✅ Toast shows success message
- ✅ Data logged in qc_ai_logs table
- ✅ Remaining scans decremented to 19

---

## 📚 Technical Details

### What Changed:

**Before (Broken):**
```typescript
// Edge Function tried to use Supabase's built-in auth
const { data: { user }, error } = await supabaseClient.auth.getUser();
// This failed because we use custom session tokens
```

**After (Fixed):**
```typescript
// Edge Function now queries our custom sessions table
const { data: session } = await supabaseClient
  .from('sessions')
  .select('token, user_id, expires_at, profiles:user_id(...)')
  .eq('token', sessionToken)
  .single();

// Validates expiry and user status
// Extracts user info from profiles join
```

### Why This Works:

1. **Custom Auth System:** We use `sessions` table with UUID tokens
2. **Not Supabase Auth:** We don't use Supabase's built-in JWT auth
3. **Direct Query:** Edge Function now queries our custom table
4. **Proper Validation:** Checks expiry, user active status

---

## 🚀 Next Steps After Success

1. **Test Rate Limiting:**
   - Make 20 AI scans
   - 21st should fail with rate limit error

2. **Test Error Handling:**
   - Upload blurry image
   - Should show "AI extraction gagal"

3. **Verify Logging:**
   - Check qc_ai_logs table
   - Should have all requests logged

4. **Production Deployment (Future):**
   - Deploy Edge Function to Supabase Cloud
   - Set production Gemini API key
   - Update frontend .env

---

## 📞 Need Help?

If still not working after restart:
1. Copy error message from Terminal 1
2. Copy error from Browser Console (F12)
3. Share both for debugging

---

**Last Updated:** 2026-05-11 17:30 WIB  
**Status:** Auth fix applied, ready for testing  
**Action Required:** Restart Edge Function + Test
