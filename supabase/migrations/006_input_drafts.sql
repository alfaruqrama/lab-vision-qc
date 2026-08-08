-- Input Drafts — simpan draft input harian ke Supabase untuk shift handoff
-- Shift siang (12:00) & malam (00:00) bisa share progress via tabel ini
create table input_drafts (
  id text primary key,                  -- 'draft-{tanggal}' (deterministic)
  tanggal text not null,                -- ISO date YYYY-MM-DD
  kunjungan jsonb not null default '[]',
  mcu jsonb not null default '[]',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_input_drafts_tanggal on input_drafts(tanggal);
