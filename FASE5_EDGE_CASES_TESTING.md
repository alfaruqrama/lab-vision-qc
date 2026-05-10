# Fase 5: Edge Cases & Error Handling Testing

**Date:** 2026-05-10  
**Tester:** rama  
**Environment:** Local dev (http://localhost:5174)  
**Database:** Supabase local

---

## Test 5.1: Empty State Handling

### Test Case 5.1.1: Dashboard with No Records

**Steps:**
1. Delete all QC records:
   ```sql
   DELETE FROM qc_records;
   ```
2. Navigate to `/qc`
3. Refresh page

**Expected:**
- ✅ Stats show: Total QC = 0, In-Control = 0, Peringatan = 0, Diluar Kendali = 0
- ✅ "Status QC Hari Ini" shows empty state message
- ✅ No errors in console
- ✅ Page renders gracefully (no broken UI)

---

### Test Case 5.1.2: Levey-Jennings Chart with No Data

**Steps:**
1. Navigate to `/qc/chart`
2. Select CA660 → PT → Kontrol

**Expected:**
- ✅ Chart shows empty state message: "Belum ada data untuk parameter ini"
- ✅ Stats panel shows: n = 0, Mean = -, SD = -, CV = -
- ✅ No chart rendering errors

---

### Test Case 5.1.3: Monthly Report with No Data

**Steps:**
1. Navigate to `/qc/report`
2. Select a future month (e.g., June 2026)

**Expected:**
- ✅ Table shows empty state message
- ✅ Export buttons disabled or hidden
- ✅ No errors

---

## Test 5.2: Invalid Data Handling

### Test Case 5.2.1: Corrupted Lot Config

**Steps:**
1. Manually corrupt lot config in database:
   ```sql
   UPDATE lot_config SET config = '{"invalid": "json"}'::jsonb WHERE id = 3;
   ```
2. Navigate to `/qc/config`
3. Refresh page

**Expected:**
- ✅ Page shows error message or falls back to DEFAULT_LOT_CONFIG
- ✅ No white screen of death
- ✅ Console shows error but app doesn't crash

**Cleanup:**
```sql
-- Restore valid config
DELETE FROM lot_config WHERE id = 3;
-- Re-run seed script
node scripts/seed-lot-config.cjs
```

---

### Test Case 5.2.2: Missing Lot Config

**Steps:**
1. Delete lot config:
   ```sql
   DELETE FROM lot_config;
   ```
2. Navigate to `/qc/config`

**Expected:**
- ✅ Page shows DEFAULT_LOT_CONFIG (fallback)
- ✅ User can still input QC using default config
- ✅ No errors

---

### Test Case 5.2.3: QC Record with Missing Fields

**Steps:**
1. Manually insert incomplete record:
   ```sql
   INSERT INTO qc_records (id, timestamp, tanggal, alat, level, lot, params, status, analis, created_by)
   VALUES (
     gen_random_uuid()::text,
     NOW(),
     '2026-05-10',
     'CA660',
     'Kontrol',
     'CA-2024-001',
     '{}'::jsonb,  -- Empty params
     '{}'::jsonb,  -- Empty status
     'test',
     'ba98d317-ae71-4138-9df8-07cf0480bd7d'
   );
   ```
2. Navigate to `/qc`

**Expected:**
- ✅ Dashboard renders without crashing
- ✅ Record with empty params handled gracefully
- ✅ StatusBadge doesn't crash on missing status

**Cleanup:**
```sql
DELETE FROM qc_records WHERE analis = 'test';
```

---

## Test 5.3: Date Edge Cases

### Test Case 5.3.1: Records from Different Months

**Steps:**
1. Insert records from previous month:
   ```sql
   INSERT INTO qc_records (id, timestamp, tanggal, alat, level, lot, params, status, analis, created_by)
   VALUES (
     gen_random_uuid()::text,
     '2026-04-15 08:00:00+00',
     '2026-04-15',
     'CA660',
     'Kontrol',
     'CA-2024-001',
     '{"PT": 12.5}'::jsonb,
     '{"PT": "ok"}'::jsonb,
     'rama',
     'ba98d317-ae71-4138-9df8-07cf0480bd7d'
   );
   ```
2. Navigate to `/qc` (current month: May)

**Expected:**
- ✅ Dashboard only shows May records
- ✅ April record not included in stats
- ✅ Monthly report can switch to April and see the record

---

### Test Case 5.3.2: Future Date Records

**Steps:**
1. Try to input QC with future date (if date picker allows)
2. Or manually insert:
   ```sql
   INSERT INTO qc_records (id, timestamp, tanggal, alat, level, lot, params, status, analis, created_by)
   VALUES (
     gen_random_uuid()::text,
     '2026-06-01 08:00:00+00',
     '2026-06-01',
     'CA660',
     'Kontrol',
     'CA-2024-001',
     '{"PT": 12.5}'::jsonb,
     '{"PT": "ok"}'::jsonb,
     'rama',
     'ba98d317-ae71-4138-9df8-07cf0480bd7d'
   );
   ```
3. Navigate to `/qc`

**Expected:**
- ✅ Future record not shown in current month dashboard
- ✅ Can be viewed in June monthly report

---

## Test 5.4: Large Dataset Performance

### Test Case 5.4.1: Dashboard with 1000+ Records

**Steps:**
1. Generate large dataset:
   ```bash
   node scripts/seed-qc-records.cjs 100  # 100 days = ~450 records
   ```
2. Navigate to `/qc`

**Expected:**
- ✅ Page loads within 2 seconds
- ✅ Stats calculated correctly
- ✅ No performance degradation
- ✅ No browser freeze

---

### Test Case 5.4.2: Levey-Jennings Chart with 100+ Points

**Steps:**
1. With large dataset from 5.4.1
2. Navigate to `/qc/chart`
3. Select CA660 → PT

**Expected:**
- ✅ Chart renders all points
- ✅ X-axis labels readable (may be rotated or sampled)
- ✅ No performance issues
- ✅ Zoom/pan works (if implemented)

---

## Test 5.5: Browser Compatibility

### Test Case 5.5.1: Test in Chrome

**Steps:**
1. Open http://localhost:5174 in Chrome
2. Run all Fase 3-4 tests

**Expected:**
- ✅ All features work
- ✅ No console errors

---

### Test Case 5.5.2: Test in Firefox

**Steps:**
1. Open http://localhost:5174 in Firefox
2. Run critical tests (Dashboard, Input QC, Chart)

**Expected:**
- ✅ All features work
- ✅ No console errors

---

### Test Case 5.5.3: Test in Safari

**Steps:**
1. Open http://localhost:5174 in Safari
2. Run critical tests

**Expected:**
- ✅ All features work
- ✅ No console errors

---

## Test 5.6: Session & Auth Edge Cases

### Test Case 5.6.1: Session Expiry During Input

**Steps:**
1. Login as `rama`
2. Navigate to `/qc/input`
3. Fill in QC record
4. Wait for session to expire (or manually delete session token from localStorage)
5. Click **Simpan**

**Expected:**
- ✅ Toast error: "Session expired. Please login again."
- ✅ Redirected to `/login`
- ✅ Form data preserved in localStorage (optional)

---

### Test Case 5.6.2: Concurrent Login from Different Devices

**Steps:**
1. Login as `rama` in Browser 1
2. Login as `rama` in Browser 2 (different session)
3. Input QC in Browser 1
4. Input QC in Browser 2

**Expected:**
- ✅ Both sessions work independently
- ✅ Both records saved successfully
- ✅ No session conflicts

---

### Test Case 5.6.3: Invalid Token

**Steps:**
1. Login as `rama`
2. Manually edit `auth_token` in localStorage to invalid value
3. Refresh page

**Expected:**
- ✅ Redirected to `/login`
- ✅ Toast: "Invalid session. Please login again."

---

## Test 5.7: Supabase Connection Issues

### Test Case 5.7.1: Supabase DB Down

**Steps:**
1. Stop Supabase DB:
   ```bash
   docker stop supabase_db_lab-vision-qc-supabase
   ```
2. Navigate to `/qc`
3. Try to input QC

**Expected:**
- ✅ Toast error: "Database connection error"
- ✅ App falls back to demo mode (localStorage)
- ✅ Or shows error message with retry button

**Cleanup:**
```bash
docker start supabase_db_lab-vision-qc-supabase
```

---

### Test Case 5.7.2: Slow Network (3G)

**Steps:**
1. Open DevTools → Network tab
2. Throttle to "Slow 3G"
3. Navigate to `/qc`
4. Input QC record

**Expected:**
- ✅ Loading indicators shown
- ✅ Page doesn't freeze
- ✅ Record saved successfully (may take longer)
- ✅ User feedback during loading

---

## Test 5.8: Data Integrity

### Test Case 5.8.1: Duplicate Record Prevention

**Steps:**
1. Input QC record
2. Immediately click **Simpan** again (double-click)

**Expected:**
- ✅ Only one record saved
- ✅ Button disabled during save
- ✅ No duplicate records in database

---

### Test Case 5.8.2: Concurrent Config Updates

**Steps:**
1. Open `/qc/config` in two browser windows
2. Update CA660 config in Window 1
3. Update CA660 config in Window 2 (different values)
4. Save both

**Expected:**
- ✅ Last save wins (optimistic locking not required for MVP)
- ✅ Or conflict detection with merge UI
- ✅ No data corruption

---

## Pass Criteria

Fase 5 dianggap **PASS** jika:

- ✅ Empty states handled gracefully
- ✅ Invalid data doesn't crash app
- ✅ Date edge cases work correctly
- ✅ Performance acceptable with large datasets
- ✅ Works in Chrome, Firefox, Safari
- ✅ Session expiry handled
- ✅ Network errors handled
- ✅ Data integrity maintained

---

## Test Results

### Empty State Handling
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Invalid Data Handling
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Date Edge Cases
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Performance
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Browser Compatibility
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Session & Auth
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Network Issues
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

### Data Integrity
- [ ] PASS
- [ ] FAIL
- Notes: _______________________________________________

---

## Issues Found

| # | Category | Issue | Severity | Status |
|---|----------|-------|----------|--------|
| 1 |          |       |          |        |
| 2 |          |       |          |        |

---

## Sign-off

- [ ] All critical edge cases tested
- [ ] All issues documented
- [ ] Ready for production deployment

**Tester:** ________________  
**Date:** ________________  
**Time:** ________________
