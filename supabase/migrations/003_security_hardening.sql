-- ===========================================================================
-- Security Hardening: Server-side Auth & RLS Activation
-- ===========================================================================

-- 1. Enable pgcrypto for bcrypt verification on server
create extension if not exists pgcrypto;

-- 2. Create Server-Side Login Function (SECURITY DEFINER)
-- This function handles password verification without exposing hashes to the client.
create or replace function auth.verify_login(p_username text, p_password text)
returns jsonb as $$
declare
    v_user record;
    v_token uuid;
    v_expires_at timestamptz;
begin
    -- Find user by username (case-insensitive)
    select id, username, nama, role, password_hash, is_active 
    into v_user 
    from public.profiles 
    where lower(username) = lower(p_username)
    limit 1;

    if v_user is null then
        return jsonb_build_object('success', false, 'message', 'Username atau password salah');
    end if;

    if not v_user.is_active then
        return jsonb_build_object('success', false, 'message', 'Akun tidak aktif. Hubungi admin.');
    end if;

    -- Verify password using pgcrypto (bcrypt)
    if not crypt_auth_check(p_password, v_user.password_hash) then
        return jsonb_build_object('success', false, 'message', 'Username atau password salah');
    end if;

    -- Create session
    v_expires_at := now() + interval '24 hours';
    insert into public.sessions (user_id, expires_at)
    values (v_user.id, v_expires_at)
    returning token into v_token;

    return jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'id', v_user.id,
            'username', v_user.username,
            'nama', v_user.nama,
            'role', v_user.role,
            'token', v_token,
            'loginAt', extract(epoch from now()) * 1000
        )
    );
end;
$$ language plpgsql security definer;

-- 3. Activate RLS on all tables
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.qc_records enable row level security;
alter table public.lot_config enable row level security;

-- 4. Helper: Get User Role from Token (Now Active)
create or replace function get_user_role_from_token(session_token uuid)
returns text as $$
  select p.role
  from public.sessions s
  join public.profiles p on p.id = s.user_id
  where s.token = session_token
    and s.expires_at > now()
    and p.is_active = true
  limit 1;
$$ language sql stable;

-- 5. Implement RLS Policies

-- Profiles: Admin read all, Users read own
create policy "admin_read_profiles" on public.profiles for select using (get_user_role_from_token((current_setting('request.headers', true)::json->>'x-session-token')::uuid) = 'admin');
create policy "user_read_own_profile" on public.profiles for select using (id = (select user_id from public.sessions where token = (current_setting('request.headers', true)::json->>'x-session-token')::uuid and expires_at > now()));

-- Sessions: Allow login (insert), Users manage own
create policy "allow_login" on public.sessions for insert with check (true);
create policy "user_read_own_sessions" on public.sessions for select using (user_id = (select user_id from public.sessions where token = (current_setting('request.headers', true)::json->>'x-session-token')::uuid and expires_at > now()));
create policy "user_delete_own_sessions" on public.sessions for delete using (user_id = (select user_id from public.sessions where token = (current_setting('request.headers', true)::json->>'x-session-token')::uuid and expires_at > now()));

-- QC Records: Auth read, Admin/Petugas write
create policy "authenticated_read_qc" on public.qc_records for select using (exists (select 1 from public.sessions where token = (current_setting('request.headers', true)::json->>'x-session-token')::uuid and expires_at > now()));
create policy "petugas_insert_qc" on public.qc_records for insert with check (get_user_role_from_token((current_setting('request.headers', true)::json->>'x-session-token')::uuid) in ('admin', 'petugas'));

-- Lot Config: Auth read, Admin/Petugas write
create policy "authenticated_read_config" on public.lot_config for select using (exists (select 1 from public.sessions where token = (current_setting('request.headers', true)::json->>'x-session-token')::uuid and expires_at > now()));
create policy "petugas_insert_config" on public.lot_config for insert with check (get_user_role_from_token((current_setting('request.headers', true)::json->>'x-session-token')::uuid) in ('admin', 'petugas'));
