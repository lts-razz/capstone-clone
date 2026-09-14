// POST /api/admin/reschedule - reschedule a booking (staff or admin)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { staffOrAdminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import {
  bookingActionReasonError,
  bookingStatusTransitionErrorMessage,
  isValidBookingStatusTransition,
  normalizeBookingActionReason,
  normalizeBookingStatus,
} from "../../../lib/bookingStatus";
import {
  BookingStatusTransitionError,
  updateBookingStatusAndNotify,
} from "../../../services/notifications";
import {
  ADVANCE_BOOKING_RULE_MESSAGE,
  getMinimumBookingDate,
  isDateOnly,
  parseDateOnly,
} from "../../../lib/bookingDateRules";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await staffOrAdminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{
    bookingId?: string;
    newStartDate?: string;
    newEndDate?: string;
    newEventDate?: string | null;
    adminOverrideOneWeek?: boolean;
    overrideReason?: string;
    confirmedSensitiveAction?: boolean;
  }>(request);
  if (!body.ok) return body.response;

  const { bookingId, newStartDate, newEndDate } = body.data;
  const newEventDate = body.data.newEventDate || null;
  const adminOverrideOneWeek = body.data.adminOverrideOneWeek === true;
  const overrideReason = normalizeBookingActionReason(body.data.overrideReason);

  if (body.data.confirmedSensitiveAction !== true) {
    return error("Explicit confirmation is required before rescheduling a booking.", 400);
  }

  if (!bookingId) return error("bookingId is required", 400);
  if (!newStartDate) return error("newStartDate is required", 400);
  if (!newEndDate) return error("newEndDate is required", 400);

  if (!isDateOnly(newStartDate)) return error("newStartDate must use YYYY-MM-DD", 400);
  if (!isDateOnly(newEndDate)) return error("newEndDate must use YYYY-MM-DD", 400);
  if (newEventDate && !isDateOnly(newEventDate)) {
    return error("newEventDate must use YYYY-MM-DD", 400);
  }

  const startDate = parseDateOnly(newStartDate);
  const endDate = parseDateOnly(newEndDate);
  const eventDate = newEventDate ? parseDateOnly(newEventDate) : null;

  if (endDate < startDate) {
    return error("newEndDate must be on or after newStartDate", 400);
  }

  if (eventDate && (eventDate < startDate || eventDate > endDate)) {
    return error("newEventDate must fall within the new start and end dates", 400);
  }

  const minimumBookingDate = getMinimumBookingDate();
  const requiresOneWeekOverride =
    startDate < minimumBookingDate || (eventDate !== null && eventDate < minimumBookingDate);

  if (requiresOneWeekOverride && adminOverrideOneWeek !== true) {
    return error(
      `${ADVANCE_BOOKING_RULE_MESSAGE} This reschedule requires admin override confirmation.`,
      400,
    );
  }
  if (adminOverrideOneWeek && guard.role !== "admin") {
    return error("Forbidden: date-rule override requires an admin account", 403);
  }
  const overrideReasonError = bookingActionReasonError(
    overrideReason,
    "Override",
    adminOverrideOneWeek,
  );
  if (overrideReasonError) return error(overrideReasonError, 400);

  const { data: booking, error: fetchError } = await db
    .from("bookings")
    .select("id, status, venue_id, start_date, end_date, event_date, start_datetime, end_datetime")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) return error("Booking not found", 404);
  const bookingStatus = normalizeBookingStatus(booking.status);
  if (!isValidBookingStatusTransition(bookingStatus, "rescheduled")) {
    return error(bookingStatusTransitionErrorMessage(bookingStatus, "rescheduled"), 409);
  }

  const updateData: Record<string, string> = {
    start_date: newStartDate,
    end_date: newEndDate,
    event_date: newEventDate ?? newStartDate,
  };
  if (booking.start_datetime) {
    updateData.start_datetime = `${newStartDate}${booking.start_datetime.slice(10)}`;
  }
  if (booking.end_datetime) {
    updateData.end_datetime = `${newEndDate}${booking.end_datetime.slice(10)}`;
  }
  if (adminOverrideOneWeek) updateData.override_reason = overrideReason;

  try {
    const result = await updateBookingStatusAndNotify(bookingId, "rescheduled", {
      client: db,
      update: updateData,
      actorId: guard.user.id,
      actorType: guard.role,
      reason: overrideReason || null,
      metadata: {
        adminOverrideOneWeek,
        oldStartDate: booking.start_date,
        oldEndDate: booking.end_date,
        oldEventDate: booking.event_date,
        newStartDate,
        newEndDate,
        newEventDate,
      },
    });
    return ok({
      message: "Booking rescheduled successfully",
      bookingId,
      booking: result.booking,
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : "Booking update failed";
    console.error("[Reschedule]", message);
    if (updateError instanceof BookingStatusTransitionError) {
      return error(message, 409);
    }
    if (message.includes("booking_unavailable")) {
      return error("The selected schedule is no longer available. Please choose another date or time.", 409);
    }
    if (message.includes("invalid_booking_schedule") || message.includes("invalid_booking_venues")) {
      return error("The replacement schedule or venues could not be verified.", 400);
    }
    return error("We could not reschedule this booking. Please try again.", 500);
  }
};
