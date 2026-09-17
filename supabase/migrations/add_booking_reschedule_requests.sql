create extension if not exists "pgcrypto";

create table if not exists public.booking_reschedule_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  requested_start_date date not null,
  requested_end_date date not null,
  requested_event_date date null,
  requested_start_datetime timestamp without time zone null,
  requested_end_datetime timestamp without time zone null,
  customer_note text null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid null,
  reviewed_role text null check (reviewed_role in ('admin', 'staff')),
  reviewed_at timestamptz null,
  review_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_reschedule_requests_date_order
    check (requested_end_date >= requested_start_date),
  constraint booking_reschedule_requests_event_in_range
    check (
      requested_event_date is null
      or (requested_event_date >= requested_start_date and requested_event_date <= requested_end_date)
    ),
  constraint booking_reschedule_requests_start_datetime_date
    check (requested_start_datetime is null or requested_start_datetime::date = requested_start_date),
  constraint booking_reschedule_requests_end_datetime_date
    check (requested_end_datetime is null or requested_end_datetime::date = requested_end_date),
  constraint booking_reschedule_requests_datetime_order
    check (
      requested_start_datetime is null
      or requested_end_datetime is null
      or requested_end_datetime > requested_start_datetime
    )
);

create unique index if not exists booking_reschedule_requests_one_pending_per_booking
  on public.booking_reschedule_requests (booking_id)
  where status = 'pending';

create index if not exists booking_reschedule_requests_booking_created_idx
  on public.booking_reschedule_requests (booking_id, created_at desc);

create index if not exists booking_reschedule_requests_status_created_idx
  on public.booking_reschedule_requests (status, created_at desc);

alter table public.booking_reschedule_requests enable row level security;

drop policy if exists booking_reschedule_requests_customer_select on public.booking_reschedule_requests;
create policy booking_reschedule_requests_customer_select
  on public.booking_reschedule_requests
  for select
  using (user_id = auth.uid());

drop policy if exists booking_reschedule_requests_customer_insert on public.booking_reschedule_requests;
create policy booking_reschedule_requests_customer_insert
  on public.booking_reschedule_requests
  for insert
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and exists (
      select 1
      from public.bookings
      where bookings.id = booking_reschedule_requests.booking_id
        and bookings.user_id = auth.uid()
    )
  );

drop policy if exists booking_reschedule_requests_internal_select on public.booking_reschedule_requests;
create policy booking_reschedule_requests_internal_select
  on public.booking_reschedule_requests
  for select
  using (
    exists (select 1 from public.admins where admins.id = auth.uid())
    or exists (
      select 1 from public.employees
      where employees.id = auth.uid()
        and employees.is_active
    )
  );

drop policy if exists booking_reschedule_requests_internal_update on public.booking_reschedule_requests;
create policy booking_reschedule_requests_internal_update
  on public.booking_reschedule_requests
  for update
  using (
    exists (select 1 from public.admins where admins.id = auth.uid())
    or exists (
      select 1 from public.employees
      where employees.id = auth.uid()
        and employees.is_active
    )
  )
  with check (
    exists (select 1 from public.admins where admins.id = auth.uid())
    or exists (
      select 1 from public.employees
      where employees.id = auth.uid()
        and employees.is_active
    )
  );

create or replace function public.approve_booking_reschedule_request(
  p_request_id uuid,
  p_actor_id uuid,
  p_actor_role text,
  p_reason text default null,
  p_admin_override_one_week boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.booking_reschedule_requests%rowtype;
  v_booking public.bookings%rowtype;
  v_now timestamptz := clock_timestamp();
  v_start_datetime timestamp without time zone;
  v_end_datetime timestamp without time zone;
begin
  if p_actor_role not in ('admin', 'staff') then
    raise exception 'invalid_reschedule_actor' using errcode = '42501';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    if auth.uid() is null or auth.uid() is distinct from p_actor_id then
      raise exception 'invalid_reschedule_actor' using errcode = '42501';
    end if;
    if p_actor_role = 'admin' and not exists (
      select 1 from public.admins where admins.id = auth.uid()
    ) then
      raise exception 'invalid_reschedule_actor' using errcode = '42501';
    end if;
    if p_actor_role = 'staff' and not exists (
      select 1 from public.employees
      where employees.id = auth.uid()
        and employees.is_active
    ) then
      raise exception 'invalid_reschedule_actor' using errcode = '42501';
    end if;
  end if;

  select * into v_request
  from public.booking_reschedule_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception 'reschedule_request_not_found' using errcode = '02000';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'reschedule_request_not_pending' using errcode = '23505';
  end if;

  select * into v_booking
  from public.bookings
  where id = v_request.booking_id
  for update;
  if not found then
    raise exception 'booking_not_found' using errcode = '02000';
  end if;
  if v_booking.status not in ('booked', 'rescheduled') then
    raise exception 'invalid_reschedule_booking_status' using errcode = '22023';
  end if;

  v_start_datetime := coalesce(
    v_request.requested_start_datetime,
    case
      when v_booking.start_datetime is null then null
      else (v_request.requested_start_date + v_booking.start_datetime::time)
    end
  );
  v_end_datetime := coalesce(
    v_request.requested_end_datetime,
    case
      when v_booking.end_datetime is null then null
      else (v_request.requested_end_date + v_booking.end_datetime::time)
    end
  );

  update public.bookings
  set start_date = v_request.requested_start_date,
      end_date = v_request.requested_end_date,
      event_date = coalesce(v_request.requested_event_date, v_request.requested_start_date),
      start_datetime = v_start_datetime,
      end_datetime = v_end_datetime,
      status = 'rescheduled',
      rescheduled_at = v_now,
      status_updated_at = v_now,
      updated_at = v_now,
      override_reason = case
        when p_admin_override_one_week then p_reason
        else override_reason
      end
  where id = v_booking.id;

  update public.booking_reschedule_requests
  set status = 'approved',
      reviewed_by = p_actor_id,
      reviewed_role = p_actor_role,
      reviewed_at = v_now,
      review_note = p_reason,
      updated_at = v_now
  where id = v_request.id;

  insert into public.booking_audit_log (
    booking_id,
    actor_id,
    actor_role,
    action,
    old_status,
    new_status,
    reason,
    metadata
  ) values (
    v_booking.id,
    p_actor_id,
    p_actor_role,
    'reschedule_request_approved',
    v_booking.status,
    'rescheduled',
    p_reason,
    jsonb_build_object(
      'rescheduleRequestId', v_request.id,
      'adminOverrideOneWeek', p_admin_override_one_week,
      'oldStartDate', v_booking.start_date,
      'oldEndDate', v_booking.end_date,
      'oldEventDate', v_booking.event_date,
      'newStartDate', v_request.requested_start_date,
      'newEndDate', v_request.requested_end_date,
      'newEventDate', v_request.requested_event_date
    )
  );

  return jsonb_build_object(
    'bookingId', v_booking.id,
    'requestId', v_request.id,
    'status', 'approved'
  );
end;
$$;
