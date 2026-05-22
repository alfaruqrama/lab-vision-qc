# 🔍 Diagnostic Steps - "Sesi login habis" Error

## Current Status
- ✅ Edge Function restarted
- ✅ Code updated with auth fix
- ✅ Build successful
- ❌ Still showing "Sesi login habis" error

## 🧪 Diagnostic Test

### Step 1: Check Browser Console

1. **Open Browser Console:**
   - Press `F12` or `Cmd+Option+I`
   - Go to **Console** tab

2. **Refresh page:**
   - Press `Cmd+Shift+R`

3. **Upload image and watch console**

**Look for these log messages:**
```
[AI] Session token: bd9a0491...
[AI] Calling Edge Function: http://127.0.0.1:54321/functions/v1/extract-qc
[AI] Image size: XXXXX chars
[AI] Response status: 401 or 200
[AI] Response: {...}
```

### Step 2: Check What Token Browser Has

**In Browser Console, type:**
```javascript
localStorage.getItem('session_token')
```

**Expected:** Should show a UUID like `bd9a0491-0884-4a20-83e4-f450c2b99127`

**Valid tokens in database:**
- `bd9a0491-0884-4a20-83e4-f450c2b99127` (expires 14:46 WIB)
- `dd0caa32-7f4e-4d3e-bc67-2520db62bc77` (expires 13:17 WIB)

### Step 3: If Token is Wrong/Expired

**Clear and re-login:**
```javascript
// In browser console
localStorage.clear();
location.reload();
```

Then login again as **rama** / **admin123**

### Step 4: Check Edge Function Logs

**In Terminal 1 (Edge Function), look for:**
```
[timestamp] Incoming request...
[timestamp] Session token: bd9a0491...
[timestamp] Session query result: {...}
[timestamp] Error: Invalid or expired session
```

---

## 🎯 Most Likely Issues

### Issue 1: Browser Has Old Token
**Symptom:** localStorage has expired token  
**Fix:** Clear localStorage and re-login

### Issue 2: Edge Function Not Reloaded
**Symptom:** No logs in Terminal 1  
**Fix:** Ctrl+C and restart Edge Function

### Issue 3: Session Token Format Mismatch
**Symptom:** Edge Function can't find session  
**Fix:** Check if token in localStorage matches database

---

## 📊 Quick Checks

### Check 1: Is Edge Function Running?
```bash
ps aux | grep "supabase functions serve" | grep -v grep
```
Should show process running.

### Check 2: Are Sessions Valid?
```bash
./scripts/check-session.sh
```
Should show 2 valid sessions.

### Check 3: Can We Query Session?
```bash
# Replace TOKEN with actual token from localStorage
docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -c "
SELECT token, expires_at > NOW() as valid 
FROM sessions 
WHERE token = 'bd9a0491-0884-4a20-83e4-f450c2b99127'::uuid;
"
```

---

## 🚀 Action Plan

1. **Open browser console** (F12)
2. **Check session token:**
   ```javascript
   localStorage.getItem('session_token')
   ```
3. **If token is wrong:**
   ```javascript
   localStorage.clear();
   location.reload();
   ```
4. **Login again** (rama / admin123)
5. **Try AI extraction**
6. **Report console logs**

---

## 📞 What to Report

Please share:
1. **Browser console logs** (the [AI] messages)
2. **Session token from localStorage** (first 8 chars)
3. **Edge Function terminal output** (when you upload)
4. **Exact error message**

This will help identify the exact issue!
