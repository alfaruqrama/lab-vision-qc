# Manual Testing Guide - Auth Security Fixes

## ✅ Changes Made

1. **Removed DEV_BYPASS_AUTH** - No more auto-login in development
2. **Removed localStorage fallback** - Force logout if server validation fails
3. **Fixed memory leak** - Proper interval cleanup with useRef
4. **Stricter error handling** - Network errors now force logout

---

## 🧪 Test Cases

### Test 1: Normal Login Flow
**Expected:** User harus login dengan credentials valid

1. Open http://localhost:8080/
2. Should redirect to `/login` (no auto-login)
3. Enter valid credentials
4. Should redirect to dashboard after successful login

**Status:** ⏳ PENDING - Need GAS URL configured

---

### Test 2: Invalid Token Bypass Attempt
**Expected:** Force logout if token invalid

1. Login successfully
2. Open DevTools → Application → Local Storage
3. Find key `portal-lab-auth`
4. Edit `token` field to invalid value (e.g., "fake-token-123")
5. Refresh page
6. **Expected:** Should force logout and redirect to `/login`
7. **Before fix:** Would use cached localStorage (SECURITY RISK!)

**Status:** ⏳ PENDING - Need to test after GAS configured

---

### Test 3: Server Validation Failure
**Expected:** Force logout if server unreachable

1. Login successfully
2. Stop GAS server or set invalid GAS URL
3. Wait 60 seconds (periodic validation interval)
4. **Expected:** Should force logout and redirect to `/login`
5. **Before fix:** Would skip validation and continue (SECURITY RISK!)

**Status:** ⏳ PENDING - Need to test after GAS configured

---

### Test 4: Session Timeout
**Expected:** Force logout after session expires

1. Login successfully
2. Wait for session timeout (default: 8 hours)
3. Try to navigate or refresh
4. **Expected:** Should force logout and redirect to `/login`

**Status:** ⏳ PENDING - Can simulate by editing `loginAt` timestamp

---

### Test 5: Memory Leak Check
**Expected:** No memory leak from interval

1. Login successfully
2. Open DevTools → Performance → Memory
3. Take heap snapshot
4. Wait 5 minutes
5. Take another heap snapshot
6. **Expected:** Memory usage should be stable (no growing intervals)
7. **Before fix:** Intervals would accumulate on re-renders

**Status:** ⏳ PENDING - Need to test with Performance tools

---

## 🔧 Current Blockers

### Missing GAS URL Configuration

The app needs `VITE_GAS_AUTH_URL` to be configured:

```bash
# Create .env file
cp .env.example .env

# Edit .env and add your GAS URL
VITE_GAS_AUTH_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
```

**Without GAS URL:**
- Login will fail with "URL server belum dikonfigurasi"
- Cannot test server validation
- Cannot test token validation

---

## 🎯 Quick Test (Without GAS)

You can test the UI flow without GAS:

1. Open http://localhost:8080/
2. Should see login page (no auto-login bypass)
3. Try to access protected routes directly:
   - http://localhost:8080/dashboard
   - http://localhost:8080/input-qc
4. **Expected:** Should redirect to `/login`

---

## 📊 Verification Checklist

- [ ] No DEV_BYPASS_AUTH in code
- [ ] No localStorage fallback on validation failure
- [ ] useRef used for interval management
- [ ] Proper cleanup in useEffect
- [ ] Force logout on network errors
- [ ] TypeScript compilation: 0 errors
- [ ] Build successful
- [ ] Dev server running on port 8080

---

## 🚀 Next Steps

1. **Configure GAS URL** in `.env`
2. **Test login flow** with valid credentials
3. **Test security fixes** (invalid token, server failure)
4. **Continue Phase 1.1** - Add CSRF protection
5. **Continue Phase 1.2** - Integrate validation to API layer

---

## 📝 Notes

- Server is running at: http://localhost:8080/
- Build output: `dist/` directory
- Logs: `/tmp/vite-dev.log`
- All auth flows now require GAS validation (no bypass)
