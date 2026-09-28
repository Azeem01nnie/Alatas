-- Customer IDs, signatures, and vehicle-condition photos must never be public.
update storage.buckets set public = false where id = 'rentals';

drop policy if exists "storage_public_read" on storage.objects;
create policy "storage_public_read"
on storage.objects for select
to anon
using (bucket_id in ('vehicles', 'profiles', 'reports'));

-- Existing authenticated policies from 001_init continue to protect rentals.
