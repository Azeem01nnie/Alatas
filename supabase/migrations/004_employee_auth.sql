-- Employee Auth helpers: create/update login when admin adds staff
-- Run in SQL Editor after 001_init / 002_seed_admin

create extension if not exists pgcrypto;

create or replace function public.create_employee_with_auth(
  p_id text,
  p_name text,
  p_username text,
  p_phone text,
  p_role text,
  p_password text
)
returns public.employees
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text;
  v_username text := lower(trim(p_username));
  v_role text := coalesce(nullif(trim(p_role), ''), 'Staff');
  v_id text := coalesce(nullif(trim(p_id), ''), 'e-' || extract(epoch from now())::bigint::text);
  v_row public.employees;
begin
  if v_username is null or length(v_username) < 2 then
    raise exception 'Username is required';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;
  if exists (select 1 from public.employees where lower(username) = v_username) then
    raise exception 'Username already exists';
  end if;

  v_email := v_username || '@alatas.local';
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'Login email already exists for this username';
  end if;

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_email,
    crypt(p_password, gen_salt('bf')),
    timezone('utc', now()),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'employee'),
    jsonb_build_object('role', 'employee', 'displayName', coalesce(nullif(trim(p_name), ''), v_username)),
    timezone('utc', now()),
    timezone('utc', now()),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email',
    v_email,
    timezone('utc', now()),
    timezone('utc', now()),
    timezone('utc', now())
  );

  insert into public.employees (
    id, name, username, phone, role, active, auth_user_id, created_at, updated_at
  ) values (
    v_id,
    nullif(trim(p_name), ''),
    v_username,
    nullif(trim(p_phone), ''),
    v_role,
    true,
    v_user_id,
    timezone('utc', now()),
    timezone('utc', now())
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.update_employee_password(
  p_employee_id text,
  p_password text
)
returns public.employees
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_row public.employees;
  v_email text;
begin
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  select * into v_row from public.employees where id = p_employee_id;
  if not found then
    raise exception 'Employee not found';
  end if;

  v_email := lower(trim(v_row.username)) || '@alatas.local';

  if v_row.auth_user_id is null then
    -- Backfill Auth for employees created before this migration
    return public.create_employee_with_auth(
      v_row.id,
      v_row.name,
      v_row.username,
      v_row.phone,
      v_row.role,
      p_password
    );
  end if;

  update auth.users
  set
    encrypted_password = crypt(p_password, gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where id = v_row.auth_user_id;

  update public.employees
  set updated_at = timezone('utc', now())
  where id = p_employee_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Fix backfill path: create_employee_with_auth fails if username exists.
-- Dedicated backfill when row exists without auth_user_id:
create or replace function public.update_employee_password(
  p_employee_id text,
  p_password text
)
returns public.employees
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_row public.employees;
  v_user_id uuid;
  v_email text;
begin
  if p_password is null or length(p_password) < 8 then
    raise exception 'Password must be at least 8 characters';
  end if;

  select * into v_row from public.employees where id = p_employee_id;
  if not found then
    raise exception 'Employee not found';
  end if;

  v_email := lower(trim(v_row.username)) || '@alatas.local';

  if v_row.auth_user_id is null then
    if exists (select 1 from auth.users where email = v_email) then
      select id into v_user_id from auth.users where email = v_email;
      update auth.users
      set encrypted_password = crypt(p_password, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
          updated_at = timezone('utc', now())
      where id = v_user_id;
    else
      v_user_id := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        v_email,
        crypt(p_password, gen_salt('bf')),
        timezone('utc', now()),
        jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'employee'),
        jsonb_build_object('role', 'employee', 'displayName', coalesce(v_row.name, v_row.username)),
        timezone('utc', now()),
        timezone('utc', now()),
        '', '', '', ''
      );
      insert into auth.identities (
        id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
      ) values (
        v_user_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
        'email',
        v_email,
        timezone('utc', now()),
        timezone('utc', now()),
        timezone('utc', now())
      );
    end if;

    update public.employees
    set auth_user_id = v_user_id, updated_at = timezone('utc', now())
    where id = p_employee_id
    returning * into v_row;
    return v_row;
  end if;

  update auth.users
  set
    encrypted_password = crypt(p_password, gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
  where id = v_row.auth_user_id;

  update public.employees
  set updated_at = timezone('utc', now())
  where id = p_employee_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_employee_with_auth(text, text, text, text, text, text) to authenticated;
grant execute on function public.update_employee_password(text, text) to authenticated;
