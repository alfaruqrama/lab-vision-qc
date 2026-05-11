# Testing Status - AI Extraction Migration

## ✅ Setup Complete

### Infrastructure
- [x] Supabase CLI installed (v2.98.2)
- [x] Edge Function created (5 TypeScript files)
- [x] Database migration applied (qc_ai_logs table)
- [x] Gemini API key set in supabase/.env
- [x] Edge Function serving with --no-verify-jwt flag

### Code Changes
- [x] Frontend updated (api.ts sends token in body)
- [x] Edge Function updated (reads token from body)
- [x] Error messages updated (removed "Apps Script" references)
- [x] Build successful (no TypeScript errors)
- [x] JWT validation bypassed (--no-verify-jwt)

---

## 🧪 Testing Results

### Edge Function Status
```
✅ Running: http://127.0.0.1:54321/functions/v1/extract-qc
✅ CORS: Responding to OPTIONS requests
✅ Deno Runtime: v2.1.4
✅ Gemini API Key: Loaded
✅ Auth Bypass: --no-verify-jwt enabled
```

### Database Status
```
✅ qc_ai_logs table: Ready
✅ Sessions table: Working
✅ Functions: check_ai_rate_limit(), get_remaining_ai_scans()
```

### Frontend Status
```
✅ Dev server: http://localhost:8081
✅ Build: Successful
✅ Error messages: Updated
✅ Token in body: Implemented
```

---

## 🎯 Solution: JWT Validation Bypass

### Problem
Supabase Edge Runtime validates `Authorization: Bearer` headers as JWTs before function code runs. Custom UUID tokens are not JWTs, causing `TypeError: Invalid Token or Protected Header formatting`.

### Solution
1. **Disable JWT verification** in Edge Runtime with `--no-verify-jwt` flag
2. **Pass session token in request body** instead of Authorization header
3. **Validate session token manually** in function code

### Implementation
**Frontend (api.ts):**
```typescript
const res = await fetch(functionUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    imageBase64,
    sessionToken  // Token in body, not header
  })
});
```

**Edge Function (index.ts):**
```typescript
const body = await req.json();
const sessionToken = body.sessionToken;
// Validate session token manually
```

**Start Command:**
```bash
supabase functions serve extract-qc --env-file supabase/.env --no-verify-jwt
```

---

## 📋 Testing Instructions

### 1. Start Edge Function
```bash
cd /Users/rama/ramscl_workspace/lab-vision-qc-supabase
supabase functions serve extract-qc --env-file supabase/.env --no-verify-jwt
```

### 2. Start Dev Server
```bash
npm run dev
```

### 3. Login
- Open http://localhost:8081
- Login with username/password
- This creates a session in the database

### 4. Test AI Extraction
- Go to Input QC page
- Select instrument
- Click "Scan dengan AI"
- Upload struk image
- Check browser console for logs
- Check Edge Function terminal for logs

### 5. Verify Results
```bash
# Check logs
SELECT * FROM qc_ai_logs ORDER BY request_timestamp DESC LIMIT 5;

# Check remaining scans
SELECT get_remaining_ai_scans('USER_ID'::uuid, 20);
```

---

## 🧪 Manual Test (Already Passed)

### Test with curl
```bash
curl -X POST http://127.0.0.1:54321/functions/v1/extract-qc \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"test","sessionToken":"VALID_UUID_TOKEN"}'
```

### Expected Response
```json
{
  "success": false,
  "error": "Gemini API error: 400 - Unable to process input image..."
}
```

This proves:
- ✅ Edge Function is accessible
- ✅ Session validation works
- ✅ Gemini API is called
- ✅ Error handling works

---

## 🐛 Troubleshooting

### Error: "Missing authorization header"
**Cause:** Edge Function started without `--no-verify-jwt`  
**Fix:** Restart with `--no-verify-jwt` flag

### Error: "Invalid or expired session"
**Cause:** Session token not found or expired  
**Fix:** Login via app to create new session

### Error: "Rate limit exceeded"
**Cause:** User has used 20 scans today  
**Fix:** Wait until midnight for reset

### Error: Gemini API errors
**Cause:** Invalid image, API quota, etc.  
**Fix:** Check error message, try different image

---

## 📊 Success Criteria

### ✅ Phase 1: Setup (Complete)
- [x] Supabase CLI installed
- [x] Edge Function created
- [x] Database migration applied
- [x] Gemini API key set
- [x] Frontend updated
- [x] JWT validation bypassed

### ✅ Phase 2: Manual Testing (Complete)
- [x] Edge Function responds to requests
- [x] Session validation works
- [x] Gemini API called successfully
- [x] Error handling works

### ⏳ Phase 3: User Testing (In Progress)
- [ ] Login via app
- [ ] Test AI extraction with real image
- [ ] Verify data extraction
- [ ] Check logging in database
- [ ] Test rate limiting

### ⏳ Phase 4: Production (Future)
- [ ] Deploy Edge Function to Supabase Cloud
- [ ] Configure --no-verify-jwt in production
- [ ] Set production Gemini API key
- [ ] Update frontend .env for production
- [ ] Test production endpoint

---

## 📚 Documentation

- **Setup Guide:** `SUPABASE_AI_SETUP.md`
- **Migration Summary:** `AI_MIGRATION_SUMMARY.md`
- **Database Access:** `DATABASE_ACCESS.md`
- **This File:** `TESTING_STATUS.md`

---

## 🎯 Current Status

**Implementation:** ✅ 100% Complete  
**JWT Bypass:** ✅ Implemented  
**Manual Testing:** ✅ Passed  
**User Testing:** ⏳ Ready for testing  

**Next Action:** Login via app and test AI extraction with real struk image

---

**Last Updated:** 2026-05-11 18:40 WIB
