-- Multi display photos + insurance photos on vehicles
alter table public.vehicles
  add column if not exists images jsonb default '[]'::jsonb;

alter table public.vehicles
  add column if not exists insurance_images jsonb default '[]'::jsonb;

-- Backfill images from legacy single image column where empty
update public.vehicles
set images = jsonb_build_array(image)
where (images is null or images = '[]'::jsonb)
  and image is not null
  and length(trim(image)) > 0;
