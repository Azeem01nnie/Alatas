-- Seed desk admin (run in SQL Editor after 001_init.sql)
-- Login: username alatas  /  password Alatas@2026
-- Maps to email alatas@alatas.local for Auth

create extension if not exists pgcrypto;

do $$
declare
  v_user_id uuid := gen_random_uuid();
  v_email text := 'alatas@alatas.local';
  v_password text := 'Alatas@2026';
begin
  -- Skip if already present
  if exists (select 1 from auth.users where email = v_email) then
    select id into v_user_id from auth.users where email = v_email;
    raise notice 'Auth user already exists: %', v_user_id;
  else
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
      crypt(v_password, gen_salt('bf')),
      timezone('utc', now()),
      '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
      '{"role":"admin","displayName":"Alatas Admin"}'::jsonb,
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

    raise notice 'Created auth user %', v_user_id;
  end if;

  insert into public.employees (
    id,
    name,
    username,
    phone,
    role,
    active,
    auth_user_id,
    created_at,
    updated_at
  ) values (
    'emp-alatas-admin',
    'Alatas Admin',
    'alatas',
    null,
    'Manager',
    true,
    v_user_id,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update set
    auth_user_id = excluded.auth_user_id,
    active = true,
    updated_at = timezone('utc', now());

  -- Ensure username uniqueness path if row exists under another id
  update public.employees
  set auth_user_id = v_user_id, active = true, role = 'Manager', updated_at = timezone('utc', now())
  where username = 'alatas' and id <> 'emp-alatas-admin';
end $$;
