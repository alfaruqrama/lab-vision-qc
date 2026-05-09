# GAS QC Backend — Planning Document

> Status: **AWAITING ANSWERS** — Dibuat 2026-05-09
> Lanjutkan besok setelah menjawab pertanyaan di Section 3.

---

## 📊 Context Summary

| Item | Status | Detail |
|------|--------|--------|
| PR #26 | ✅ Merged | 24 security fixes + 166 tests |
| Google Sheet | ✅ Exists | `1hB6rqKbV1WLE4CpN94T3kEYF_eDG0OCt4nmFhODzCzk` |
| Sheet Name | ✅ Known | "database QC" |
| GAS Code | ❌ Not yet | Needs to be created |
| Lot Config UI | ✅ In PR #26 | Needs user validation |
| Data Migration | ✅ Decided | Start fresh |
| Access Control | ✅ Decided | Token-based auth (see Section 2) |
| Deliverable | ✅ Decided | Markdown file (GAS_QC_CODE.md) |

---

## 🏗️ Implementation Plan

### Phase 1: Sheet Structure Verification (5 min)
- Inspect Sheet `1hB6rqKbV1WLE4CpN94T3kEYF_eDG0OCt4nmFhODzCzk`
- Confirm sheet names and column structure
- Document any discrepancies vs expected structure

### Phase 2: GAS Code Development (30 min)
Files to create:
- `GAS_QC_CODE.md` — complete script, copy-paste ready
- `GAS_QC_SETUP.md` — deployment guide

### Phase 3: Frontend Integration Check (10 min)
- Verify `useAuth()` exposes token
- Update `src/lib/api.ts` to pass token in requests if needed

### Phase 4: Documentation (15 min)
- Testing checklist
- Troubleshooting guide

**Total: ~60 min after answers received**

---

## 🔐 Access Control Decision

**Chosen: Token-Based Auth (reuse existing auth system)**

Rationale:
- Auth system already exists (`GAS_AUTH_DOCUMENTATION.md`)
- QC data is sensitive (medical lab data)
- Need to track `petugas` (who entered data)
- Lot config editing needs admin validation
- Audit trail for compliance

Implementation approach:
- Frontend sends `token` in every POST request
- GAS validates token against Users sheet
- Extracts `username` and `role` from token
- Auto-populates `petugas` from authenticated user
- Checks `role` for lot config edits (admin only)

---

## 📁 Deliverable Format

**Chosen: Markdown files only (no PR)**

Files to create:
```
GAS_QC_CODE.md       ← Complete GAS script (copy-paste ready)
GAS_QC_SETUP.md      ← Step-by-step deployment guide
```

---

## 🗂️ Expected Sheet Structure

### QC Records Sheet
| Col | Field | Type | Notes |
|-----|-------|------|-------|
| A | id | string | UUID |
| B | tanggal | string | YYYY-MM-DD |
| C | alat | string | Sheets display name |
| D | lot | string | Lot number |
| E | level | string | L1 or L2 |
| F | nilai | number | Measured value |
| G | mean | number | Target mean |
| H | sd | number | Standard deviation |
| I | cv | number | Coefficient of variation |
| J | status | string | ok / warn / ooc |
| K | rules | string | Comma-separated Westgard rules |
| L | petugas | string | Username from auth |
| M | catatan | string | Optional notes |

### Lot Config Sheet
| Col | Field | Type | Notes |
|-----|-------|------|-------|
| A | alat | string | Sheets display name |
| B | lot | string | Lot number |
| C | level | string | L1 or L2 |
| D | mean | number | Target mean |
| E | sd | number | Standard deviation |
| F | cv | number | Coefficient of variation |
| G | expiry | string | YYYY-MM-DD |

---

## 🔄 Data Mapping (Confirmed from api.ts)

### Instrument Names
| React Code | Sheets Display |
|------------|---------------|
| `CA660` | `Sysmex CA-660` |
| `EASYLITE` | `Easylite` |
| `ONCALL1` | `On Call Sure 1` |
| `ONCALL2` | `On Call Sure 2` |

### Status Mapping
| React | Sheets |
|-------|--------|
| `oos` | `ooc` |
| `warning` | `warn` |
| `ok` | `ok` |

### GAS Actions Required
| Action | Method | Handler | Auth Required |
|--------|--------|---------|---------------|
| `getAll` | GET | `handleGetAll()` | ❓ |
| `getByMonth` | GET | `handleGetByMonth(month)` | ❓ |
| `getKonfig` | GET | `handleGetKonfig()` | ❓ |
| `save` | POST | `handleSave(payload)` | ✅ token |
| `saveKonfig` | POST | `handleSaveKonfig(payload)` | ✅ admin only |

---

## ❓ Questions — AWAITING ANSWERS

### Section 1: Google Sheet Structure

**1.1 Sheet Names**
- What are the exact sheet names inside "database QC"?
- If multiple sheets, which ones should GAS use?

**1.2 QC Records Sheet Columns**
- Does it already have column headers?
- If yes, what are they (A to Z in order)?
- Does the expected structure above match, or different?

**1.3 Lot Config Sheet**
- Does a Lot Config sheet exist?
- If yes, what are the column headers?
- If no, should GAS create it or you create manually first?

**1.4 Existing Data**
- Any existing data to preserve?
- Any rows to skip (summary rows, formulas)?

---

### Section 2: Authentication & Authorization

**2.1 Auth System**
- Confirm: use same auth system from `GAS_AUTH_DOCUMENTATION.md`?
- Auth spreadsheet: same sheet (`1hB6rqKbV1WLE4CpN94T3kEYF_eDG0OCt4nmFhODzCzk`) or different?
- Users sheet name: "Users" (as documented)?
- Token column: G, expiry column: H (as documented)?

**2.2 Token Storage (Frontend)**
- Where does frontend store token?
  - localStorage key name?
  - Auth context variable name?

**2.3 Role-Based Access**

For **saving QC records** (`action: save`):
- [ ] admin only
- [ ] admin + petugas
- [ ] all authenticated users

For **editing lot config** (`action: saveKonfig`):
- [ ] admin only
- [ ] admin + petugas
- [ ] all authenticated users

For **reading data** (`getAll`, `getByMonth`, `getKonfig`):
- [ ] admin only
- [ ] admin + petugas
- [ ] all authenticated users (including viewer)
- [ ] public (no auth required)

**2.4 Petugas Field**
- Auto-populate from authenticated user (recommended)?
- Or frontend sends it?

---

### Section 3: Frontend Integration

**3.1 Auth Hook**
- Does `useAuth()` expose a `token` property?
- Exact property name? (`token`, `sessionToken`, `authToken`?)
- Example: `const { user, token } = useAuth();` — is this correct?

**3.2 API Layer**
- Does `post()` in `api.ts` currently accept token?
- Should frontend changes be included in same deliverable?

---

### Section 4: Data Mapping Confirmation

**4.1 Instrument Names** — confirm table above is correct?

**4.2 Status Mapping** — confirm table above is correct?

**4.3 Rules Array Serialization**
How to store Westgard rules array in Sheet?
- [ ] Comma-separated: `"1-2s,1-3s,R-4s"`
- [ ] Semicolon-separated: `"1-2s;1-3s;R-4s"`
- [ ] JSON string: `"[\"1-2s\",\"1-3s\"]"`

**4.4 Date Format in Sheet**
- [ ] Text string `"2026-05-09"`
- [ ] Google Sheets Date object
- [ ] Timestamp (ms)

**4.5 Empty Optional Fields**
For empty `catatan`:
- [ ] Empty string `""`
- [ ] Dash `"-"`
- [ ] Leave blank

---

### Section 5: Error Handling

**5.1 Error Logging**
- [ ] Return error JSON only
- [ ] Log to Apps Script Logger
- [ ] Write to "Error Log" sheet
- [ ] Email notification to admin

**5.2 Validation Errors**
If invalid data received:
- [ ] Reject with detailed error
- [ ] Accept with defaults
- [ ] Log warning but save anyway

**5.3 Duplicate ID**
If duplicate record `id` received:
- [ ] Reject
- [ ] Overwrite existing
- [ ] Append anyway

---

### Section 6: Deployment

**6.1 Deployment URL**
Current `.env` URL — is it:
- [ ] Already deployed but empty (no code yet)
- [ ] Placeholder to be replaced after deployment

**6.2 Testing Strategy**
- [ ] Manual testing only
- [ ] cURL commands provided
- [ ] JavaScript test script
- [ ] All of above

---

### Section 7: Additional Features

**7.1 Data Export**
- [ ] Yes — add `action: export`
- [ ] No — use Sheet's built-in export
- [ ] Future enhancement

**7.2 Record Deletion**
- [ ] Yes — add `action: delete` (by ID)
- [ ] No — manual deletion in Sheet
- [ ] Future enhancement

**7.3 Bulk Save**
- [ ] Yes — `action: saveBulk`
- [ ] No — one at a time
- [ ] Future enhancement

**7.4 GAS-side Validation Rules**
- [ ] `nilai` within `mean ± 3*sd`
- [ ] `tanggal` not future date
- [ ] `lot` must exist in Lot Config
- [ ] No validation (frontend handles it)

---

### Section 8: Performance

**8.1 Expected Volume**
- QC records per day: ___
- QC records per month: ___
- Expected total after 1 year: ___

**8.2 `getAll` Behavior**
- Return ALL records?
- Limit to recent N months?
- Require date range parameter?

---

### Section 9: Maintenance

**9.1 Version Tracking**
- [ ] Version number in code comments
- [ ] Version in response JSON
- [ ] Not needed

**9.2 Changelog**
- [ ] Yes — `GAS_QC_CHANGELOG.md`
- [ ] No

**9.3 Troubleshooting Guide**
- [ ] Yes — include common errors + fixes
- [ ] No

---

## 📝 Notes & Assumptions (Pending Confirmation)

1. Auth system is shared — GAS QC will call the same Users sheet as auth GAS
2. `dompurify` and `docx` are now in `dependencies` (fixed in Vercel build)
3. PR #26 is merged — frontend QC module is live
4. `VITE_GAS_QC_URL` in `.env` needs to be set in Vercel environment variables after GAS deployment
5. Rules array will default to comma-separated unless specified otherwise
6. Date format will default to text string `"YYYY-MM-DD"` unless specified otherwise
7. Empty `catatan` will default to empty string `""` unless specified otherwise

---

## 🔗 Related Files

| File | Purpose |
|------|---------|
| `src/lib/api.ts` | Frontend API layer — calls GAS endpoints |
| `src/features/qc/hooks/useQCRecords.ts` | React Query hooks for QC data |
| `src/features/qc/hooks/useQCConfig.ts` | React Query hooks for lot config |
| `GAS_AUTH_DOCUMENTATION.md` | Existing auth GAS — reference for token validation |
| `.env` | Contains `VITE_GAS_QC_URL` |
| `.env.example` | Template for environment variables |

---

*Last updated: 2026-05-09 | Next action: Answer questions above, then proceed with GAS_QC_CODE.md*
