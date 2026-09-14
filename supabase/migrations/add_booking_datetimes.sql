alter table public.bookings
  add column if not exists start_datetime timestamp without time zone null,
  add column if not exists end_datetime timestamp without time zone null;

comment on column public.bookings.start_datetime is
  'Customer-selected Woodberry local start date and time. Date-only availability remains in start_date.';

comment on column public.bookings.end_datetime is
  'Customer-selected Woodberry local end date and time for multi-day stays. Null for single events.';
