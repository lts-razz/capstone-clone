import type { APIRoute } from "astro";
import { getUser } from "../../../lib/auth";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { error, ok } from "../../../lib/response";
import { normalizeBookingStatus } from "../../../lib/bookingStatus";
import {
  getReservationDeadlineState,
  hasRequiredSecuringPayment,
  normalizeBookingPaymentStatus,
} from "../../../lib/reservationValidity";
export const prerender = false;
const db = supabaseAdmin ?? supabase;
export const GET: APIRoute = async ({ url, cookies }) => {
  const user = await getUser(cookies); if (!user) return error("Unauthorized", 401);
  const bookingId = url.searchParams.get("bookingId"); if (!bookingId) return error("bookingId is required", 400);

  const { data: latestTransaction, error: transactionError } = await db.from("payment_transactions")
    .select("status,amount,payment_method,reference_number,paid_at,failure_reason")
    .eq("booking_id", bookingId).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (transactionError) return error("Could not verify payment transaction", 500);

  const { data: booking, error: bookingError } = await db.from("bookings")
    .select("id,status,total_price,minimum_payment_amount,reservation_expires_at,reservation_expired_at,cancellation_source")
    .eq("id", bookingId).eq("user_id", user.id).maybeSingle();
  if (bookingError) return error("Could not verify booking status", 500);

  const { data: bookingPayment, error: paymentError } = await db.from("booking_payments")
    .select("payment_status,amount_paid,minimum_payment_amount,total_booking_amount,remaining_balance,refund_status,refund_amount,refund_notes")
    .eq("booking_id", bookingId).maybeSingle();
  if (paymentError) return error("Could not verify payment summary", 500);

  if (!booking) {
    return ok({ payment: latestTransaction ?? null, latestTransaction: latestTransaction ?? null, bookingStatus: null, booking: null });
  }

  const payment = bookingPayment
    ? { ...bookingPayment, status: normalizeBookingPaymentStatus(bookingPayment.payment_status) }
    : {
      payment_status: "unpaid",
      status: "unpaid",
      amount_paid: 0,
      minimum_payment_amount: booking.minimum_payment_amount,
      total_booking_amount: booking.total_price,
      remaining_balance: booking.total_price,
      refund_status: "not_required",
      refund_amount: 0,
      refund_notes: null,
    };
  const normalizedBooking = { ...booking, status: normalizeBookingStatus(booking.status), payment };
  const reservation = getReservationDeadlineState(normalizedBooking);
  const secured = normalizedBooking.status === "booked"
    || normalizedBooking.status === "rescheduled"
    || hasRequiredSecuringPayment(normalizedBooking, payment);

  return ok({
    payment,
    latestTransaction: latestTransaction ?? null,
    bookingStatus: normalizedBooking.status,
    booking: {
      status: normalizedBooking.status,
      reservationState: reservation.kind,
      reservationExpiresAt: booking.reservation_expires_at,
      secured,
      requiresManualReview: payment.refund_status === "pending" && Number(payment.refund_amount ?? 0) > 0,
    },
  });
};
