-- Final presentation hardening sync for fresh and previously migrated databases.

do $$
declare
  status_attnum smallint;
  status_constraint record;
begin
  select attnum
  into status_attnum
  from pg_attribute
  where attrelid = 'public.bookings'::regclass
    and attname = 'status'
    and not attisdropped;

  for status_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and contype = 'c'
      and status_attnum = any (conkey)
  loop
    execute format('alter table public.bookings drop constraint %I', status_constraint.conname);
  end loop;
end $$;

update public.bookings
set status = 'booked',
    status_updated_at = coalesce(status_updated_at, updated_at, now()),
    updated_at = now()
where status = 'confirmed';

update public.bookings
set status = 'pending',
    status_updated_at = coalesce(status_updated_at, updated_at, now()),
    updated_at = now()
where status = 'contract_signing';

alter table public.bookings
  alter column status set default 'pending';

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'booked', 'rescheduled', 'cancelled', 'completed'));

alter table public.booking_reschedule_requests
  drop constraint if exists booking_reschedule_requests_user_id_fkey;

alter table public.booking_reschedule_requests
  add constraint booking_reschedule_requests_user_id_fkey
  foreign key (user_id)
  references auth.users(id)
  on delete restrict;
