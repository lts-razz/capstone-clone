alter table public.bookings
  add column if not exists quotation_status text,
  add column if not exists quotation_finalized_at timestamptz null;

update public.bookings
set quotation_status = case
    when package_type = 'custom-booking'
      and estimate_summary->>'pricingStatus' = 'finalized'
      and coalesce(total_price, 0) > 0
      and coalesce(minimum_payment_amount, 0) > 0
      then 'finalized'
    when package_type = 'custom-booking'
      then 'pending'
    else 'not_required'
  end
where quotation_status is null;

update public.bookings
set quotation_finalized_at = coalesce(quotation_finalized_at, updated_at, created_at, now())
where quotation_status = 'finalized'
  and quotation_finalized_at is null;

alter table public.bookings
  alter column quotation_status set default 'not_required',
  alter column quotation_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_quotation_status_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
      add constraint bookings_quotation_status_check
      check (quotation_status in ('not_required', 'pending', 'finalized'));
  end if;
end $$;
