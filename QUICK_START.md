# Quick Start - AI Extraction

## Start Services

### 1. Edge Function
```bash
cd /Users/rama/ramscl_workspace/lab-vision-qc-supabase
supabase functions serve extract-qc --env-file supabase/.env --no-verify-jwt
```

**Important:** The `--no-verify-jwt` flag is required to bypass JWT validation for custom session tokens.

### 2. Dev Server
```bash
cd /Users/rama/ramscl_workspace/lab-vision-qc-supabase
npm run dev
```

## Test

1. Open http://localhost:8080 (or 8081 if port in use)
2. Login with username/password
3. Go to Input QC page
4. Click "Scan dengan AI"
5. Upload struk image
6. Check browser console (F12) for logs

## Verify

```bash
# Check Edge Function logs
tail -f /tmp/edge-function.log

# Check database logs
supabase db query "SELECT * FROM qc_ai_logs ORDER BY request_timestamp DESC LIMIT 5;"

# Check remaining scans
supabase db query "SELECT get_remaining_ai_scans('USER_ID'::uuid, 20);"
```

## Architecture

```
Frontend (api.ts)
  ↓ POST { imageBase64, sessionToken }
Edge Function (--no-verify-jwt)
  ↓ Validate session token
  ↓ Check rate limit
  ↓ Call Gemini API
  ↓ Log to database
Response { success, data, remaining_scans }
```

## Key Files

- `src/lib/api.ts` - Frontend API calls
- `supabase/functions/extract-qc/index.ts` - Edge Function
- `supabase/.env` - Gemini API key
- `TESTING_STATUS.md` - Full testing guide
