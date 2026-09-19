-- Login / security audit storage (optional dedicated table).
-- Desk also mirrors into app_settings.login_audit for compatibility.

create table if not exists public.audit_logs (
  id text primary key,
  event_type text not null default 'login',
  username text,
  status text not null,
  detail text,
  user_agent text,
  fingerprint text,
  created_at timestamptz default timezone('utc', now())
);

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_username_idx on public.audit_logs (username);

alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_authenticated_select on public.audit_logs;
create policy audit_logs_authenticated_select on public.audit_logs
  for select to authenticated
  using (
    public.auth_role() = 'admin'
    or exists (
      select 1 from public.employees e
      where e.auth_user_id = auth.uid()
        and (
          lower(coalesce(e.username, '')) = 'alatas'
          or e.id = 'emp-alatas-admin'
          or lower(coalesce(e.role, '')) = 'admin'
        )
    )
  );

drop policy if exists audit_logs_authenticated_insert on public.audit_logs;
create policy audit_logs_authenticated_insert on public.audit_logs
  for insert to authenticated
  with check (true);

-- Allow recording failed/suspicious logins before a session exists.
drop policy if exists audit_logs_anon_insert_login on public.audit_logs;
create policy audit_logs_anon_insert_login on public.audit_logs
  for insert to anon
  with check (event_type = 'login');
