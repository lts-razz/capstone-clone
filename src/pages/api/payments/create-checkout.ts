import type { APIRoute } from "astro";
import { z } from "zod";
import { getUser, isEmailVerified } from "../../../lib/auth";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { parseBody } from "../../../lib/parseBody";
import { error, ok } from "../../../lib/response";
import { paymongoRequest, pesoToCentavos } from "../../../lib/paymongo";
import { hasRequiredSecuringPayment } from "../../../lib/reservationValidity";

export const prerender = false;
const db = supabaseAdmin ?? supabase;
const schema = z.object({ bookingId: z.string().uuid() });

export const POST: APIRoute = async ({ request, cookies, url }) => {
  // Vercel/Astro can expose the internal function origin as localhost. Prefer an
  // explicitly configured public URL, then Vercel's forwarded host headers.
  const configuredSiteUrl = (import.meta.env.PUBLIC_SITE_URL || import.meta.env.SITE_URL || "").trim();
  const forwardedHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || (forwardedHost?.includes("localhost") ? "http" : "https");
  const publicOrigin = configuredSiteUrl
    ? configuredSiteUrl.replace(/\/$/, "")
    : forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : url.origin;
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized", 401);
  if (!isEmailVerified(user)) return error("Please verify your email before paying.", 403);
  const body = await parseBody(request);
  if (!body.ok) return body.response;
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return error("Invalid bookingId", 400);

  const { data: booking } = await db.from("bookings")
    .select("id,user_id,total_price,minimum_payment_amount,status,full_name,package_type,quotation_status,reservation_expires_at")
    .eq("id", parsed.data.bookingId).eq("user_id", user.id).single();
  if (!booking) return error("Booking not found", 404);
  if (booking.status === "cancelled") return error("Cancelled bookings cannot be paid", 409);
  if (booking.status === "booked" || booking.status === "completed") return error("This booking is already secured", 409);
  if (booking.status === "pending" && booking.reservation_expires_at && Date.parse(booking.reservation_expires_at) <= Date.now()) {
    return error("This reservation's payment deadline has passed.", 409);
  }

  const quotedTotal = Number(booking.total_price);
  const quotedMinimum = Number(booking.minimum_payment_amount ?? quotedTotal * 0.5);
  if (
    booking.package_type === "custom-booking"
    && (
      booking.quotation_status !== "finalized"
      || !booking.reservation_expires_at
      || !Number.isFinite(quotedTotal)
      || quotedTotal <= 0
      || !Number.isFinite(quotedMinimum)
      || quotedMinimum <= 0
    )
  ) {
    return error(
      "Online payment is not available until Woodberry admin reviews this custom booking and sets the final payable amount.",
      409,
    );
  }
  if (!Number.isFinite(quotedMinimum) || quotedMinimum <= 0) return error("Invalid payment amount", 400);

  const { data: recordedPayment, error: recordedPaymentError } = await db.from("booking_payments")
    .select("payment_status,amount_paid,minimum_payment_amount,total_booking_amount")
    .eq("booking_id", booking.id).maybeSingle();
  if (recordedPaymentError) return error("Could not verify existing payments", 500);
  if (hasRequiredSecuringPayment(booking, recordedPayment)) return error("The required down payment has already been paid", 409);
  const total = Number(recordedPayment?.total_booking_amount || quotedTotal);
  const minimumPayment = Number(recordedPayment?.minimum_payment_amount || quotedMinimum);
  const amountPaid = recordedPayment?.payment_status === "partial" || recordedPayment?.payment_status === "paid"
    ? Number(recordedPayment.amount_paid) : 0;
  const amount = Math.max(minimumPayment - amountPaid, 0);
  if (!Number.isFinite(amount) || amount <= 0) return error("Invalid remaining payment amount", 400);

  const { data: existing } = await db.from("payment_transactions")
    .select("id,status,checkout_url,gateway_checkout_id")
    .eq("booking_id", booking.id).eq("payment_type", "down_payment")
    .in("status", ["pending", "processing"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing?.checkout_url && ["pending", "processing"].includes(existing.status)) {
    return ok({ checkoutUrl: existing.checkout_url, paymentId: existing.id, reused: true });
  }

  const reference = `BOOKING-${booking.id.slice(0, 8).toUpperCase()}`;
  const { data: transaction, error: txError } = await db.from("payment_transactions").insert({
    booking_id: booking.id, user_id: user.id, payment_type: "down_payment", amount,
    currency: "PHP", gateway: "paymongo", status: "pending", reference_number: reference,
  }).select("id").single();
  if (txError || !transaction) return error("Could not initialize payment", 500);

  try {
    const response = await paymongoRequest("/v2/checkout_sessions", {
      method: "POST",
      body: JSON.stringify({ data: { attributes: {
        line_items: [{ name: "50% Booking Down Payment", description: reference, amount: pesoToCentavos(amount), currency: "PHP", quantity: 1 }],
        payment_method_types: ["card", "gcash", "paymaya", "grab_pay", "qrph"],
        success_url: `${publicOrigin}/payment/success?bookingId=${booking.id}`,
        cancel_url: `${publicOrigin}/payment/cancelled?bookingId=${booking.id}`,
        description: `Down payment for ${booking.full_name ?? "booking"}`,
        reference_number: reference,
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        metadata: { booking_id: booking.id, transaction_id: transaction.id, user_id: user.id },
      } } }),
    });
    const checkout = response.data;
    await db.from("payment_transactions").update({
      gateway_checkout_id: checkout.id, checkout_url: checkout.attributes.checkout_url, updated_at: new Date().toISOString(),
    }).eq("id", transaction.id);
    if (!recordedPayment) {
      await db.from("booking_payments").upsert({
        booking_id: booking.id, total_booking_amount: total, minimum_payment_amount: minimumPayment,
        amount_paid: 0, remaining_balance: total, payment_status: "unpaid",
        payment_method: "PayMongo", updated_at: new Date().toISOString(),
      }, { onConflict: "booking_id" });
    }
    return ok({ checkoutUrl: checkout.attributes.checkout_url, paymentId: transaction.id });
  } catch (e) {
    await db.from("payment_transactions").update({ status: "failed", failure_reason: e instanceof Error ? e.message : "Checkout failed" }).eq("id", transaction.id);
    return error(e instanceof Error ? e.message : "Could not create checkout", 502);
  }
};
