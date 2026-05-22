# Database Access Guide

Panduan lengkap untuk melihat dan mengelola data QC di Supabase.

---

## 📊 Option 1: Supabase Studio (GUI - Recommended)

### Access
```
http://127.0.0.1:54323
```

### Features
- ✅ Visual table editor
- ✅ Filter & search data
- ✅ Edit data inline
- ✅ Export to CSV
- ✅ SQL query editor
- ✅ Real-time updates

### Steps
1. Buka browser → `http://127.0.0.1:54323`
2. Klik **"Table Editor"** di sidebar kiri
3. Pilih table:
   - **`profiles`** - User accounts (28 users)
   - **`sessions`** - Active login sessions
   - **`qc_records`** - QC data (45+ records)
   - **`lot_config`** - Lot configuration (1 row)
4. View/edit data langsung di GUI
5. Filter, sort, search available

### Screenshots
- Table Editor: Browse all records
- SQL Editor: Run custom queries
- Filters: Search by date, instrument, status

---

## 💻 Option 2: psql CLI (Terminal)

### Connect to Database
```bash
# Connect via Docker
docker exec -it supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres

# Once connected:
\dt                          # List all tables
\d qc_records               # Describe qc_records table
SELECT * FROM qc_records;   # View all QC records
\q                          # Quit
```

### Common Queries

#### Count Total QC Records
```sql
SELECT COUNT(*) FROM qc_records;
```

#### View Latest 10 Records
```sql
SELECT id, tanggal, alat, level, analis, created_at 
FROM qc_records 
ORDER BY created_at DESC 
LIMIT 10;
```

#### Count by Instrument
```sql
SELECT alat, COUNT(*) 
FROM qc_records 
GROUP BY alat 
ORDER BY alat;
```

#### View Today's Records
```sql
SELECT * FROM qc_records 
WHERE tanggal = CURRENT_DATE;
```

#### View Warning/OOC Records
```sql
SELECT id, tanggal, alat, level, params, status 
FROM qc_records 
WHERE status::text LIKE '%warning%' 
   OR status::text LIKE '%oos%'
ORDER BY created_at DESC;
```

#### View Records by Date Range
```sql
SELECT tanggal, alat, level, COUNT(*) 
FROM qc_records 
WHERE tanggal BETWEEN '2026-05-01' AND '2026-05-10'
GROUP BY tanggal, alat, level
ORDER BY tanggal DESC;
```

#### View Lot Config
```sql
SELECT id, updated_at, updated_by, 
       jsonb_object_keys(config) as instrument
FROM lot_config;
```

#### View All Users
```sql
SELECT id, username, nama, role, is_active, created_at
FROM profiles
ORDER BY role, nama;
```

#### View Active Sessions
```sql
SELECT s.id, s.user_id, p.username, p.nama, s.created_at
FROM sessions s
JOIN profiles p ON s.user_id = p.id
ORDER BY s.created_at DESC;
```

---

## ⚡ Option 3: One-liner Queries (Quick Check)

### From Terminal (without entering psql)

#### Count QC Records
```bash
echo "SELECT COUNT(*) FROM qc_records;" | docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -t
```

#### View Latest 5 Records
```bash
echo "SELECT tanggal, alat, level, analis FROM qc_records ORDER BY created_at DESC LIMIT 5;" | docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres
```

#### Count by Instrument
```bash
echo "SELECT alat, COUNT(*) FROM qc_records GROUP BY alat;" | docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres
```

#### View Lot Config
```bash
echo "SELECT id, updated_at, updated_by FROM lot_config;" | docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres
```

---

## 🛠️ Option 4: Helper Script (Recommended for Frequent Use)

### Create Script

**File:** `scripts/view-qc-data.sh`

```bash
#!/bin/bash
# Quick QC data viewer

echo "=== QC Records Summary ==="
echo ""

echo "Total Records:"
echo "SELECT COUNT(*) FROM qc_records;" | docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -t

echo ""
echo "By Instrument:"
echo "SELECT alat, COUNT(*) FROM qc_records GROUP BY alat ORDER BY alat;" | docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres

echo ""
echo "Latest 10 Records:"
echo "SELECT tanggal, alat, level, analis, created_at FROM qc_records ORDER BY created_at DESC LIMIT 10;" | docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres

echo ""
echo "Warning/OOC Records:"
echo "SELECT COUNT(*) FROM qc_records WHERE status::text LIKE '%warning%' OR status::text LIKE '%oos%';" | docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres -t

echo ""
echo "By Date (Last 7 Days):"
echo "SELECT tanggal, COUNT(*) FROM qc_records WHERE tanggal >= CURRENT_DATE - INTERVAL '7 days' GROUP BY tanggal ORDER BY tanggal DESC;" | docker exec -i supabase_db_lab-vision-qc-supabase psql -U postgres -d postgres
```

### Usage
```bash
# Make executable
chmod +x scripts/view-qc-data.sh

# Run
./scripts/view-qc-data.sh
```

---

## 📋 Database Schema

### `qc_records` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key (UUID) |
| `timestamp` | timestamptz | Record creation timestamp |
| `tanggal` | date | QC date (ISO format: YYYY-MM-DD) |
| `alat` | text | Instrument (CA660, EASYLITE, ONCALL1, ONCALL2) |
| `level` | text | Control level (Kontrol, NORMAL, HIGH, CTRL0, CTRL1, CTRL2) |
| `lot` | text | Lot number |
| `params` | jsonb | Parameter values (PT, APTT, INR, Na, K, Cl, GDA) |
| `status` | jsonb | Westgard status per parameter (ok, warning, oos) |
| `analis` | text | Analyst name |
| `catatan` | text | Notes/corrective actions |
| `created_by` | uuid | User ID (FK to profiles) |
| `created_at` | timestamptz | Auto-generated timestamp |

### `lot_config` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | bigserial | Primary key |
| `config` | jsonb | Lot configuration (all instruments) |
| `updated_at` | timestamptz | Last update timestamp |
| `updated_by` | uuid | User ID (FK to profiles) |

### `profiles` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `username` | text | Login username (unique, case-insensitive) |
| `nama` | text | Full name |
| `role` | text | User role (admin, petugas, viewer) |
| `password_hash` | text | bcrypt hash |
| `is_active` | boolean | Account status |
| `created_at` | timestamptz | Account creation timestamp |

### `sessions` Table
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Session token (primary key) |
| `user_id` | uuid | User ID (FK to profiles) |
| `created_at` | timestamptz | Login timestamp |

---

## 🔍 Advanced Queries

### Find Records with Specific Status
```sql
-- All OOC records
SELECT tanggal, alat, level, params, status
FROM qc_records
WHERE status::jsonb ? 'oos'
ORDER BY tanggal DESC;

-- All warning records
SELECT tanggal, alat, level, params, status
FROM qc_records
WHERE status::jsonb ? 'warning'
ORDER BY tanggal DESC;
```

### Calculate Monthly Statistics
```sql
SELECT 
  DATE_TRUNC('month', tanggal) as month,
  alat,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE status::text LIKE '%oos%') as oos_count,
  COUNT(*) FILTER (WHERE status::text LIKE '%warning%') as warning_count
FROM qc_records
GROUP BY month, alat
ORDER BY month DESC, alat;
```

### Find Records by Analyst
```sql
SELECT analis, COUNT(*) as total_records
FROM qc_records
GROUP BY analis
ORDER BY total_records DESC;
```

### Export Data to CSV (from psql)
```sql
\copy (SELECT * FROM qc_records WHERE tanggal >= '2026-05-01') TO '/tmp/qc_records_may.csv' CSV HEADER;
```

---

## 🚨 Troubleshooting

### Database Not Running
```bash
# Check status
docker ps --filter "name=supabase_db"

# Restart if unhealthy
docker restart supabase_db_lab-vision-qc-supabase
```

### Connection Refused
```bash
# Check if port 54321 is available
lsof -i :54321

# Restart Supabase
cd /Users/rama/ramscl_workspace/lab-vision-qc-supabase
supabase stop
supabase start
```

### Supabase Studio Not Loading
```bash
# Check Studio container
docker ps --filter "name=supabase_studio"

# Restart Studio
docker restart supabase_studio_lab-vision-qc-supabase
```

---

## 📚 Resources

- **Supabase Docs:** https://supabase.com/docs
- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **psql Commands:** https://www.postgresql.org/docs/current/app-psql.html

---

## 🔐 Security Notes

- **Local Development Only:** This guide is for local Supabase instance
- **Production:** Use Supabase Dashboard (cloud) or service role key
- **RLS Disabled:** Row Level Security disabled for local dev
- **Passwords:** Never query `password_hash` in production logs
