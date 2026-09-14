alter table public.booking_payments
  add column if not exists refund_status text not null default 'not_required'
    check (refund_status in ('not_required', 'not_eligible', 'pending', 'processed', 'failed')),
  add column if not exists refund_amount numeric(12, 2) not null default 0 check (refund_amount >= 0),
  add column if not exists refund_processed_at timestamptz,
  add column if not exists refund_notes text;

create index if not exists booking_payments_refund_status_idx
  on public.booking_payments(refund_status);
