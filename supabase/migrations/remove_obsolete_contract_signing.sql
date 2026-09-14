-- Contract signing is no longer a separate booking phase.
update public.bookings
set status = 'booked',
    status_updated_at = coalesce(status_updated_at, now()),
    updated_at = now()
where status = 'contract_signing';

alter table public.bookings
  drop column if exists contract_signing_date,
  drop column if exists contract_signing_time;
