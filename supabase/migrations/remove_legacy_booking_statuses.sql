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

update public.bookings b
set status = 'booked',
    status_updated_at = coalesce(status_updated_at, updated_at, now()),
    updated_at = now()
where status in ('pending', 'contract_signing', 'confirmed')
  and exists (
    select 1
    from public.booking_payments payment
    where payment.booking_id = b.id
      and payment.payment_status in ('partial', 'paid')
      and payment.amount_paid >= greatest(
        coalesce(payment.minimum_payment_amount, b.minimum_payment_amount, b.total_price * 0.5, 0),
        0.01
      )
  );

update public.bookings
set status = 'pending',
    status_updated_at = coalesce(status_updated_at, updated_at, now()),
    updated_at = now()
where status in ('contract_signing', 'confirmed');

alter table public.bookings
  alter column status set default 'pending';

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'booked', 'rescheduled', 'cancelled', 'completed'));
