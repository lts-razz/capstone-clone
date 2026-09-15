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
  notificationChannelSucceeded,
  notifyBookingStatusChange,
  updateBookingStatusAndNotify,
} from "../../../services/notifications";
import { logBookingAudit } from "../../../services/bookingAudit";
import {
  ADVANCE_BOOKING_RULE_MESSAGE,
  getMinimumBookingDate,
  isDateOnly,
  parseDateOnly,
} from "../../../lib/bookingDateRules";
import { validateBookingRescheduleAvailability } from "../../../services/bookingAvailability";
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

function notificationWarning(result: Awaited<ReturnType<typeof notifyBookingStatusChange>>) {
  const unavailableChannels = (["email", "sms"] as const).filter((channel) => {
    const channelResult = result[channel];
    if (!channelResult) return false;
    if (notificationChannelSucceeded(channelResult)) return false;
    if (channelResult.ok && "skipped" in channelResult) {
      return !channelResult.reason.includes("disabled for this customer");
    }
    return true;
  });

  if (unavailableChannels.length === 0) return undefined;
  if (unavailableChannels.length === 2) {
    return "The booking was updated, but email and SMS notifications could not be sent.";
  }
  return `The booking was updated, but the ${unavailableChannels[0]} notification could not be sent.`;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await staffOrAdminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{
    bookingId?: string;
    rescheduleRequestId?: string;
    decision?: "approve" | "reject";
    newStartDate?: string;
    newEndDate?: string;
    newEventDate?: string | null;
    newStartTime?: string | null;
    newEndTime?: string | null;
    adminOverrideOneWeek?: boolean;
    overrideReason?: string;
    reviewNote?: string;
    confirmedSensitiveAction?: boolean;
  }>(request);
  if (!body.ok) return body.response;

  const { bookingId, newStartDate, newEndDate } = body.data;
  const rescheduleRequestId = body.data.rescheduleRequestId;
  const decision = body.data.decision;
  const newEventDate = body.data.newEventDate || null;
  const adminOverrideOneWeek = body.data.adminOverrideOneWeek === true;
  const overrideReason = normalizeBookingActionReason(body.data.overrideReason);
  const reviewNote = normalizeBookingActionReason(body.data.reviewNote);

  if (body.data.confirmedSensitiveAction !== true) {
    return error("Explicit confirmation is required before rescheduling a booking.", 400);
  }

  if (decision === "reject") {
    if (!rescheduleRequestId) return error("rescheduleRequestId is required", 400);
    if (reviewNote.length > 500) return error("Review note must be 500 characters or fewer.", 400);

    const { data: requestRow, error: requestFetchError } = await db
      .from("booking_reschedule_requests")
      .select("id, booking_id, status, requested_start_date, requested_end_date, requested_event_date, requested_start_datetime, requested_end_datetime")
      .eq("id", rescheduleRequestId)
      .maybeSingle();
    if (requestFetchError) return error("Could not load the reschedule request.", 500);
    if (!requestRow) return error("Reschedule request not found", 404);
    if (requestRow.status !== "pending") return error("This reschedule request is no longer pending.", 409);

    const now = new Date().toISOString();
    const { data: rejected, error: rejectError } = await db
      .from("booking_reschedule_requests")
      .update({
        status: "rejected",
        reviewed_by: guard.user.id,
        reviewed_role: guard.role,
        reviewed_at: now,
        review_note: reviewNote || null,
        updated_at: now,
      })
      .eq("id", rescheduleRequestId)
      .eq("status", "pending")
      .select("id, booking_id, status")
      .maybeSingle();

    if (rejectError) return error("Could not reject the reschedule request.", 500);
    if (!rejected) return error("This reschedule request changed while it was being reviewed.", 409);

    await logBookingAudit({
      bookingId: rejected.booking_id,
      actorId: guard.user.id,
      actorType: guard.role,
      action: "reschedule_request_rejected",
      reason: reviewNote || null,
      metadata: {
        rescheduleRequestId,
        requestedStartDate: requestRow.requested_start_date,
        requestedEndDate: requestRow.requested_end_date,
        requestedEventDate: requestRow.requested_event_date,
      },
    }, db);

    return ok({
      message: "Reschedule request rejected.",
      request: rejected,
    });
  }

  if (decision === "approve") {
    if (!rescheduleRequestId) return error("rescheduleRequestId is required", 400);

    const { data: requestRow, error: requestFetchError } = await db
      .from("booking_reschedule_requests")
      .select("id, booking_id, status, requested_start_date, requested_end_date, requested_event_date")
      .eq("id", rescheduleRequestId)
      .maybeSingle();
    if (requestFetchError) return error("Could not load the reschedule request.", 500);
    if (!requestRow) return error("Reschedule request not found", 404);
    if (requestRow.status !== "pending") return error("This reschedule request is no longer pending.", 409);

    const { data: booking, error: bookingFetchError } = await db
      .from("bookings")
      .select("id, status, venue_id, start_date, end_date, event_date, package_id, start_datetime, end_datetime")
      .eq("id", requestRow.booking_id)
      .single();
    if (bookingFetchError || !booking) return error("Booking not found", 404);
    const bookingStatus = normalizeBookingStatus(booking.status);
    if (!isValidBookingStatusTransition(bookingStatus, "rescheduled")) {
      return error(bookingStatusTransitionErrorMessage(bookingStatus, "rescheduled"), 409);
    }

    const startDate = parseDateOnly(requestRow.requested_start_date);
    const eventDate = requestRow.requested_event_date ? parseDateOnly(requestRow.requested_event_date) : null;
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
    const requestOverrideReasonError = bookingActionReasonError(
      overrideReason,
      "Override",
      adminOverrideOneWeek,
    );
    if (requestOverrideReasonError) return error(requestOverrideReasonError, 400);

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
          requestRow.requested_start_datetime
          ?? applyDateToLocalDateTime(requestRow.requested_start_date, booking.start_datetime);
        const scheduleEndDatetime =
          requestRow.requested_end_datetime
          ?? applyDateToLocalDateTime(requestRow.requested_end_date, booking.end_datetime);
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

    const availability = await validateBookingRescheduleAvailability(db, {
      bookingId: booking.id,
      primaryVenueId: booking.venue_id,
      startDate: requestRow.requested_start_date,
      endDate: requestRow.requested_end_date,
    });
    if (availability.error) return error("Could not verify venue availability. Please try again.", 500);
    if (!availability.ok) {
      return error("The selected schedule is no longer available for all assigned venues.", 409);
    }

    const { data: approval, error: approvalError } = await db.rpc(
      "approve_booking_reschedule_request",
      {
        p_request_id: rescheduleRequestId,
        p_actor_id: guard.user.id,
        p_actor_role: guard.role,
        p_reason: overrideReason || reviewNote || null,
        p_admin_override_one_week: adminOverrideOneWeek,
      },
    );

    if (approvalError) {
      console.error("[RescheduleRequestApprove]", approvalError.message);
      if (approvalError.message.includes("booking_unavailable")) {
        return error("The selected schedule is no longer available. Please choose another date or time.", 409);
      }
      if (approvalError.message.includes("reschedule_request_not_pending")) {
        return error("This reschedule request is no longer pending.", 409);
      }
      if (approvalError.message.includes("invalid_booking_schedule") || approvalError.message.includes("invalid_booking_venues")) {
        return error("The replacement schedule or venues could not be verified.", 400);
      }
      return error("Could not approve the reschedule request. Please try again.", 500);
    }

    const notification = await notifyBookingStatusChange(booking.id, "rescheduled", db);
    const warning = notificationWarning(notification);
    return ok({
      message: "Reschedule request approved and booking rescheduled.",
      bookingId: booking.id,
      requestId: rescheduleRequestId,
      result: approval,
      ...(warning ? { warning } : {}),
    });
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

  const newStartDatetime = combineLocalDateTime(newStartDate, body.data.newStartTime);
  const newEndDatetime = combineLocalDateTime(newEndDate, body.data.newEndTime);
  if (newStartDatetime === "invalid") return error("newStartTime must use HH:mm", 400);
  if (newEndDatetime === "invalid") return error("newEndTime must use HH:mm", 400);
  if (newStartDatetime && newEndDatetime && newEndDatetime <= newStartDatetime) {
    return error("New end date/time must be after new start date/time", 400);
  }

  const { data: booking, error: fetchError } = await db
    .from("bookings")
    .select("id, status, venue_id, start_date, end_date, event_date, package_id, start_datetime, end_datetime")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) return error("Booking not found", 404);
  const bookingStatus = normalizeBookingStatus(booking.status);
  if (!isValidBookingStatusTransition(bookingStatus, "rescheduled")) {
    return error(bookingStatusTransitionErrorMessage(bookingStatus, "rescheduled"), 409);
  }

  const scheduleStartDatetime =
    newStartDatetime ?? applyDateToLocalDateTime(newStartDate, booking.start_datetime);
  const scheduleEndDatetime =
    newEndDatetime ?? applyDateToLocalDateTime(newEndDate, booking.end_datetime);
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

  const availability = await validateBookingRescheduleAvailability(db, {
    bookingId,
    primaryVenueId: booking.venue_id,
    startDate: newStartDate,
    endDate: newEndDate,
  });
  if (availability.error) return error("Could not verify venue availability. Please try again.", 500);
  if (!availability.ok) {
    return error("The selected schedule is not available for all assigned venues.", 409);
  }

  const updateData: Record<string, string | null> = {
    start_date: newStartDate,
    end_date: newEndDate,
    event_date: newEventDate ?? newStartDate,
  };
  if (scheduleStartDatetime) updateData.start_datetime = scheduleStartDatetime;
  if (scheduleEndDatetime) updateData.end_datetime = scheduleEndDatetime;
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
