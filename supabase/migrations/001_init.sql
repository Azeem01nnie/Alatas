-- Alatas: initial Supabase schema (full online, no SQLite)
-- Run this in Supabase Dashboard → SQL Editor → New query → Run

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.auth_role()
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    ''
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.auth_role() = 'admin' or auth.role() = 'authenticated';
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.vehicles (
  id text primary key,
  make text,
  series text,
  body_type text,
  seats integer,
  transmission text,
  plate_no text,
  engine_no text,
  chassis_no text,
  status text,
  image text,
  owner_id text,
  owner_name text,
  ownership_type text default 'company',
  orcr_image text,
  or_image text,
  hrs5 integer,
  hrs12 integer,
  hrs24 integer,
  exceed_hour integer,
  report_entries jsonb default '[]'::jsonb,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.rentals (
  id text primary key,
  vehicle_id text references public.vehicles (id) on delete set null,
  vehicle jsonb,
  personal jsonb,
  rental jsonb,
  photo text,
  license_photo text,
  signature text,
  car_photos jsonb default '{}'::jsonb,
  terms_accepted boolean default false,
  rental_lifecycle text,
  started_at timestamptz,
  completed_at timestamptz,
  encoded_at timestamptz,
  created_at timestamptz default timezone('utc', now()),
  approval_status text default 'accepted',
  source text default 'desktop',
  rejection_reason text,
  updated_at timestamptz default timezone('utc', now()),
  car_photos_added_by text
);

create index if not exists rentals_approval_status_idx on public.rentals (approval_status);
create index if not exists rentals_vehicle_id_idx on public.rentals (vehicle_id);
create index if not exists rentals_updated_at_idx on public.rentals (updated_at);

create table if not exists public.employees (
  id text primary key,
  name text,
  username text unique,
  phone text,
  role text default 'Staff',
  active boolean default true,
  auth_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz default timezone('utc', now()),
  updated_at timestamptz default timezone('utc', now())
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default timezone('utc', now())
);

insert into public.app_settings (key, value)
values
  ('admin_profile', '{"displayName":"Alatas Admin","photo":""}'::jsonb),
  ('vehicle_reports', '{"entries":[],"submissions":[]}'::jsonb)
on conflict (key) do nothing;

-- updated_at triggers
drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();

drop trigger if exists rentals_set_updated_at on public.rentals;
create trigger rentals_set_updated_at
  before update on public.rentals
  for each row execute function public.set_updated_at();

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Business RPCs (accept / reject)
-- ---------------------------------------------------------------------------
create or replace function public.vehicle_is_blocked(p_vehicle_id text, p_except_rental_id text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status text;
  v_active int;
begin
  if p_vehicle_id is null or length(trim(p_vehicle_id)) = 0 then
    return jsonb_build_object('blocked', false);
  end if;

  select status into v_status from public.vehicles where id = p_vehicle_id;

  select count(*) into v_active
  from public.rentals r
  where r.vehicle_id = p_vehicle_id
    and (p_except_rental_id is null or r.id <> p_except_rental_id)
    and r.approval_status is distinct from 'pending'
    and r.approval_status is distinct from 'rejected'
    and r.rental_lifecycle in ('active', 'scheduled');

  if v_active > 0 then
    return jsonb_build_object('blocked', true, 'reason', 'Vehicle already has an active or scheduled rental.');
  end if;

  if v_status = 'Under Maintenance' then
    return jsonb_build_object('blocked', true, 'reason', 'Vehicle is Under Maintenance.');
  end if;

  -- Stale "Rented" with no active/scheduled rental is allowed
  return jsonb_build_object('blocked', false);
end;
$$;

create or replace function public.accept_pending_rental(p_id text)
returns public.rentals
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rentals;
  blocked jsonb;
  period_from timestamptz;
  start_now boolean;
begin
  select * into r from public.rentals where id = p_id;
  if not found then
    raise exception 'Pending rental not found.';
  end if;
  if r.approval_status is distinct from 'pending' then
    raise exception 'Rental is not pending approval.';
  end if;

  blocked := public.vehicle_is_blocked(r.vehicle_id, r.id);
  if (blocked ->> 'blocked')::boolean then
    raise exception '%', blocked ->> 'reason';
  end if;

  period_from := nullif(r.rental ->> 'periodFrom', '')::timestamptz;
  start_now := period_from is null or period_from <= timezone('utc', now());

  update public.rentals
  set
    approval_status = 'accepted',
    rental_lifecycle = case when start_now then 'active' else 'scheduled' end,
    started_at = case when start_now then timezone('utc', now()) else null end,
    rejection_reason = null,
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into r;

  if start_now and r.vehicle_id is not null then
    update public.vehicles
    set status = 'Rented', updated_at = timezone('utc', now())
    where id = r.vehicle_id;
  end if;

  return r;
end;
$$;

create or replace function public.reject_pending_rental(p_id text, p_reason text default '')
returns public.rentals
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.rentals;
begin
  select * into r from public.rentals where id = p_id;
  if not found then
    raise exception 'Pending rental not found.';
  end if;
  if r.approval_status is distinct from 'pending' then
    raise exception 'Rental is not pending approval.';
  end if;

  update public.rentals
  set
    approval_status = 'rejected',
    rental_lifecycle = 'cancelled',
    rejection_reason = nullif(trim(p_reason), ''),
    updated_at = timezone('utc', now())
  where id = p_id
  returning * into r;

  return r;
end;
$$;

grant execute on function public.accept_pending_rental(text) to authenticated;
grant execute on function public.reject_pending_rental(text, text) to authenticated;
grant execute on function public.vehicle_is_blocked(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- Desk Electron + field PWA use authenticated sessions.
-- Authenticated users get full access for v1 (tighten employee policies later).
-- ---------------------------------------------------------------------------
alter table public.vehicles enable row level security;
alter table public.rentals enable row level security;
alter table public.employees enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists vehicles_authenticated_all on public.vehicles;
create policy vehicles_authenticated_all on public.vehicles
  for all to authenticated using (true) with check (true);

drop policy if exists rentals_authenticated_all on public.rentals;
create policy rentals_authenticated_all on public.rentals
  for all to authenticated using (true) with check (true);

drop policy if exists employees_authenticated_all on public.employees;
create policy employees_authenticated_all on public.employees
  for all to authenticated using (true) with check (true);

drop policy if exists app_settings_authenticated_all on public.app_settings;
create policy app_settings_authenticated_all on public.app_settings
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('vehicles', 'vehicles', true),
  ('rentals', 'rentals', true),
  ('profiles', 'profiles', true),
  ('reports', 'reports', true)
on conflict (id) do nothing;

drop policy if exists storage_authenticated_read on storage.objects;
create policy storage_authenticated_read on storage.objects
  for select to authenticated using (bucket_id in ('vehicles', 'rentals', 'profiles', 'reports'));

drop policy if exists storage_authenticated_write on storage.objects;
create policy storage_authenticated_write on storage.objects
  for insert to authenticated with check (bucket_id in ('vehicles', 'rentals', 'profiles', 'reports'));

drop policy if exists storage_authenticated_update on storage.objects;
create policy storage_authenticated_update on storage.objects
  for update to authenticated using (bucket_id in ('vehicles', 'rentals', 'profiles', 'reports'));

drop policy if exists storage_authenticated_delete on storage.objects;
create policy storage_authenticated_delete on storage.objects
  for delete to authenticated using (bucket_id in ('vehicles', 'rentals', 'profiles', 'reports'));

-- Public read for vehicle/rental images (optional; buckets marked public)
drop policy if exists storage_public_read on storage.objects;
create policy storage_public_read on storage.objects
  for select to anon using (bucket_id in ('vehicles', 'rentals', 'profiles', 'reports'));
