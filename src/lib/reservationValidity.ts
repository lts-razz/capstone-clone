export const RESERVATION_EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;

export type ReservationPayment = {
  payment_status?: string | null;
  amount_paid?: number | string | null;
  minimum_payment_amount?: number | string | null;
} | null | undefined;

export type ReservationDeadlineBooking = {
  status?: string | null;
  minimum_payment_amount?: number | string | null;
  total_price?: number | string | null;
  reservation_expires_at?: string | null;
  reservation_expired_at?: string | null;
  cancellation_source?: string | null;
  payment?: ReservationPayment;
};

export type ReservationDeadlineStateKind =
  | "active_unpaid"
  | "expiring_soon"
  | "deadline_passed"
  | "expired_cancelled"
  | "paid_secured"
  | "cancelled"
  | "not_applicable";

export type ReservationDeadlineState = {
  kind: ReservationDeadlineStateKind;
  label: string;
  className: string;
  warning: boolean;
  remainingMs: number | null;
};

function normalizedPaymentStatus(payment: ReservationPayment): string {
  return normalizeBookingPaymentStatus(payment?.payment_status);
}

/** Maps legacy or unknown booking-payment values (including `pending`) to unpaid. */
export function normalizeBookingPaymentStatus(value: unknown): BookingPaymentStatus {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  return status === "partial" || status === "paid" || status === "refunded"
    ? status
    : "unpaid";
}

function paymentAmount(payment: ReservationPayment): number {
  return Number(payment?.amount_paid ?? 0);
}

/** Only approved/verified funds meeting the booking's required 50% secure it. */
export function hasRequiredSecuringPayment(
  booking: Pick<ReservationDeadlineBooking, "minimum_payment_amount" | "total_price">,
  payment: ReservationPayment,
): boolean {
  const status = normalizedPaymentStatus(payment);
  const paid = paymentAmount(payment);
  const minimum = Number(payment?.minimum_payment_amount ?? booking.minimum_payment_amount ?? Number(booking.total_price ?? 0) * 0.5);
  return (status === "partial" || status === "paid")
    && Number.isFinite(minimum) && minimum > 0
    && Number.isFinite(paid) && paid >= minimum;
}

export function getReservationDeadlineState(
  booking: ReservationDeadlineBooking,
  nowMs = Date.now(),
): ReservationDeadlineState {
  const status = booking.status ?? "";
  const expiresAtMs = booking.reservation_expires_at
    ? new Date(booking.reservation_expires_at).getTime()
    : null;
  const remainingMs = expiresAtMs !== null && Number.isFinite(expiresAtMs)
    ? expiresAtMs - nowMs
    : null;
  const expirationCancelled = status === "cancelled"
    && Boolean(booking.reservation_expired_at)
    && booking.cancellation_source === "system";

  if (expirationCancelled) {
    return {
      kind: "expired_cancelled",
      label: "Expired/cancelled",
      className: "reservation-expired",
      warning: false,
      remainingMs,
    };
  }

  if (status === "cancelled") {
    return {
      kind: "cancelled",
      label: "Cancelled",
      className: "reservation-expired",
      warning: false,
      remainingMs,
    };
  }

  if (status === "booked" || status === "rescheduled") {
    return {
      kind: "paid_secured",
      label: "Booked/secured",
      className: "reservation-secured",
      warning: false,
      remainingMs,
    };
  }

  if (hasRequiredSecuringPayment(booking, booking.payment)) {
    return {
      kind: "paid_secured",
      label: "Paid/secured",
      className: "reservation-secured",
      warning: false,
      remainingMs,
    };
  }

  if (status === "completed" || !booking.reservation_expires_at) {
    return {
      kind: "not_applicable",
      label: "Not applicable",
      className: "reservation-active",
      warning: false,
      remainingMs,
    };
  }

  if (remainingMs !== null && remainingMs <= 0) {
    return {
      kind: "deadline_passed",
      label: "Deadline passed",
      className: "reservation-expired",
      warning: false,
      remainingMs,
    };
  }

  if (remainingMs !== null && remainingMs <= RESERVATION_EXPIRING_SOON_MS) {
    return {
      kind: "expiring_soon",
      label: "Expiring soon",
      className: "reservation-warning",
      warning: true,
      remainingMs,
    };
  }

  return {
    kind: "active_unpaid",
    label: "Active unpaid reservation",
    className: "reservation-active",
    warning: false,
    remainingMs,
  };
}
import type { BookingPaymentStatus } from "./database.types";
