create extension if not exists "pgcrypto";

alter table public.packages
  add column if not exists thumbnail_url text;

create table if not exists public.package_venue_assignments (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.packages(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint package_venue_assignments_package_venue_key unique (package_id, venue_id)
);

create index if not exists package_venue_assignments_package_id_idx
  on public.package_venue_assignments (package_id);

create index if not exists package_venue_assignments_venue_id_idx
  on public.package_venue_assignments (venue_id);

insert into public.package_venue_assignments (package_id, venue_id)
select id, venue_id
from public.packages
where venue_id is not null
on conflict (package_id, venue_id) do nothing;

create table if not exists public.booking_venue_assignments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint booking_venue_assignments_booking_venue_key unique (booking_id, venue_id)
);

create index if not exists booking_venue_assignments_booking_id_idx
  on public.booking_venue_assignments (booking_id);

create index if not exists booking_venue_assignments_venue_id_idx
  on public.booking_venue_assignments (venue_id);

-- Snapshot existing single-venue bookings so all availability queries can use
-- the same relationship without changing their original venue_id value.
insert into public.booking_venue_assignments (booking_id, venue_id)
select id, venue_id
from public.bookings
where venue_id is not null
on conflict (booking_id, venue_id) do nothing;

alter table public.package_venue_assignments enable row level security;
alter table public.booking_venue_assignments enable row level security;

drop policy if exists package_venue_assignments_public_select on public.package_venue_assignments;
create policy package_venue_assignments_public_select
  on public.package_venue_assignments
  for select
  using (
    exists (
      select 1
      from public.packages
      join public.venues on venues.id = package_venue_assignments.venue_id
      where packages.id = package_venue_assignments.package_id
        and packages.is_active
        and venues.is_active
    )
    or exists (select 1 from public.admins where admins.id = auth.uid())
  );

drop policy if exists package_venue_assignments_admin_insert on public.package_venue_assignments;
create policy package_venue_assignments_admin_insert
  on public.package_venue_assignments
  for insert
  with check (exists (select 1 from public.admins where admins.id = auth.uid()));

drop policy if exists package_venue_assignments_admin_update on public.package_venue_assignments;
create policy package_venue_assignments_admin_update
  on public.package_venue_assignments
  for update
  using (exists (select 1 from public.admins where admins.id = auth.uid()))
  with check (exists (select 1 from public.admins where admins.id = auth.uid()));

drop policy if exists package_venue_assignments_admin_delete on public.package_venue_assignments;
create policy package_venue_assignments_admin_delete
  on public.package_venue_assignments
  for delete
  using (exists (select 1 from public.admins where admins.id = auth.uid()));

drop policy if exists booking_venue_assignments_owner_select on public.booking_venue_assignments;
create policy booking_venue_assignments_owner_select
  on public.booking_venue_assignments
  for select
  using (
    exists (
      select 1
      from public.bookings
      where bookings.id = booking_venue_assignments.booking_id
        and (bookings.status <> 'cancelled' or bookings.user_id = auth.uid())
    )
    or exists (select 1 from public.admins where admins.id = auth.uid())
  );
