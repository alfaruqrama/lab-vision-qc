-- ============================================================================
-- Lab Vision QC - Initial Schema Migration
-- ============================================================================
-- Custom auth system: username + bcrypt hash + UUID token sessions
-- QC records and lot config with RLS policies
-- ============================================================================

-- ─── Profiles (User Management) ─────────────────────────────────────────────

create table profiles (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  nama text not null,
  role text not null check (role in ('admin', 'petugas', 'viewer')),
  password_hash text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Index for fast username lookup
create index idx_profiles_username on profiles(username);

-- ─── Sessions (Custom Token Auth) ───────────────────────────────────────────

create table sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

-- Index for fast token validation
create index idx_sessions_token_expires on sessions(token, expires_at);
create index idx_sessions_user_id on sessions(user_id);

-- Auto-cleanup expired sessions (runs daily)
create or replace function cleanup_expired_sessions()
returns void as $$
begin
  delete from sessions where expires_at < now();
end;
$$ language plpgsql;

-- ─── QC Records ─────────────────────────────────────────────────────────────

create table qc_records (
  id text primary key,
  timestamp timestamptz not null,
  tanggal date not null,
  alat text not null,
  level text not null,
  lot text not null,
  params jsonb not null default '{}',
  status jsonb not null default '{}',
  analis text not null,
  catatan text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Indexes for common queries
create index idx_qc_records_tanggal on qc_records(tanggal);
create index idx_qc_records_alat on qc_records(alat);
create index idx_qc_records_created_by on qc_records(created_by);

-- ─── Lot Config ─────────────────────────────────────────────────────────────

create table lot_config (
  id serial primary key,
  config jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references profiles(id)
);

-- Index for fetching latest config
create index idx_lot_config_updated_at on lot_config(updated_at desc);

-- ─── Row Level Security (RLS) ───────────────────────────────────────────────

alter table profiles enable row level security;
alter table sessions enable row level security;
alter table qc_records enable row level security;
alter table lot_config enable row level security;

-- ─── Helper Function: Get User Role from Token ──────────────────────────────

create or replace function get_user_role_from_token(session_token uuid)
returns text as $$
  select p.role
  from sessions s
  join profiles p on p.id = s.user_id
  where s.token = session_token
    and s.expires_at > now()
    and p.is_active = true
  limit 1;
$$ language sql stable;

-- ─── RLS Policies: Profiles ─────────────────────────────────────────────────

-- Admin can read all profiles
create policy "admin_read_profiles"
  on profiles for select
  using (
    get_user_role_from_token(
      (current_setting('request.headers', true)::json->>'x-session-token')::uuid
    ) = 'admin'
  );

-- Admin can insert/update/delete profiles
create policy "admin_write_profiles"
  on profiles for all
  using (
    get_user_role_from_token(
      (current_setting('request.headers', true)::json->>'x-session-token')::uuid
    ) = 'admin'
  );

-- Users can read their own profile
create policy "user_read_own_profile"
  on profiles for select
  using (
    id in (
      select user_id from sessions
      where token = (current_setting('request.headers', true)::json->>'x-session-token')::uuid
        and expires_at > now()
    )
  );

-- ─── RLS Policies: Sessions ─────────────────────────────────────────────────

-- Allow unauthenticated login (insert session)
create policy "allow_login"
  on sessions for insert
  with check (true);

-- Users can read their own sessions
create policy "user_read_own_sessions"
  on sessions for select
  using (
    user_id in (
      select user_id from sessions
      where token = (current_setting('request.headers', true)::json->>'x-session-token')::uuid
        and expires_at > now()
    )
  );

-- Users can delete their own sessions (logout)
create policy "user_delete_own_sessions"
  on sessions for delete
  using (
    user_id in (
      select user_id from sessions
      where token = (current_setting('request.headers', true)::json->>'x-session-token')::uuid
        and expires_at > now()
    )
  );

-- ─── RLS Policies: QC Records ───────────────────────────────────────────────

-- All authenticated users can read QC records
create policy "authenticated_read_qc"
  on qc_records for select
  using (
    exists (
      select 1 from sessions
      where token = (current_setting('request.headers', true)::json->>'x-session-token')::uuid
        and expires_at > now()
    )
  );

-- Admin and petugas can insert QC records
create policy "petugas_insert_qc"
  on qc_records for insert
  with check (
    get_user_role_from_token(
      (current_setting('request.headers', true)::json->>'x-session-token')::uuid
    ) in ('admin', 'petugas')
  );

-- ─── RLS Policies: Lot Config ──────────────────────────────────────────────

-- All authenticated users can read lot config
create policy "authenticated_read_config"
  on lot_config for select
  using (
    exists (
      select 1 from sessions
      where token = (current_setting('request.headers', true)::json->>'x-session-token')::uuid
        and expires_at > now()
    )
  );

-- Admin and petugas can insert lot config
create policy "petugas_insert_config"
  on lot_config for insert
  with check (
    get_user_role_from_token(
      (current_setting('request.headers', true)::json->>'x-session-token')::uuid
    ) in ('admin', 'petugas')
  );

-- ─── Seed Data: Default Admin User ─────────────────────────────────────────
-- Password: admin123 (bcrypt hash)
-- IMPORTANT: Change this password after first login!

insert into profiles (username, nama, role, password_hash, is_active)
values (
  'admin',
  'Administrator',
  'admin',
  '$2a$10$rKZvVqVqVqVqVqVqVqVqVuO8K8K8K8K8K8K8K8K8K8K8K8K8K8K8K',
  true
);

-- Note: The hash above is a placeholder. Generate real hash with:
-- bcrypt.hash('admin123', 10)
