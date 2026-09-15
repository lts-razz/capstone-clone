alter table public.customers
  add column if not exists address text null;

alter table public.bookings
  add column if not exists email text null,
  add column if not exists email_notifications_enabled boolean null,
  add column if not exists sms_notifications_enabled boolean null;

update public.customers c
set address = latest.address,
    updated_at = now()
from (
  select distinct on (user_id)
    user_id,
    address
  from public.bookings
  where address is not null
    and btrim(address) <> ''
  order by user_id, created_at desc
) latest
where c.id = latest.user_id
  and c.address is null;

update public.bookings b
set email = c.email
from public.customers c
where b.user_id = c.id
  and b.email is null
  and c.email is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_notification_preferences_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_notification_preferences_check
      check (
        (email_notifications_enabled is null and sms_notifications_enabled is null)
        or coalesce(email_notifications_enabled, false)
        or coalesce(sms_notifications_enabled, false)
      );
  end if;
end $$;
