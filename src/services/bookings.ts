import { supabase } from "../lib/supabase";
import { normalizeBookingStatus } from "../lib/bookingStatus";
import { hasRequiredSecuringPayment, normalizeBookingPaymentStatus } from "../lib/reservationValidity";

export async function getUserBookings(userId: string) {
  return supabase
    .from("bookings")
    .select(
      `id, start_date, end_date, start_datetime, end_datetime, event_type, pax, status,
       total_price, special_requests, created_at,
       booking_payments(payment_status, amount_paid, refund_status, refund_amount, refund_processed_at, refund_notes),
       venue:venues(id, name, image_url, price_per_night)`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

export async function getAllBookings() {
  return supabase
    .from("bookings")
    .select(
      `id, user_id, venue_id, start_date, end_date, start_datetime, end_datetime, event_type, pax,
       status, total_price, full_name, phone, created_at, updated_at,
       venue:venues(id, name)`
    )
    .order("created_at", { ascending: false });
}

export async function getBookingById(id: string) {
  return supabase
    .from("bookings")
    .select(`*, venue:venues(*)`)
    .eq("id", id)
    .single();
}

export const WOODBERRY_CANCELLATION_POLICY_SUMMARY =
  "Cancellation of reserved date shall be made three (3) weeks before the reserved date to refund 50% of the deposited amount. Failure to do so shall mean forfeiture of the deposit.";

export type BookingRefundStatus = "not_required" | "not_eligible" | "pending" | "processed" | "failed";

export type BookingCancellationRefundOutcome = {
  policySummary: string;
  refundStatus: BookingRefundStatus;
  refundEligible: boolean;
  refundAmount: number;
  amountPaid: number;
  paidOrSecured: boolean;
  reservedDate: string | null;
  daysBeforeReservedDate: number | null;
  message: string;
  notes: string;
};

type CancellationPolicyBooking = {
  status?: string | null;
  start_date?: string | null;
  total_price?: number | string | null;
  minimum_payment_amount?: number | string | null;
};

type CancellationPolicyPayment = {
  payment_status?: string | null;
  amount_paid?: number | string | null;
  minimum_payment_amount?: number | string | null;
} | null | undefined;

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDateOnly(value: string | null | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function manilaDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
}

function daysBeforeReservedDate(reservedDate: string | null | undefined, now: Date) {
  const reserved = parseDateOnly(reservedDate);
  if (!reserved) return null;
  const today = manilaDateParts(now);
  const reservedUtc = Date.UTC(reserved.year, reserved.month - 1, reserved.day);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  return Math.floor((reservedUtc - todayUtc) / (24 * 60 * 60 * 1000));
}

export function calculateCancellationRefundOutcome(
  booking: CancellationPolicyBooking,
  payment: CancellationPolicyPayment,
  now = new Date(),
): BookingCancellationRefundOutcome {
  const status = normalizeBookingStatus(booking.status);
  const paymentStatus = normalizeBookingPaymentStatus(payment?.payment_status);
  const amountPaid = roundCurrency(Math.max(Number(payment?.amount_paid ?? 0), 0));
  const paidOrSecured = status === "booked"
    || status === "rescheduled"
    || hasRequiredSecuringPayment(booking, payment);
  const reservedDate = booking.start_date ?? null;
  const daysBefore = daysBeforeReservedDate(reservedDate, now);

  if (!paidOrSecured || amountPaid <= 0 || paymentStatus === "refunded") {
    const alreadyRefunded = paymentStatus === "refunded";
    return {
      policySummary: WOODBERRY_CANCELLATION_POLICY_SUMMARY,
      refundStatus: "not_required",
      refundEligible: false,
      refundAmount: 0,
      amountPaid,
      paidOrSecured,
      reservedDate,
      daysBeforeReservedDate: daysBefore,
      message: alreadyRefunded
        ? "No refund is needed because this payment is already marked refunded."
        : "No refund is needed for this cancellation.",
      notes: alreadyRefunded
        ? "Payment record was already marked refunded before cancellation."
        : "No securing payment is recorded for this booking; cancellation releases the reserved venue dates without a refund.",
    };
  }

  if (daysBefore !== null && daysBefore >= 21) {
    const refundAmount = roundCurrency(amountPaid * 0.5);
    return {
      policySummary: WOODBERRY_CANCELLATION_POLICY_SUMMARY,
      refundStatus: "pending",
      refundEligible: true,
      refundAmount,
      amountPaid,
      paidOrSecured,
      reservedDate,
      daysBeforeReservedDate: daysBefore,
      message: `Refund eligible under Woodberry policy. Expected manual refund: PHP ${refundAmount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
      notes: "Eligible under Woodberry cancellation policy: cancellation was requested at least three weeks before the reserved date. Manual refund processing is required.",
    };
  }

  return {
    policySummary: WOODBERRY_CANCELLATION_POLICY_SUMMARY,
    refundStatus: "not_eligible",
    refundEligible: false,
    refundAmount: 0,
    amountPaid,
    paidOrSecured,
    reservedDate,
    daysBeforeReservedDate: daysBefore,
    message: "No refund is available under Woodberry policy; the deposit is forfeited.",
    notes: "Not eligible under Woodberry cancellation policy: cancellation was not requested at least three weeks before the reserved date, so the deposit is forfeited.",
  };
}

export function bookingPaymentRefundUpdate(outcome: BookingCancellationRefundOutcome) {
  return {
    refund_status: outcome.refundStatus,
    refund_amount: outcome.refundAmount,
    refund_processed_at: null,
    refund_notes: outcome.notes,
  };
}
