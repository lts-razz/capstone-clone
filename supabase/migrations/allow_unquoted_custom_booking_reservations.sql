-- Custom requests begin their payment window only when staff finalizes pricing.
alter table public.bookings
  alter column reservation_expires_at drop default,
  alter column reservation_expires_at drop not null;

-- Remove premature deadlines from active custom requests still awaiting a quote.
update public.bookings
set reservation_expires_at = null,
    expiration_reminder_sent_at = null
where package_type = 'custom-booking'
  and status not in ('cancelled', 'completed')
  and (
    quotation_status is distinct from 'finalized'
    or coalesce(total_price, 0) <= 0
    or coalesce(minimum_payment_amount, 0) <= 0
  )
  and not exists (
    select 1 from public.booking_payments payment
    where payment.booking_id = bookings.id
      and (payment.payment_status in ('partial', 'paid') or payment.amount_paid > 0)
  )
  and reservation_expires_at is not null;
