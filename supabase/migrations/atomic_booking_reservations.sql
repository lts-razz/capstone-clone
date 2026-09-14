-- A booking INSERT is the reservation operation. Its trigger resolves the
-- package's venues, locks them, checks availability, and snapshots every venue
-- before the statement can commit. No caller inserts snapshots separately.

-- Repair older single-venue snapshots before enabling conflict checks. Existing
-- overlapping history is retained; this migration never discards bookings.
insert into public.booking_venue_assignments (booking_id, venue_id)
select id, venue_id from public.bookings where venue_id is not null
on conflict (booking_id, venue_id) do nothing;

create index if not exists bookings_reservation_dates_idx
on public.bookings (start_date, end_date)
where status <> 'cancelled';

create or replace function public.check_booking_reservation(
  p_venue_ids uuid[], p_start_date date, p_end_date date, p_exclude_booking_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_venue_id uuid;
  v_ids uuid[];
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'invalid_booking_schedule' using errcode = '22023';
  end if;

  select array_agg(distinct venue_id order by venue_id) into v_ids
  from unnest(p_venue_ids) as input_venues(venue_id)
  where venue_id is not null;
  if coalesce(array_length(v_ids, 1), 0) = 0 then
    raise exception 'invalid_booking_venues' using errcode = '22023';
  end if;

  -- NO KEY UPDATE serializes reservations while remaining compatible with
  -- the KEY SHARE locks acquired by venue foreign keys during INSERT.
  foreach v_venue_id in array v_ids loop
    perform 1 from public.venues
    where id = v_venue_id and is_active = true
    for no key update;
    if not found then
      raise exception 'invalid_booking_venues' using errcode = '22023';
    end if;
  end loop;

  -- These reads run after every venue lock is acquired. Under READ COMMITTED,
  -- a waiter sees the preceding transaction's committed booking.
  if exists (
    select 1 from public.bookings b
    where b.id is distinct from p_exclude_booking_id
      and b.status is distinct from 'cancelled'
      and b.start_date <= p_end_date and b.end_date >= p_start_date
      and (
        b.status is distinct from 'pending'
        or (
          b.reservation_expired_at is null
          and (
            b.reservation_expires_at is null
            or b.reservation_expires_at > clock_timestamp()
            or exists (
              select 1 from public.booking_payments payment
              where payment.booking_id = b.id
                and payment.payment_status in ('partial', 'paid')
                and coalesce(payment.minimum_payment_amount, b.minimum_payment_amount, b.total_price * 0.5) > 0
                and payment.amount_paid >= coalesce(payment.minimum_payment_amount, b.minimum_payment_amount, b.total_price * 0.5)
            )
          )
        )
      )
      and (
        b.venue_id = any(v_ids)
        or exists (
          select 1 from public.booking_venue_assignments assignment
          where assignment.booking_id = b.id and assignment.venue_id = any(v_ids)
        )
      )
  ) or exists (
    select 1 from public.blocked_dates blocked
    where blocked.is_active = true
      and blocked.venue_id = any(v_ids)
      and blocked.start_date <= p_end_date
      and blocked.end_date >= p_start_date
  ) then
    raise exception 'booking_unavailable' using errcode = '23P01';
  end if;
end;
$$;

create or replace function public.reserve_booking_venues()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_venue_ids uuid[];
  v_package public.packages%rowtype;
  v_membership_changed boolean;
begin
  if tg_op = 'INSERT' then
    v_membership_changed := true;
    if auth.role() in ('anon', 'authenticated')
      and (auth.uid() is null or new.user_id is distinct from auth.uid()) then
      raise exception 'invalid_booking_owner' using errcode = '42501';
    end if;
  else
    v_membership_changed := new.package_id is distinct from old.package_id
      or new.venue_id is distinct from old.venue_id;
  end if;

  if new.status is null or new.venue_id is null
    or new.start_date is null or new.end_date is null or new.end_date < new.start_date
    or (new.event_date is not null and (new.event_date < new.start_date or new.event_date > new.end_date))
    or (new.start_datetime is not null and new.start_datetime::date <> new.start_date)
    or (new.end_datetime is not null and new.end_datetime::date <> new.end_date)
    or (new.start_datetime is not null and new.end_datetime is not null
        and new.end_datetime <= new.start_datetime) then
    raise exception 'invalid_booking_schedule' using errcode = '22023';
  end if;

  if v_membership_changed then
    if new.package_id is not null then
      select * into v_package from public.packages
      where id = new.package_id for no key update;
      if not found or not v_package.is_active then
        raise exception 'invalid_booking_venues' using errcode = '22023';
      end if;
      select array_agg(distinct venue_id order by venue_id) into v_venue_ids
      from (
        select v_package.venue_id as venue_id
        union all
        select venue_id from public.package_venue_assignments
        where package_id = new.package_id
      ) required_venues
      where venue_id is not null;
      if v_venue_ids is null or new.venue_id <> all(v_venue_ids) then
        raise exception 'invalid_booking_venues' using errcode = '22023';
      end if;
    else
      v_venue_ids := array[new.venue_id];
    end if;
  else
    -- Existing bookings keep their historical venue snapshots when a package
    -- definition changes after purchase.
    select array_agg(distinct venue_id order by venue_id) into v_venue_ids
    from (
      select new.venue_id as venue_id
      union all
      select venue_id from public.booking_venue_assignments
      where booking_id = new.id
    ) reserved_venues
    where venue_id is not null;
  end if;

  if new.status <> 'cancelled' then
    perform public.check_booking_reservation(v_venue_ids, new.start_date, new.end_date, new.id);
  end if;

  if tg_op = 'INSERT' then
    insert into public.booking_venue_assignments (booking_id, venue_id)
    select new.id, venue_id from unnest(v_venue_ids) as reserved_venues(venue_id);
  elsif v_membership_changed then
    delete from public.booking_venue_assignments where booking_id = new.id;
    insert into public.booking_venue_assignments (booking_id, venue_id)
    select new.id, venue_id from unnest(v_venue_ids) as reserved_venues(venue_id);
  end if;
  return new;
end;
$$;

drop trigger if exists reserve_booking_venues_after_insert on public.bookings;
create trigger reserve_booking_venues_after_insert
after insert on public.bookings
for each row execute function public.reserve_booking_venues();

drop trigger if exists reserve_booking_venues_after_update on public.bookings;
create trigger reserve_booking_venues_after_update
after update of start_date, end_date, event_date, start_datetime, end_datetime,
  status, venue_id, package_id, reservation_expires_at, reservation_expired_at,
  minimum_payment_amount
on public.bookings
for each row
when (
  old.start_date is distinct from new.start_date
  or old.end_date is distinct from new.end_date
  or old.event_date is distinct from new.event_date
  or old.start_datetime is distinct from new.start_datetime
  or old.end_datetime is distinct from new.end_datetime
  or old.status is distinct from new.status
  or old.venue_id is distinct from new.venue_id
  or old.package_id is distinct from new.package_id
  or old.reservation_expires_at is distinct from new.reservation_expires_at
  or old.reservation_expired_at is distinct from new.reservation_expired_at
  or old.minimum_payment_amount is distinct from new.minimum_payment_amount
)
execute function public.reserve_booking_venues();

-- A direct assignment addition cannot bypass the same venue lock and check.
create or replace function public.check_booking_venue_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_booking public.bookings%rowtype;
begin
  -- Only the booking trigger may maintain the historical venue snapshot.
  if pg_trigger_depth() = 1 then
    raise exception 'reservation_assignments_managed' using errcode = '42501';
  end if;
  select * into v_booking from public.bookings where id = new.booking_id;
  if found and v_booking.status <> 'cancelled' then
    perform public.check_booking_reservation(
      array[new.venue_id], v_booking.start_date, v_booking.end_date, new.booking_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists check_booking_venue_assignment_before_write on public.booking_venue_assignments;
create trigger check_booking_venue_assignment_before_write
before insert or update of booking_id, venue_id on public.booking_venue_assignments
for each row execute function public.check_booking_venue_assignment();

create or replace function public.protect_booking_venue_assignment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if pg_trigger_depth() = 1 then
    raise exception 'reservation_assignments_managed' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_booking_venue_assignment_before_change on public.booking_venue_assignments;
create trigger protect_booking_venue_assignment_before_change
before update or delete on public.booking_venue_assignments
for each row execute function public.protect_booking_venue_assignment();

-- An expired pending hold can become secured by a late payment. Treat that as
-- reacquiring the venue before the payment record is allowed to change.
create or replace function public.check_late_booking_payment()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_booking public.bookings%rowtype;
  v_venue_ids uuid[];
begin
  select * into v_booking from public.bookings where id = new.booking_id;
  if found and v_booking.status = 'pending'
    and v_booking.reservation_expired_at is null
    and v_booking.reservation_expires_at <= clock_timestamp()
    and new.payment_status in ('partial', 'paid')
    and coalesce(new.minimum_payment_amount, v_booking.minimum_payment_amount, v_booking.total_price * 0.5) > 0
    and new.amount_paid >= coalesce(new.minimum_payment_amount, v_booking.minimum_payment_amount, v_booking.total_price * 0.5) then
    select array_agg(distinct venue_id order by venue_id) into v_venue_ids
    from (
      select v_booking.venue_id as venue_id
      union all
      select venue_id from public.booking_venue_assignments
      where booking_id = new.booking_id
    ) reserved_venues
    where venue_id is not null;
    perform public.check_booking_reservation(
      v_venue_ids, v_booking.start_date, v_booking.end_date, new.booking_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists check_late_booking_payment_before_write on public.booking_payments;
create trigger check_late_booking_payment_before_write
before insert or update of amount_paid, payment_status, minimum_payment_amount, booking_id on public.booking_payments
for each row execute function public.check_late_booking_payment();

-- Block creation/activation participates in the same per-venue ordering.
create or replace function public.lock_blocked_date_venue()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.is_active then
    perform 1 from public.venues where id = new.venue_id for no key update;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_blocked_date_venue_before_write on public.blocked_dates;
create trigger lock_blocked_date_venue_before_write
before insert or update of venue_id, start_date, end_date, is_active on public.blocked_dates
for each row execute function public.lock_blocked_date_venue();

-- Package membership is read while holding the package row; serialize edits
-- to that membership with new bookings of the same package.
create or replace function public.lock_package_venue_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_package_id uuid;
begin
  if tg_op = 'DELETE' then
    v_package_id := old.package_id;
  else
    v_package_id := new.package_id;
  end if;
  perform 1 from public.packages where id = v_package_id for no key update;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_package_venue_membership_before_write on public.package_venue_assignments;
create trigger lock_package_venue_membership_before_write
before insert or update or delete on public.package_venue_assignments
for each row execute function public.lock_package_venue_membership();

revoke all on function public.check_booking_reservation(uuid[], date, date, uuid) from public, anon, authenticated;
revoke all on function public.reserve_booking_venues() from public, anon, authenticated;
revoke all on function public.check_booking_venue_assignment() from public, anon, authenticated;
revoke all on function public.protect_booking_venue_assignment() from public, anon, authenticated;
revoke all on function public.check_late_booking_payment() from public, anon, authenticated;
revoke all on function public.lock_blocked_date_venue() from public, anon, authenticated;
revoke all on function public.lock_package_venue_membership() from public, anon, authenticated;
