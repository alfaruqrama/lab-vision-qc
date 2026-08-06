-- ============================================================================
-- Lab Vision QC - Penjamin Management Migration
-- ============================================================================
-- Migrates penjamin custom/override data from browser localStorage to Supabase.
-- Also adds 'developer' role for full penjamin management.
-- ============================================================================

-- ─── Add 'developer' Role ────────────────────────────────────────────────────

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin', 'petugas', 'viewer', 'developer'));

-- Update user rama to developer
update profiles set role = 'developer' where username = 'rama';

-- ─── Penjamin Overrides Table ────────────────────────────────────────────────

create table penjamin_overrides (
  id text primary key,                    -- client-generated: 'ov-{original_name}' or 'cu-{new_name}'
  original_name text,                     -- builtin name; NULL for custom entries
  new_name text,                          -- display name; NULL if not renamed
  badge text,                             -- badge override; NULL if not overridden
  is_custom boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table penjamin_overrides is
  'Custom penjamin entries and overrides (rename/badge) for built-in penjamin list';

-- One override row per builtin name (prevent duplicate override rows)
create unique index idx_po_original on penjamin_overrides(original_name)
  where is_custom = false;

-- Custom display names must be unique (mirrors addPenjamin dedup)
create unique index idx_po_custom_name on penjamin_overrides(new_name)
  where is_custom = true;

create index idx_po_is_custom on penjamin_overrides(is_custom);
