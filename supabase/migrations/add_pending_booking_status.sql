-- New reservations remain pending until the required down payment is verified.
alter table public.bookings drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check
  check (status in ('pending', 'booked', 'rescheduled', 'cancelled', 'completed'));

alter table public.bookings alter column status set default 'pending';

-- Existing booked rows are retained: payment evidence may not reliably identify
-- which historical reservations were secured under the former status model.
