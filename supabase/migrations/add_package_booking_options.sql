alter table public.packages
  add column if not exists booking_options jsonb not null default '{}'::jsonb;

comment on column public.packages.booking_options is
  'Per-package defaults and optional locks for customer booking form selections.';

alter table public.packages
  drop constraint if exists packages_booking_options_is_object;

alter table public.packages
  add constraint packages_booking_options_is_object
  check (jsonb_typeof(booking_options) = 'object');
