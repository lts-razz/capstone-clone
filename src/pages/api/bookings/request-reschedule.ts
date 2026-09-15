// POST /api/bookings/request-reschedule - customer requests a booking reschedule
import type { APIRoute } from "astro";
import { customerGuard } from "../../../lib/adminGuard";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { parseBody } from "../../../lib/parseBody";
import { ok, error } from "../../../lib/response";
import { normalizeBookingActionReason, normalizeBookingStatus } from "../../../lib/bookingStatus";
import {
  ADVANCE_BOOKING_RULE_MESSAGE,
  getMinimumBookingDate,
  isDateOnly,
  parseDateOnly,
} from "../../../lib/bookingDateRules";
import { validateBookingRescheduleAvailability } from "../../../services/bookingAvailability";
import { logBookingAudit } from "../../../services/bookingAudit";
import {
  applyDateToLocalDateTime,
  normalizePackageTimeOptions,
  validatePackageBookingTimes,
} from "../../../lib/packageTimeOptions";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function combineLocalDateTime(date: string, time?: string | null): string | null {
  const normalizedTime = typeof time === "string" ? time.trim() : "";
  if (!normalizedTime) return null;
  if (!TIME_RE.test(normalizedTime)) return "invalid";
  return `${date}T${normalizedTime}:00`;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await customerGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{
    bookingId?: string;
    requestedStartDate?: string;
    requestedEndDate?: string;
    requestedEventDate?: string | null;
    requestedStartTime?: string | null;
    requestedEndTime?: string | null;
    note?: string | null;
  }>(request);
  if (!body.ok) return body.response;

  const bookingId = body.data.bookingId;
  const requestedStartDate = body.data.requestedStartDate;
  const requestedEndDate = body.data.requestedEndDate;
  const requestedEventDate = body.data.requestedEventDate || null;
  const note = normalizeBookingActionReason(body.data.note);

  if (!bookingId) return error("bookingId is required", 400);
  if (!requestedStartDate) return error("requestedStartDate is required", 400);
  if (!requestedEndDate) return error("requestedEndDate is required", 400);
  if (!isDateOnly(requestedStartDate)) return error("requestedStartDate must use YYYY-MM-DD", 400);
  if (!isDateOnly(requestedEndDate)) return error("requestedEndDate must use YYYY-MM-DD", 400);
  if (requestedEventDate && !isDateOnly(requestedEventDate)) {
    return error("requestedEventDate must use YYYY-MM-DD", 400);
  }
  if (note.length > 500) return error("Note must be 500 characters or fewer.", 400);

  const startDate = parseDateOnly(requestedStartDate);
  const endDate = parseDateOnly(requestedEndDate);
  const eventDate = requestedEventDate ? parseDateOnly(requestedEventDate) : null;

  if (endDate < startDate) {
    return error("requestedEndDate must be on or after requestedStartDate", 400);
  }
  if (eventDate && (eventDate < startDate || eventDate > endDate)) {
    return error("requestedEventDate must fall within the requested start and end dates", 400);
  }

  const minimumBookingDate = getMinimumBookingDate();
  if (startDate < minimumBookingDate || (eventDate !== null && eventDate < minimumBookingDate)) {
    return error(ADVANCE_BOOKING_RULE_MESSAGE, 400);
  }

  const requestedStartDatetime = combineLocalDateTime(requestedStartDate, body.data.requestedStartTime);
  const requestedEndDatetime = combineLocalDateTime(requestedEndDate, body.data.requestedEndTime);
  if (requestedStartDatetime === "invalid") return error("requestedStartTime must use HH:mm", 400);
  if (requestedEndDatetime === "invalid") return error("requestedEndTime must use HH:mm", 400);
  if (requestedStartDatetime && requestedEndDatetime && requestedEndDatetime <= requestedStartDatetime) {
    return error("Requested end date/time must be after requested start date/time", 400);
  }

  const { data: booking, error: bookingError } = await db
    .from("bookings")
    .select("id, user_id, status, venue_id, start_date, end_date, package_id, start_datetime, end_datetime")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) return error("Booking not found", 404);
  if (booking.user_id !== guard.user.id) return error("You can only request changes to your own bookings", 403);

  const bookingStatus = normalizeBookingStatus(booking.status);
  if (bookingStatus !== "booked" && bookingStatus !== "rescheduled") {
    return error("Only secured bookings can request rescheduling.", 409);
  }

  if (booking.package_id) {
    const { data: packageRow, error: packageError } = await db
      .from("packages")
      .select("time_options")
      .eq("id", booking.package_id)
      .maybeSingle();
    if (packageError) return error("Could not verify package schedule rules. Please try again.", 500);
    if (!packageRow) return error("Could not verify package schedule rules. Please try again.", 500);

    const timeOptions = normalizePackageTimeOptions(packageRow?.time_options);
    if (timeOptions) {
      const scheduleStartDatetime =
        requestedStartDatetime ?? applyDateToLocalDateTime(requestedStartDate, booking.start_datetime);
      const scheduleEndDatetime =
        requestedEndDatetime ?? applyDateToLocalDateTime(requestedEndDate, booking.end_datetime);
      if (!scheduleStartDatetime || !scheduleEndDatetime) {
        return error("Please choose a complete start and end time for this package.", 400);
      }
      const packageTimeValidationError = validatePackageBookingTimes(
        timeOptions,
        scheduleStartDatetime,
        scheduleEndDatetime,
      );
      if (packageTimeValidationError) return error(packageTimeValidationError, 400);
    }
  }

  const existing = await db
    .from("booking_reschedule_requests")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing.error) return error("Could not check existing reschedule requests", 500);
  if (existing.data) {
    return error("This booking already has a pending reschedule request.", 409);
  }

  const availability = await validateBookingRescheduleAvailability(db, {
    bookingId,
    primaryVenueId: booking.venue_id,
    startDate: requestedStartDate,
    endDate: requestedEndDate,
  });
  if (availability.error) return error("Could not verify venue availability. Please try again.", 500);
  if (!availability.ok) {
    return error("The requested schedule is not available for all assigned venues.", 409);
  }

  const { data: created, error: insertError } = await db
    .from("booking_reschedule_requests")
    .insert({
      booking_id: bookingId,
      user_id: guard.user.id,
      requested_start_date: requestedStartDate,
      requested_end_date: requestedEndDate,
      requested_event_date: requestedEventDate,
      requested_start_datetime: requestedStartDatetime,
      requested_end_datetime: requestedEndDatetime,
      customer_note: note || null,
      status: "pending",
    })
    .select("id, status")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return error("This booking already has a pending reschedule request.", 409);
    }
    console.error("[RequestReschedule]", insertError.message);
    return error("Could not submit the reschedule request. Please try again.", 500);
  }

  await logBookingAudit({
    bookingId,
    actorId: guard.user.id,
    actorType: "customer",
    action: "reschedule_request_submitted",
    fromStatus: bookingStatus,
    toStatus: bookingStatus,
    metadata: {
      rescheduleRequestId: created.id,
      oldStartDate: booking.start_date,
      oldEndDate: booking.end_date,
      requestedStartDate,
      requestedEndDate,
      requestedEventDate,
      venueIds: availability.venueIds,
    },
  }, db);

  return ok({
    message: "Reschedule request submitted for staff review.",
    request: created,
  });
};
