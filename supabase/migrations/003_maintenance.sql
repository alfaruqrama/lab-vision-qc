-- ============================================================================
-- Lab Vision QC - Maintenance Module Migration
-- ============================================================================
-- Migrates maintenance checklists and uji fungsi from Google Sheets to Supabase.
-- Tables: maintenance_records, uji_fungsi_records, laporan_validasi
-- ============================================================================

-- ─── Maintenance Records (Daily/Weekly/Monthly/As-Needed Checklists) ──────────

create table maintenance_records (
  id text primary key,
  alat text not null,
  tipe text not null,
  tanggal date not null,
  aktivitas jsonb not null default '{}',
  catatan jsonb not null default '{}',
  catatan_umum text,
  petugas text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

comment on table maintenance_records is 'Checklist maintenance harian, mingguan, bulanan, dan insidental';
comment on column maintenance_records.aktivitas is 'Key-value pairs: nama aktivitas -> boolean (checked/unchecked)';
comment on column maintenance_records.catatan is 'Key-value pairs: nama aktivitas -> catatan teks';

-- Indexes for common queries
create index idx_mr_alat on maintenance_records(alat);
create index idx_mr_tipe on maintenance_records(tipe);
create index idx_mr_tanggal on maintenance_records(tanggal);
create index idx_mr_alat_tanggal_tipe on maintenance_records(alat, tanggal, tipe);

-- ─── Uji Fungsi Records ───────────────────────────────────────────────────────

create table uji_fungsi_records (
  id text primary key,
  alat text not null,
  tanggal date not null,
  fungsi text not null check (fungsi in ('baik', 'rusak')),
  petugas text,
  keterangan text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

comment on table uji_fungsi_records is 'Catatan uji fungsi alat medis per hari';

-- Indexes for common lookups
create index idx_ufr_alat on uji_fungsi_records(alat);
create index idx_ufr_tanggal on uji_fungsi_records(tanggal);
create index idx_ufr_alat_tanggal on uji_fungsi_records(alat, tanggal);

-- ─── Laporan Validasi ──────────────────────────────────────────────────────────

create table laporan_validasi (
  id text primary key,
  alat text not null,
  tipe text not null,
  bulan text not null,
  pic_alat text,
  ka_lab text,
  updated_at timestamptz default now()
);

comment on table laporan_validasi is 'Laporan validasi maintenance per alat per bulan dengan tanda tangan PIC';

-- Indexes
create index idx_lv_alat_bulan on laporan_validasi(alat, bulan);

-- ─── Row Level Security ────────────────────────────────────────────────────────

-- NOTE: RLS DISABLED following project convention.
-- Uncomment and adapt for production deployment.

-- alter table maintenance_records enable row level security;
-- alter table uji_fungsi_records enable row level security;
-- alter table laporan_validasi enable row level security;
