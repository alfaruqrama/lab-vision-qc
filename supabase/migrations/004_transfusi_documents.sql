-- Migration: Transfusion Document Archive (Simplified)
-- Module: Digitalisasi Pemberkasan Transfusi Darah
-- MVP: Scan dokumen → PDF → Google Drive (nama, RM, tanggal permintaan)

create table if not exists transfusion_documents (
  id uuid primary key default gen_random_uuid(),
  patient_name text,
  medical_record_number text,
  request_date date not null default current_date,
  notes text,
  drive_file_id text,
  drive_url text,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Indexes for common search patterns
create index if not exists idx_transfusi_patient on transfusion_documents(patient_name);
create index if not exists idx_transfusi_request_date on transfusion_documents(request_date desc);
create index if not exists idx_transfusi_rm on transfusion_documents(medical_record_number);
