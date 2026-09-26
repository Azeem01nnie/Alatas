-- Fix: creating an employee fails with "Login email already exists for this username"
-- when a prior auth.users row was left behind (failed create or delete without auth cleanup).
-- Reuse orphaned auth users on create, and delete auth on employee remove.

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
  v_user_id uuid;
  v_email text;
  v_username text := lower(trim(p_username));
  v_role text := coalesce(nullif(trim(p_role), ''), 'Staff');
  v_id text := coalesce(nullif(trim(p_id), ''), 'e-' || extract(epoch from now())::bigint::text);
  v_display text := coalesce(nullif(trim(p_name), ''), v_username);
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

  select id into v_user_id
  from auth.users
  where lower(email) = lower(v_email)
  limit 1;

  if v_user_id is not null then
    if exists (select 1 from public.employees where auth_user_id = v_user_id) then
      raise exception 'Username already exists';
    end if;
    -- Orphaned login from a previous create/delete — reuse it
    update auth.users
    set
      encrypted_password = crypt(p_password, gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, timezone('utc', now())),
      raw_app_meta_data = jsonb_build_object(
        'provider', 'email',
        'providers', jsonb_build_array('email'),
        'role', 'employee'
      ),
      raw_user_meta_data = jsonb_build_object(
        'role', 'employee',
        'displayName', v_display
      ),
      updated_at = timezone('utc', now())
    where id = v_user_id;

    update auth.identities
    set
      identity_data = jsonb_build_object(
        'sub', v_user_id::text,
        'email', v_email,
        'email_verified', true
      ),
      provider_id = v_email,
      updated_at = timezone('utc', now())
    where user_id = v_user_id and provider = 'email';

    if not found then
      insert into auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
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
  else
    v_user_id := gen_random_uuid();
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
      jsonb_build_object('role', 'employee', 'displayName', v_display),
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
  end if;

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

create or replace function public.delete_employee_with_auth(p_employee_id text)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_row public.employees;
  v_user_id uuid;
begin
  select * into v_row from public.employees where id = p_employee_id;
  if not found then
    raise exception 'Employee not found';
  end if;

  v_user_id := v_row.auth_user_id;

  delete from public.employees where id = p_employee_id;

  if v_user_id is not null then
    -- Only remove auth if no other employee still points at it
    if not exists (select 1 from public.employees where auth_user_id = v_user_id) then
      delete from auth.identities where user_id = v_user_id;
      delete from auth.users where id = v_user_id;
    end if;
  else
    -- Clean orphan login by username email if present and unused
    select id into v_user_id
    from auth.users
    where lower(email) = lower(trim(v_row.username) || '@alatas.local')
    limit 1;
    if v_user_id is not null
       and not exists (select 1 from public.employees where auth_user_id = v_user_id) then
      delete from auth.identities where user_id = v_user_id;
      delete from auth.users where id = v_user_id;
    end if;
  end if;

  return true;
end;
$$;

grant execute on function public.create_employee_with_auth(text, text, text, text, text, text) to authenticated;
grant execute on function public.delete_employee_with_auth(text) to authenticated;
