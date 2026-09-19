-- Allow failed logins (no session) to reach the admin audit trail.
-- Run once in Supabase SQL Editor.

create table if not exists public.audit_logs (
  id text primary key,
  event_type text not null default 'login',
  username text,
  role text,
  status text not null,
  detail text,
  user_agent text,
  fingerprint text,
  created_at timestamptz default timezone('utc', now())
);

alter table public.audit_logs
  add column if not exists role text;

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_username_idx on public.audit_logs (username);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_authenticated_select on public.audit_logs;
create policy audit_logs_authenticated_select on public.audit_logs
  for select to authenticated
  using (true);

drop policy if exists audit_logs_authenticated_insert on public.audit_logs;
create policy audit_logs_authenticated_insert on public.audit_logs
  for insert to authenticated
  with check (true);

create or replace function public.record_login_audit(
  p_username text,
  p_status text,
  p_role text default 'unknown',
  p_detail text default '',
  p_user_agent text default '',
  p_fingerprint text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := 'aud_' || encode(gen_random_bytes(6), 'hex');
  v_status text := case
    when lower(coalesce(p_status, '')) in ('success', 'failed', 'suspicious')
      then lower(p_status)
    else 'failed'
  end;
  v_role text := case
    when lower(coalesce(p_role, '')) in ('admin', 'employee') then lower(p_role)
    else 'unknown'
  end;
  v_username text := left(trim(coalesce(p_username, 'unknown')), 64);
  v_detail text := left(coalesce(p_detail, ''), 240);
  v_ua text := left(coalesce(p_user_agent, ''), 180);
  v_fp text := left(coalesce(p_fingerprint, ''), 64);
  v_created timestamptz := timezone('utc', now());
  v_entry jsonb;
  v_current jsonb;
  v_entries jsonb := '[]'::jsonb;
begin
  if v_username = '' then
    v_username := 'unknown';
  end if;

  v_entry := jsonb_build_object(
    'id', v_id,
    'username', v_username,
    'role', v_role,
    'status', v_status,
    'detail', v_detail,
    'userAgent', v_ua,
    'fingerprint', v_fp,
    'createdAt', to_char(v_created at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  insert into public.audit_logs (
    id, event_type, username, role, status, detail, user_agent, fingerprint, created_at
  ) values (
    v_id, 'login', v_username, v_role, v_status, v_detail, v_ua, v_fp, v_created
  );

  -- Mirror into app_settings for Settings UI compatibility
  select value into v_current
  from public.app_settings
  where key = 'login_audit';

  if v_current is not null and jsonb_typeof(v_current->'entries') = 'array' then
    v_entries := v_current->'entries';
  end if;

  v_entries := jsonb_build_array(v_entry) || coalesce(v_entries, '[]'::jsonb);

  if jsonb_array_length(v_entries) > 100 then
    select coalesce(jsonb_agg(elem), '[]'::jsonb)
    into v_entries
    from (
      select elem
      from jsonb_array_elements(v_entries) with ordinality as t(elem, ord)
      where ord <= 100
    ) trimmed;
  end if;

  insert into public.app_settings (key, value, updated_at)
  values (
    'login_audit',
    jsonb_build_object('entries', v_entries),
    v_created
  )
  on conflict (key) do update
  set
    value = excluded.value,
    updated_at = excluded.updated_at;

  return v_entry;
end;
$$;

revoke all on function public.record_login_audit(text, text, text, text, text, text) from public;
grant execute on function public.record_login_audit(text, text, text, text, text, text) to anon, authenticated;
