import { z } from "zod";

export const BOOKING_STATUSES = [
  "pending",
  "booked",
  "rescheduled",
  "cancelled",
  "completed",
] as const;

export const NOTIFIABLE_BOOKING_STATUSES = [
  "booked",
  "rescheduled",
  "cancelled",
  "completed",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type NotifiableBookingStatus = (typeof NOTIFIABLE_BOOKING_STATUSES)[number];
export type LegacyBookingStatus = "confirmed";

const LEGACY_BOOKING_STATUS_MAP: Record<LegacyBookingStatus, BookingStatus> = {
  confirmed: "booked",
};

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);
export const BOOKING_ACTION_REASON_MAX_LENGTH = 500;
export const bookingActionReasonSchema = z.string().max(BOOKING_ACTION_REASON_MAX_LENGTH);

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending Payment",
  booked: "Booked",
  rescheduled: "Rescheduled",
  cancelled: "Cancelled",
  completed: "Completed",
};

export function isBookingStatus(status: string | null | undefined): status is BookingStatus {
  return BOOKING_STATUSES.includes(status as BookingStatus);
}

export function isLegacyBookingStatus(status: string | null | undefined): status is LegacyBookingStatus {
  return typeof status === "string" && status in LEGACY_BOOKING_STATUS_MAP;
}

export function isRecognizedBookingStatus(
  status: string | null | undefined,
): status is BookingStatus | LegacyBookingStatus {
  return isBookingStatus(status) || isLegacyBookingStatus(status);
}

export function normalizeBookingStatus(status: string | null | undefined): BookingStatus {
  if (isBookingStatus(status)) return status;
  if (isLegacyBookingStatus(status)) return LEGACY_BOOKING_STATUS_MAP[status];
  return "booked";
}

export function getBookingStatusDatabaseValues(status: BookingStatus): readonly BookingStatus[] {
  if (status === "booked") {
    // Generated DB types describe the migrated schema; include stale values until every environment is migrated.
    return ["booked", "confirmed"] as unknown as readonly BookingStatus[];
  }
  return [status];
}

export function isNotifiableBookingStatus(status: BookingStatus): status is NotifiableBookingStatus {
  return NOTIFIABLE_BOOKING_STATUSES.includes(status as NotifiableBookingStatus);
}

export const BOOKING_STATUS_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ["booked", "cancelled"],
  booked: ["rescheduled", "cancelled", "completed"],
  rescheduled: ["booked", "cancelled", "completed"],
  completed: [],
  cancelled: [],
};

export function getAllowedNextBookingStatuses(status: BookingStatus): readonly BookingStatus[] {
  return BOOKING_STATUS_TRANSITIONS[status];
}

export function normalizeBookingActionReason(reason: unknown): string {
  return typeof reason === "string" ? reason.trim() : "";
}

export function bookingActionReasonError(
  reason: unknown,
  label: "Cancellation" | "Override",
  required = true,
): string | null {
  const normalizedReason = normalizeBookingActionReason(reason);
  if (required && !normalizedReason) return `${label} reason is required.`;
  if (normalizedReason.length > BOOKING_ACTION_REASON_MAX_LENGTH) {
    return `${label} reason must be ${BOOKING_ACTION_REASON_MAX_LENGTH} characters or fewer.`;
  }
  return null;
}

export function isExpiredReservationCancellation(booking: {
  status: string | null | undefined;
  reservation_expired_at: string | null | undefined;
  cancellation_source: string | null | undefined;
}): boolean {
  return normalizeBookingStatus(booking.status) === "cancelled"
    && Boolean(booking.reservation_expired_at)
    && booking.cancellation_source === "system";
}

export function isValidBookingStatusTransition(
  from: BookingStatus,
  to: BookingStatus,
  options: { manualOverride?: boolean } = {},
): boolean {
  if (from === to) return true;
  if (from === "cancelled" && to === "booked" && options.manualOverride === true) {
    return true;
  }
  return BOOKING_STATUS_TRANSITIONS[from].includes(to);
}

export function bookingStatusTransitionErrorMessage(
  from: BookingStatus,
  to: BookingStatus,
  options: { manualOverride?: boolean } = {},
): string {
  if (isValidBookingStatusTransition(from, to, options)) return "";
  if (from === "completed") return "Completed bookings cannot be changed to another status.";
  if (from === "cancelled") {
    return "Cancelled bookings cannot be changed without an explicit admin manual override.";
  }
  return `Invalid booking status transition: ${BOOKING_STATUS_LABELS[from]} cannot be changed to ${BOOKING_STATUS_LABELS[to]}.`;
}
