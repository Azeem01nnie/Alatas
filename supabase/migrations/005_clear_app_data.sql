-- Admin-only wipe of fleet / rental / staff data.
-- Preserves admin Auth credentials (auth.users + desk admin employee row).
-- Re-run safely in SQL Editor anytime (create or replace).

create or replace function public.clear_app_data()
returns jsonb
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  v_uid uuid := auth.uid();
  v_role text := coalesce(public.auth_role(), '');
  v_is_admin boolean := false;
  v_keep_user_ids uuid[];
  v_staff_user_ids uuid[];
  v_rentals_deleted integer := 0;
  v_vehicles_deleted integer := 0;
  v_employees_deleted integer := 0;
  v_staff_auth_deleted integer := 0;
  v_storage_deleted integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_is_admin :=
    v_role = 'admin'
    or exists (
      select 1
      from public.employees e
      where e.auth_user_id = v_uid
        and (
          lower(coalesce(e.username, '')) = 'alatas'
          or e.id = 'emp-alatas-admin'
          or lower(coalesce(e.role, '')) = 'admin'
        )
    );

  if not v_is_admin then
    raise exception 'Only admin can clear app data';
  end if;

  select coalesce(array_agg(distinct keep_id), array[v_uid])
  into v_keep_user_ids
  from (
    select v_uid as keep_id
    union
    select u.id
    from auth.users u
    where coalesce(u.raw_app_meta_data->>'role', '') = 'admin'
       or coalesce(u.raw_user_meta_data->>'role', '') = 'admin'
    union
    select e.auth_user_id
    from public.employees e
    where e.auth_user_id is not null
      and (
        lower(coalesce(e.username, '')) = 'alatas'
        or e.id = 'emp-alatas-admin'
        or lower(coalesce(e.role, '')) = 'admin'
      )
  ) keepers;

  -- Core wipe (must succeed)
  delete from public.rentals;
  get diagnostics v_rentals_deleted = row_count;

  delete from public.vehicles;
  get diagnostics v_vehicles_deleted = row_count;

  delete from public.employees e
  where lower(coalesce(e.username, '')) <> 'alatas'
    and e.id <> 'emp-alatas-admin'
    and lower(coalesce(e.role, '')) <> 'admin'
    and (
      e.auth_user_id is null
      or not (e.auth_user_id = any (v_keep_user_ids))
    );
  get diagnostics v_employees_deleted = row_count;

  update public.app_settings
  set
    value = '{"entries":[],"submissions":[]}'::jsonb,
    updated_at = timezone('utc', now())
  where key = 'vehicle_reports';

  -- Optional: remove staff Auth users (do not fail the wipe if blocked)
  begin
    select coalesce(array_agg(u.id), '{}'::uuid[])
    into v_staff_user_ids
    from auth.users u
    where u.id <> all (v_keep_user_ids);

    if array_length(v_staff_user_ids, 1) is not null then
      delete from auth.identities where user_id = any (v_staff_user_ids);
      delete from auth.users where id = any (v_staff_user_ids);
      get diagnostics v_staff_auth_deleted = row_count;
    end if;
  exception
    when others then
      v_staff_auth_deleted := 0;
  end;

  -- Optional: drop uploaded media (keep profile bucket)
  begin
    delete from storage.objects
    where bucket_id in ('vehicles', 'rentals', 'reports');
    get diagnostics v_storage_deleted = row_count;
  exception
    when others then
      v_storage_deleted := 0;
  end;

  return jsonb_build_object(
    'ok', true,
    'rentalsDeleted', v_rentals_deleted,
    'vehiclesDeleted', v_vehicles_deleted,
    'employeesDeleted', v_employees_deleted,
    'staffAuthUsersDeleted', coalesce(v_staff_auth_deleted, 0),
    'storageObjectsDeleted', coalesce(v_storage_deleted, 0)
  );
end;
$$;

revoke all on function public.clear_app_data() from public;
grant execute on function public.clear_app_data() to authenticated;
