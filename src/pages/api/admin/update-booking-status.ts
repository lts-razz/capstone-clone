// POST /api/admin/update-booking-status - update a booking status (staff or admin)
import type { APIRoute } from "astro";
import { z } from "zod";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { staffOrAdminGuard } from "../../../lib/adminGuard";
import {
  bookingStatusSchema,
  bookingActionReasonError,
  bookingActionReasonSchema,
  bookingStatusTransitionErrorMessage,
  isExpiredReservationCancellation,
  isValidBookingStatusTransition,
  normalizeBookingStatus,
  normalizeBookingActionReason,
} from "../../../lib/bookingStatus";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import { findAvailabilityOverlaps, getBookingVenueIds } from "../../../services/bookingAvailability";
import {
  BookingStatusTransitionError,
  updateBookingStatusAndNotify,
} from "../../../services/notifications";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const updateStatusSchema = z.object({
  bookingId: z.string().uuid("bookingId must be a valid UUID"),
  status: bookingStatusSchema.optional(),
  manualOverride: z.boolean().optional().default(false),
  confirmedSensitiveAction: z.boolean().optional().default(false),
  cancellationReason: bookingActionReasonSchema.optional(),
  overrideReason: bookingActionReasonSchema.optional(),
}).superRefine((value, ctx) => {
  if (!value.status) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "status is required",
      path: ["status"],
    });
  }
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await staffOrAdminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = updateStatusSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((item) => item.message).join(", "), 400);
  }

  const status = parsed.data.status ?? null;
  const cancellationReason = normalizeBookingActionReason(parsed.data.cancellationReason);
  const overrideReason = normalizeBookingActionReason(parsed.data.overrideReason);

  try {
    if (parsed.data.manualOverride && guard.role !== "admin") {
      return error("Forbidden: admin manual override requires an admin account", 403);
    }

    let statusUpdateFields: Record<string, unknown> | undefined;
    if (status) {
      if (
        (status === "cancelled" || status === "completed" || parsed.data.manualOverride) &&
        !parsed.data.confirmedSensitiveAction
      ) {
        return error("Explicit confirmation is required for this sensitive booking action.", 400);
      }
      const reasonError = status === "cancelled"
        ? bookingActionReasonError(cancellationReason, "Cancellation")
        : parsed.data.manualOverride
          ? bookingActionReasonError(overrideReason, "Override")
          : null;
      if (reasonError) return error(reasonError, 400);

      const { data: currentBooking, error: currentBookingError } = await db
        .from("bookings")
        .select("id, status, reservation_expired_at, cancellation_source, venue_id, start_date, end_date")
        .eq("id", parsed.data.bookingId)
        .single();
      if (currentBookingError || !currentBooking) return error("Booking not found", 404);
      const currentStatus = normalizeBookingStatus(currentBooking.status);
      if (currentStatus === "pending" && status === "booked") {
        return error("Record the required down payment in Payment to secure this reservation.", 409);
      }
      const expirationCancelled = isExpiredReservationCancellation(currentBooking);
      const reopeningCancelled = currentStatus === "cancelled" && status === "booked";
      if (parsed.data.manualOverride && !reopeningCancelled) {
        return error("Manual override is only allowed when reopening a cancelled booking as booked.", 400);
      }
      if (reopeningCancelled && !parsed.data.manualOverride) {
        return error(
          expirationCancelled
            ? "This expired reservation was cancelled by the system and requires an explicit admin manual override."
            : "Cancelled bookings require an explicit admin manual override before they can be reopened.",
          409,
        );
      }

      if (
        !isValidBookingStatusTransition(currentStatus, status, {
          manualOverride: parsed.data.manualOverride,
        })
      ) {
        return error(
          bookingStatusTransitionErrorMessage(currentStatus, status, {
            manualOverride: parsed.data.manualOverride,
          }),
          409,
        );
      }

      if (reopeningCancelled && parsed.data.manualOverride) {
        const bookingVenues = await getBookingVenueIds(db, parsed.data.bookingId, currentBooking.venue_id);
        if (bookingVenues.error) return error("Could not verify the booking venues for this override. Please try again.", 500);

        const availabilityOverlap = await findAvailabilityOverlaps(db, {
          venueIds: bookingVenues.venueIds,
          startDate: currentBooking.start_date,
          endDate: currentBooking.end_date,
          excludeBookingId: parsed.data.bookingId,
        });
        if (availabilityOverlap.error) {
          return error("Could not verify venue availability for this override. Please try again.", 500);
        }
        if (availabilityOverlap.bookings.length > 0 || availabilityOverlap.blockedDates.length > 0) {
          return error("This reservation cannot be reopened because its dates are no longer available.", 409);
        }
        statusUpdateFields = {
          reservation_expired_at: null,
          cancellation_reason: null,
          cancellation_source: "admin_manual_override",
          override_reason: overrideReason,
          cancelled_at: null,
        };
      }
      if (status === "cancelled") {
        statusUpdateFields = {
          ...(statusUpdateFields ?? {}),
          cancellation_reason: cancellationReason,
          cancellation_source: "admin_manual",
        };
      }
      if (parsed.data.manualOverride) {
        statusUpdateFields = {
          ...(statusUpdateFields ?? {}),
          override_reason: overrideReason,
        };
      }
    }

    const result = await updateBookingStatusAndNotify(parsed.data.bookingId, status!, {
          client: db,
          manualOverride: parsed.data.manualOverride,
          actorId: guard.user.id,
          actorType: guard.role,
          reason: cancellationReason || overrideReason || null,
          metadata: {
            manualOverride: parsed.data.manualOverride,
            updatedFields: Object.keys(statusUpdateFields ?? {}),
          },
          ...(statusUpdateFields ? { update: statusUpdateFields } : {}),
        });

    return ok({
      message:
        result.message ??
        "Booking status updated successfully",
      booking: result.booking,
      ...(result.unchanged ? { unchanged: result.unchanged } : {}),
      ...(result.warning ? { warning: result.warning } : {}),
    });
  } catch (updateError) {
    const message = updateError instanceof Error ? updateError.message : "Booking update failed";
    console.error("[UpdateBookingStatus]", message);
    if (updateError instanceof BookingStatusTransitionError) {
      return error(message, 409);
    }
    if (message.includes("booking_unavailable")) {
      return error("The selected schedule is no longer available. Please choose another date or time.", 409);
    }
    return error("We could not update this booking. Please try again.", 500);
  }
};
