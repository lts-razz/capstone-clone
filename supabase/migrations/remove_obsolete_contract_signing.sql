-- Contract signing is no longer a separate booking phase.
update public.bookings b
set status = 'booked',
    status_updated_at = coalesce(status_updated_at, now()),
    updated_at = now()
where status = 'contract_signing'
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
    status_updated_at = coalesce(status_updated_at, now()),
    updated_at = now()
where status = 'contract_signing';

alter table public.bookings
  drop column if exists contract_signing_date,
  drop column if exists contract_signing_time;
