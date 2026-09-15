import type { APIRoute } from "astro";
import { adminGuard } from "../../../lib/adminGuard";
import {
  isRecognizedBookingStatus,
  normalizeBookingStatus,
} from "../../../lib/bookingStatus";
import { error, ok } from "../../../lib/response";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { calculateSalesReport, getSalesReportRange, type SalesReportPeriod } from "../../../services/salesReports";
import { normalizeBookingPaymentStatus } from "../../../lib/reservationValidity";

export const prerender = false;
const db = supabaseAdmin ?? supabase;

export const GET: APIRoute = async ({ cookies, url }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const period = url.searchParams.get("period") as SalesReportPeriod | null;
  const anchor = url.searchParams.get("anchor");
  if ((period !== "weekly" && period !== "monthly") || !anchor) {
    return error("period must be weekly or monthly, and anchor is required", 400);
  }

  let range;
  try {
    range = getSalesReportRange(period, anchor);
  } catch (rangeError) {
    return error(rangeError instanceof Error ? rangeError.message : "Invalid report range", 400);
  }

  const { data: bookings, error: bookingsError } = await db
    .from("bookings")
    .select("id, full_name, status, created_at, event_date, start_date, total_price, package_id, package_type, venue_id, pax")
    .gte("created_at", range.start)
    .lt("created_at", range.endExclusive)
    .order("created_at", { ascending: true });
  if (bookingsError) {
    console.error("[SalesReport] bookings:", bookingsError.message);
    return error("Could not load report bookings", 500);
  }

  const validBookings = (bookings ?? [])
    .filter((booking) => isRecognizedBookingStatus(booking.status))
    .map((booking) => ({
      ...booking,
      status: normalizeBookingStatus(booking.status),
    }));
  const bookingIds = validBookings.map((booking) => booking.id);
  const packageIds = [...new Set(validBookings.map((booking) => booking.package_id).filter((id): id is string => Boolean(id)))];
  const venueIds = [...new Set(validBookings.map((booking) => booking.venue_id).filter((id): id is string => Boolean(id)))];
  const [{ data: payments, error: paymentsError }, { data: packages, error: packagesError }, { data: venueAssignments, error: venueAssignmentsError }, { data: venues, error: venuesError }] = await Promise.all([
    bookingIds.length
      ? db.from("booking_payments").select("booking_id, total_booking_amount, amount_paid, payment_status").in("booking_id", bookingIds)
      : Promise.resolve({ data: [], error: null }),
    packageIds.length
      ? db.from("packages").select("id, name").in("id", packageIds)
      : Promise.resolve({ data: [], error: null }),
    bookingIds.length
      ? db.from("booking_venue_assignments").select("booking_id, venue_id").in("booking_id", bookingIds)
      : Promise.resolve({ data: [], error: null }),
    venueIds.length
      ? db.from("venues").select("id, name").in("id", venueIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (paymentsError || packagesError || venueAssignmentsError || venuesError) {
    console.error("[SalesReport] related data:", paymentsError?.message ?? packagesError?.message ?? venueAssignmentsError?.message ?? venuesError?.message);
    return error("Could not load report payment or package data", 500);
  }

  const packageNames = Object.fromEntries((packages ?? []).map((item) => [item.id, item.name]));
  const venueNames: Record<string, string> = Object.fromEntries((venues ?? []).map((item) => [item.id, item.name]));
  const venueIdsByBookingId = new Map<string, string[]>();
  for (const assignment of venueAssignments ?? []) {
    if (!assignment.booking_id || !assignment.venue_id) continue;
    const ids = venueIdsByBookingId.get(assignment.booking_id) ?? [];
    ids.push(assignment.venue_id);
    venueIdsByBookingId.set(assignment.booking_id, ids);
  }
  const assignedVenueIds = [...new Set((venueAssignments ?? []).map((assignment) => assignment.venue_id).filter((id): id is string => Boolean(id)))];
  const missingVenueIds = assignedVenueIds.filter((id) => !(id in venueNames));
  if (missingVenueIds.length) {
    const { data: assignedVenues, error: assignedVenuesError } = await db
      .from("venues")
      .select("id, name")
      .in("id", missingVenueIds);
    if (assignedVenuesError) {
      console.error("[SalesReport] assigned venues:", assignedVenuesError.message);
      return error("Could not load report venue data", 500);
    }
    for (const venue of assignedVenues ?? []) {
      venueNames[venue.id] = venue.name;
    }
  }
  const normalizedPayments = (payments ?? []).map((item) => ({
    ...item,
    payment_status: normalizeBookingPaymentStatus(item.payment_status),
  }));
  const paymentByBooking = Object.fromEntries(normalizedPayments.map((item) => [item.booking_id, item]));
  const reportBookings = validBookings.map((booking) => {
    const bookingVenueIds = [...new Set([booking.venue_id, ...(venueIdsByBookingId.get(booking.id) ?? [])].filter((id): id is string => Boolean(id)))];
    const venueLabels = bookingVenueIds.length
      ? bookingVenueIds.map((id) => venueNames[id] ?? "Unknown venue")
      : ["Unspecified venue"];
    return {
      ...booking,
      venue_ids: bookingVenueIds,
      venueName: venueLabels.join(", "),
      packageName: booking.package_id
        ? (packageNames[booking.package_id] ?? booking.package_type ?? "Unspecified package")
        : (booking.package_type ?? "Unspecified package"),
      payment: paymentByBooking[booking.id] ?? null,
    };
  });

  return ok({
    report: calculateSalesReport(reportBookings, normalizedPayments, range, packageNames, venueNames),
    bookings: reportBookings,
  });
};
