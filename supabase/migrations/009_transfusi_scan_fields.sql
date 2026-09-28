-- Migration: 009_transfusi_scan_fields.sql
-- Module: Digitalisasi Pemberkasan Dokumen Transfusi Darah
-- Purpose: Lengkapi metadata bank darah pada transfusion_documents
--          (produk darah, jumlah kantong, goldar+Rh, nomor kantong,
--           checklist kelengkapan berkas, asal kantong)
--
-- Catatan RLS: TIDAK diaktifkan. Aplikasi ini memakai custom session auth
-- (bcrypt + tabel sessions), BUKAN Supabase Auth. Request dari frontend masuk
-- sebagai role `anon`, sehingga policy `to authenticated` tidak akan pernah
-- cocok dan akan memblokir seluruh akses tabel. Ikuti preseden repo:
-- lihat 002_qc_ai_logs.sql yang eksplisit `DISABLE ROW LEVEL SECURITY`.

alter table public.transfusion_documents
  add column if not exists blood_product    text,
  add column if not exists bag_count        integer default 1,
  add column if not exists blood_type_rh    text,
  add column if not exists bag_number       text,
  add column if not exists inform_concern   boolean default true,
  add column if not exists surat_permintaan boolean default true,
  add column if not exists form_reaksi      boolean default true,
  add column if not exists origin           text;

-- Nilai yang diizinkan (didokumentasikan sebagai komentar; divalidasi di Edge Function)
comment on column public.transfusion_documents.blood_product is
  'Produk darah: PRC | WB | TC | FFP | PRC_LEUKOREDUCED';
comment on column public.transfusion_documents.blood_type_rh is
  'Golongan darah + Rhesus: A+ | A- | B+ | B- | AB+ | AB- | O+ | O-';
comment on column public.transfusion_documents.bag_number is
  'Nomor kantong darah. Bila lebih dari satu, dipisah koma.';
comment on column public.transfusion_documents.origin is
  'Asal kantong darah: GRESIK | SURABAYA';
comment on column public.transfusion_documents.inform_concern is
  'Checklist berkas: inform concern tersedia';
comment on column public.transfusion_documents.surat_permintaan is
  'Checklist berkas: surat permintaan darah tersedia';
comment on column public.transfusion_documents.form_reaksi is
  'Checklist berkas: form reaksi transfusi tersedia';

-- Index pencarian nomor kantong (memakai prefix match, bukan full-text)
create index if not exists idx_transfusi_bag_number
  on public.transfusion_documents(bag_number);

-- Index produk darah untuk filter dashboard
create index if not exists idx_transfusi_blood_product
  on public.transfusion_documents(blood_product);

-- RLS: sengaja dibiarkan nonaktif — lihat catatan di atas.
alter table public.transfusion_documents disable row level security;
