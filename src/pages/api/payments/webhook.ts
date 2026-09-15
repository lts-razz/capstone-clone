import type { APIRoute } from "astro";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { paymongoRequest } from "../../../lib/paymongo";
import { logBookingAudit } from "../../../services/bookingAudit";
import { hasRequiredSecuringPayment } from "../../../lib/reservationValidity";
import { updateBookingStatusAndNotify } from "../../../services/notifications";
import { normalizeBookingStatus } from "../../../lib/bookingStatus";
export const prerender = false;
const db = supabaseAdmin ?? supabase;

export const POST: APIRoute = async ({ request }) => {
  const event = await request.json().catch(() => null);
  const eventId = event?.data?.id;
  if (!eventId) return new Response("Invalid event", { status: 400 });
  try {
    const verified = await paymongoRequest(`/v1/events/${eventId}`);
    const type = verified?.data?.attributes?.type ?? event?.data?.attributes?.type;
    const resource = verified?.data?.attributes?.data ?? event?.data?.attributes?.data;
    const attrs = resource?.attributes ?? {};
    const metadata = attrs.metadata ?? resource?.attributes?.payment_intent?.attributes?.metadata ?? {};
    const transactionId = metadata.transaction_id;
    if (!transactionId) return new Response("ok", { status: 200 });

    const paid = type === "checkout_session.payment.paid" || type === "payment.paid";
    const failed = type === "payment.failed";
    const status = paid ? "paid" : failed ? "failed" : "pending";
    const payment = attrs.payments?.[0]?.attributes ?? attrs;
    const method = payment?.source?.type ?? payment?.payment_method_type ?? null;
    const gatewayPaymentId = attrs.payments?.[0]?.id ?? resource?.id ?? null;
    const { data: priorTx, error: priorTxError } = await db.from("payment_transactions")
      .select("id,booking_id,amount,status").eq("id", transactionId).maybeSingle();
    if (priorTxError) throw priorTxError;
    if (!priorTx) return new Response("ok", { status: 200 });
    const alreadyRecorded = priorTx.status === "paid";
    if (alreadyRecorded && !paid) return new Response("ok", { status: 200 });
    const { error: txError } = await db.from("payment_transactions").update({
      status, payment_method: method, gateway_payment_id: gatewayPaymentId,
      paid_at: paid ? new Date().toISOString() : null,
      failure_reason: failed ? payment?.last_payment_error?.failed_message ?? "Payment failed" : null,
      updated_at: new Date().toISOString(),
    }).eq("id", transactionId);
    if (txError) throw txError;

    if (paid) {
      const { data: booking, error: bookingError } = await db.from("bookings")
        .select("id,total_price,minimum_payment_amount,status,reservation_expires_at,reservation_expired_at,cancellation_source").eq("id", priorTx.booking_id).single();
      if (bookingError) throw bookingError;
      if (booking) {
        const bookingStatus = normalizeBookingStatus(booking.status);
        const reservationDeadlineMs = booking.reservation_expires_at
          ? Date.parse(booking.reservation_expires_at)
          : null;
        const paymentArrivedAfterDeadline = reservationDeadlineMs !== null
          && Number.isFinite(reservationDeadlineMs)
          && reservationDeadlineMs <= Date.now();
        const lateVerifiedPayment = bookingStatus === "cancelled"
          || (bookingStatus === "pending" && paymentArrivedAfterDeadline);
        const total = Number(booking.total_price);
        const minimum = Number(booking.minimum_payment_amount ?? total * 0.5);
        const { data: previousPayment, error: paymentFetchError } = await db.from("booking_payments")
          .select("amount_paid,payment_status,minimum_payment_amount,total_booking_amount,payment_method,refund_amount,refund_notes").eq("booking_id", booking.id).maybeSingle();
        if (paymentFetchError) throw paymentFetchError;
        const paymentTotal = Number(previousPayment?.total_booking_amount || total);
        const paymentMinimum = Number(previousPayment?.minimum_payment_amount || minimum);
        const priorAmount = Number(previousPayment?.amount_paid ?? 0);
        const amount = alreadyRecorded ? priorAmount : priorAmount + Number(priorTx.amount);
        const paymentStatus = amount >= paymentTotal ? "paid" as const : "partial" as const;
        if (!alreadyRecorded) {
          const refundNotes = [
            previousPayment?.refund_notes,
            lateVerifiedPayment
              ? `Verified PayMongo payment arrived after the booking was ${bookingStatus === "cancelled" ? "cancelled" : "expired"}. Do not restore automatically; manual refund/review is required.`
              : null,
          ].filter(Boolean).join("\n");
          const paymentUpdate = {
            total_booking_amount: paymentTotal, minimum_payment_amount: paymentMinimum,
            amount_paid: amount, remaining_balance: Math.max(paymentTotal - amount, 0), payment_status: paymentStatus,
            payment_method: priorAmount > 0 && previousPayment?.payment_method && previousPayment.payment_method !== "PayMongo"
              ? `${previousPayment.payment_method} + PayMongo` : method ?? "PayMongo",
            payment_recorded_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            ...(lateVerifiedPayment
              ? {
                refund_status: "pending" as const,
                refund_amount: Math.max(Number(previousPayment?.refund_amount ?? 0), Number(priorTx.amount)),
                refund_processed_at: null,
                refund_notes: refundNotes,
              }
              : {}),
          };
          const { error: paymentError } = previousPayment
            ? await db.from("booking_payments").update(paymentUpdate).eq("booking_id", booking.id)
            : await db.from("booking_payments").insert({ booking_id: booking.id, ...paymentUpdate });
          if (paymentError) throw paymentError;
        }
        const paymentState = { payment_status: paymentStatus, amount_paid: amount, minimum_payment_amount: paymentMinimum };
        if (!lateVerifiedPayment && hasRequiredSecuringPayment(booking, paymentState) && (bookingStatus === "pending" || bookingStatus === "rescheduled")) {
          await updateBookingStatusAndNotify(booking.id, "booked", { client: db, reason: "Verified PayMongo webhook" });
        }
        if (!alreadyRecorded) await logBookingAudit(
          {
            bookingId: booking.id,
            actorType: "system",
            action: "payment_succeeded",
            fromStatus: booking.status,
            toStatus: booking.status,
            reason: "Verified PayMongo webhook",
            metadata: {
              transactionId,
              gatewayPaymentId,
              amountPaid: amount,
              totalBookingAmount: paymentTotal,
              paymentMethod: method ?? "PayMongo",
              paymentStatus: paymentState.payment_status,
              manualReviewRequired: lateVerifiedPayment,
              reservationExpiredBeforePayment: paymentArrivedAfterDeadline,
            },
          },
          db,
        );
      }
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("[PayMongoWebhook]", e);
    return new Response("Webhook verification failed", { status: 400 });
  }
};
