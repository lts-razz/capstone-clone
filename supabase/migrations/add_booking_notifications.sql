alter table public.customers
  add column if not exists email_notifications_enabled boolean not null default true,
  add column if not exists sms_notifications_enabled boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_notification_preferences_check'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_notification_preferences_check
      check (email_notifications_enabled or sms_notifications_enabled);
  end if;
end $$;

alter table public.bookings
  add column if not exists one_week_notice_sent_at timestamptz null,
  add column if not exists one_week_email_sent_at timestamptz null,
  add column if not exists one_week_sms_sent_at timestamptz null;

update public.bookings
set one_week_email_sent_at = coalesce(one_week_email_sent_at, one_week_notice_sent_at),
    one_week_sms_sent_at = coalesce(one_week_sms_sent_at, one_week_notice_sent_at)
where one_week_notice_sent_at is not null
  and (one_week_email_sent_at is null or one_week_sms_sent_at is null);

-- Booking status lifecycle is managed by the dedicated status migrations.
-- Do not restore the obsolete contract_signing phase here.
