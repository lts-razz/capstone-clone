create extension if not exists "pgcrypto";

create table if not exists public.package_venues (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  name text not null,
  description text not null,
  capacity integer not null,
  image_url text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint package_venues_name_not_blank_check check (length(btrim(name)) > 0),
  constraint package_venues_description_not_blank_check check (length(btrim(description)) > 0),
  constraint package_venues_capacity_positive_check check (capacity > 0)
);

create index if not exists package_venues_package_id_idx
  on public.package_venues (package_id);

create index if not exists package_venues_active_package_id_idx
  on public.package_venues (package_id)
  where is_active;

alter table public.package_venues enable row level security;

drop policy if exists package_venues_active_select on public.package_venues;
create policy package_venues_active_select
  on public.package_venues
  for select
  using (
    is_active
    or exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

drop policy if exists package_venues_admin_insert on public.package_venues;
create policy package_venues_admin_insert
  on public.package_venues
  for insert
  with check (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

drop policy if exists package_venues_admin_update on public.package_venues;
create policy package_venues_admin_update
  on public.package_venues
  for update
  using (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_package_venues_updated_at on public.package_venues;
create trigger set_package_venues_updated_at
before update on public.package_venues
for each row
execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'package-venues',
  'package-venues',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists package_venue_images_public_select on storage.objects;
create policy package_venue_images_public_select
  on storage.objects
  for select
  using (bucket_id = 'package-venues');

drop policy if exists package_venue_images_admin_insert on storage.objects;
create policy package_venue_images_admin_insert
  on storage.objects
  for insert
  with check (
    bucket_id = 'package-venues'
    and exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );

drop policy if exists package_venue_images_admin_update on storage.objects;
create policy package_venue_images_admin_update
  on storage.objects
  for update
  using (
    bucket_id = 'package-venues'
    and exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  )
  with check (
    bucket_id = 'package-venues'
    and exists (
      select 1
      from public.admins
      where admins.id = auth.uid()
    )
  );
