import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

type DbClient = SupabaseClient<Database>;
type AvailabilityBooking = {
  id: string;
  venue_id: string;
  start_date: string;
  end_date: string;
  event_date: string | null;
  status: string;
  reservation_expires_at: string | null;
  reservation_expired_at: string | null;
  minimum_payment_amount: number | null;
  total_price: number | null;
};

export type AvailabilityOverlapOptions = {
  venueId?: string;
  venueIds?: string[];
  startDate: string;
  endDate: string;
  excludeBookingId?: string;
};

export type AvailabilityRangeOptions = {
  venueId?: string | null;
  venueIds?: string[];
  startDate: string;
  endDate: string;
};

export function applyDateRangeOverlap(query: any, startDate: string, endDate: string) {
  // Availability is intentionally inclusive and date-only. Booking times never
  // reduce a reservation to a partial day or permit another same-day booking.
  return query.lte("start_date", endDate).gte("end_date", startDate);
}

function isBlockedDateActive(row: object): boolean {
  return !("is_active" in row) || row.is_active !== false;
}

function normalizeVenueIds(venueId?: string | null, venueIds?: string[]) {
  return [...new Set([...(venueIds ?? []), ...(venueId ? [venueId] : [])].filter(Boolean))];
}

export async function getBookingVenueIds(client: DbClient, bookingId: string, primaryVenueId: string) {
  const { data, error } = await client
    .from("booking_venue_assignments")
    .select("venue_id")
    .eq("booking_id", bookingId);

  return {
    venueIds: normalizeVenueIds(primaryVenueId, (data ?? []).map((assignment) => assignment.venue_id)),
    error,
  };
}

export async function findAvailabilityOverlaps(
  client: DbClient,
  { venueId, venueIds, startDate, endDate, excludeBookingId }: AvailabilityOverlapOptions,
) {
  const checkedVenueIds = normalizeVenueIds(venueId, venueIds);
  const availability = await getAvailabilityRanges(client, {
    venueIds: checkedVenueIds,
    startDate,
    endDate,
  });
  const allBookings = availability.bookings.filter((booking) => booking.id !== excludeBookingId);

  return {
    bookings: allBookings,
    blockedDates: availability.blockedDates,
    unavailableVenueIds: [...new Set([
      ...allBookings.map((booking) => booking.venue_id),
      ...availability.blockedDates.map((blockedDate: { venue_id: string }) => blockedDate.venue_id),
    ])],
    error: availability.error,
  };
}

export async function getAvailabilityRanges(
  client: DbClient,
  { venueId, venueIds, startDate, endDate }: AvailabilityRangeOptions,
) {
  const checkedVenueIds = normalizeVenueIds(venueId, venueIds);
  let blockedDatesQuery = applyDateRangeOverlap(
    client
      .from("blocked_dates")
      .select("*"),
    startDate,
    endDate,
  );

  if (checkedVenueIds.length > 0) {
    blockedDatesQuery = blockedDatesQuery.in("venue_id", checkedVenueIds);
  }

  const allBookings: AvailabilityBooking[] = [];
  let bookingsError: Error | null = null;
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await applyDateRangeOverlap(
      client
        .from("bookings")
        .select("id, venue_id, start_date, end_date, event_date, status, reservation_expires_at, reservation_expired_at, minimum_payment_amount, total_price")
        .neq("status", "cancelled"),
      startDate,
      endDate,
    ).order("id").range(offset, offset + pageSize - 1);
    if (error) {
      bookingsError = error;
      break;
    }
    const page: AvailabilityBooking[] = data ?? [];
    allBookings.push(...page);
    if (page.length < pageSize) break;
  }
  const { data: blockedDates, error: blockedDatesError } = await blockedDatesQuery;

  const now = new Date().toISOString();
  const expiredPending = allBookings.filter((booking) =>
    booking.status === "pending"
    && booking.reservation_expired_at === null
    && booking.reservation_expires_at !== null
    && booking.reservation_expires_at <= now,
  );
  const securedExpiredIds = new Set<string>();
  let paymentsError: Error | null = null;
  for (let index = 0; index < expiredPending.length; index += 100) {
    const batch = expiredPending.slice(index, index + 100);
    const { data, error } = await client
      .from("booking_payments")
      .select("booking_id, amount_paid, payment_status, minimum_payment_amount")
      .in("booking_id", batch.map((booking) => booking.id));
    if (error) {
      paymentsError = error;
      break;
    }
    const bookingById = new Map(batch.map((booking) => [booking.id, booking]));
    for (const payment of data ?? []) {
      const booking = bookingById.get(payment.booking_id);
      const minimum = Number(payment.minimum_payment_amount ?? booking?.minimum_payment_amount ?? Number(booking?.total_price ?? 0) * 0.5);
      if ((payment.payment_status === "partial" || payment.payment_status === "paid")
        && minimum > 0 && Number(payment.amount_paid) >= minimum) {
        securedExpiredIds.add(payment.booking_id);
      }
    }
  }
  const activeBookings = allBookings.filter((booking) =>
    booking.status !== "pending"
    || (booking.reservation_expired_at === null && (
      booking.reservation_expires_at === null
      || booking.reservation_expires_at > now
      || securedExpiredIds.has(booking.id)
    )),
  );

  // Existing bookings retain their primary venue; assignment rows snapshot every
  // venue they reserve, including secondary package venues.
  const bookingIds = activeBookings.map((booking) => booking.id);
  const assignments: Array<{ booking_id: string; venue_id: string }> = [];
  let assignmentsError: Error | null = null;
  if (checkedVenueIds.length > 0) {
    for (let index = 0; index < bookingIds.length; index += 100) {
      const batchIds = bookingIds.slice(index, index + 100);
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await client
          .from("booking_venue_assignments")
          .select("booking_id, venue_id")
          .in("booking_id", batchIds)
          .in("venue_id", checkedVenueIds)
          .order("id")
          .range(offset, offset + pageSize - 1);
        if (error) {
          assignmentsError = error;
          break;
        }
        const page = data ?? [];
        assignments.push(...page);
        if (page.length < pageSize) break;
      }
      if (assignmentsError) break;
    }
  }

  const checkedVenueSet = new Set(checkedVenueIds);
  const assignmentsByBooking = new Map<string, string[]>();
  for (const assignment of assignments ?? []) {
    const ids = assignmentsByBooking.get(assignment.booking_id) ?? [];
    ids.push(assignment.venue_id);
    assignmentsByBooking.set(assignment.booking_id, ids);
  }
  const matchingBookings = checkedVenueIds.length === 0
    ? activeBookings
    : activeBookings.flatMap((booking) => {
        const reservedVenueIds = new Set([booking.venue_id, ...(assignmentsByBooking.get(booking.id) ?? [])]);
        return [...reservedVenueIds]
          .filter((id) => checkedVenueSet.has(id))
          .map((id) => ({ ...booking, venue_id: id }));
      });

  return {
    bookings: matchingBookings,
    blockedDates: (blockedDates ?? []).filter(isBlockedDateActive),
    error: bookingsError ?? blockedDatesError ?? paymentsError ?? assignmentsError,
  };
}

export async function getUnavailableVenueIdsForRange(
  client: DbClient,
  { venueIds, startDate, endDate }: { venueIds: string[]; startDate: string; endDate: string },
) {
  const availability = await getAvailabilityRanges(client, {
    venueIds,
    startDate,
    endDate,
  });

  return {
    venueIds: [...new Set([
      ...availability.bookings.map((booking: { venue_id: string }) => booking.venue_id),
      ...availability.blockedDates.map((blockedDate: { venue_id: string }) => blockedDate.venue_id),
    ])],
    error: availability.error,
  };
}

export async function validateBookingRescheduleAvailability(
  client: DbClient,
  {
    bookingId,
    primaryVenueId,
    startDate,
    endDate,
  }: { bookingId: string; primaryVenueId: string; startDate: string; endDate: string },
) {
  const bookingVenues = await getBookingVenueIds(client, bookingId, primaryVenueId);
  if (bookingVenues.error) {
    return {
      ok: false,
      reason: "venue_lookup_failed" as const,
      venueIds: bookingVenues.venueIds,
      error: bookingVenues.error,
    };
  }

  const availabilityOverlap = await findAvailabilityOverlaps(client, {
    venueIds: bookingVenues.venueIds,
    startDate,
    endDate,
    excludeBookingId: bookingId,
  });
  if (availabilityOverlap.error) {
    return {
      ok: false,
      reason: "availability_lookup_failed" as const,
      venueIds: bookingVenues.venueIds,
      error: availabilityOverlap.error,
    };
  }

  const unavailable =
    availabilityOverlap.bookings.length > 0 || availabilityOverlap.blockedDates.length > 0;
  return {
    ok: !unavailable,
    reason: unavailable ? ("unavailable" as const) : null,
    venueIds: bookingVenues.venueIds,
    unavailableVenueIds: availabilityOverlap.unavailableVenueIds,
    bookings: availabilityOverlap.bookings,
    blockedDates: availabilityOverlap.blockedDates,
    error: null,
  };
}
