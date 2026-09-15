import type { APIRoute } from "astro";
import { z } from "zod";
import { staffOrAdminGuard } from "../../../lib/adminGuard";
import { parseBody } from "../../../lib/parseBody";
import { error, ok } from "../../../lib/response";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { logBookingAudit } from "../../../services/bookingAudit";
import { hasRequiredSecuringPayment } from "../../../lib/reservationValidity";
import {
  notificationSucceeded,
  notifyCustomQuotationReady,
  updateBookingStatusAndNotify,
} from "../../../services/notifications";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const paymentSchema = z.object({
  bookingId: z.string().uuid("bookingId must be a valid UUID"),
  totalBookingAmount: z.number().finite().nonnegative(),
  amountPaid: z.number().finite().nonnegative(),
  paymentStatus: z.enum(["unpaid", "partial", "paid", "refunded"]),
  paymentMethod: z.string().trim().max(100).nullable().optional(),
  paymentNotes: z.string().trim().max(2000).nullable().optional(),
  paymentRecordedAt: z.string().datetime({ offset: true }).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.paymentStatus === "unpaid" && value.amountPaid !== 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountPaid"], message: "Unpaid bookings must have an amount paid of zero" });
  }
  if (value.paymentStatus === "partial" && (value.amountPaid <= 0 || value.amountPaid >= value.totalBookingAmount)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountPaid"], message: "A partial payment must be greater than zero and less than the total" });
  }
  if (value.paymentStatus === "paid" && value.amountPaid < value.totalBookingAmount) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amountPaid"], message: "A paid booking must have its full total recorded" });
  }
  if (value.paymentStatus !== "unpaid" && !value.paymentRecordedAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["paymentRecordedAt"], message: "Payment recorded date is required" });
  }
});

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await staffOrAdminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;
  const parsed = paymentSchema.safeParse(body.data);
  if (!parsed.success) return error(parsed.error.errors.map((item) => item.message).join(", "), 400);

  const { data: booking, error: bookingError } = await db
    .from("bookings")
    .select("id, status, package_type, total_price, estimate_summary, quotation_status, quotation_finalized_at, reservation_expires_at")
    .eq("id", parsed.data.bookingId)
    .single();
  if (bookingError || !booking) return error("Booking not found", 404);

  const total = parsed.data.totalBookingAmount;
  const amountPaid = parsed.data.amountPaid;
  const minimumPayment = total * 0.5;
  const remainingBalance = parsed.data.paymentStatus === "refunded"
    ? total
    : Math.max(total - amountPaid, 0);
  const isCustomBooking = booking.package_type === "custom-booking";
  const previousEstimateSummary = booking.estimate_summary
    && typeof booking.estimate_summary === "object"
    && !Array.isArray(booking.estimate_summary)
      ? booking.estimate_summary
      : {};
  const wasCustomPricingFinalized = isCustomBooking
    && booking.quotation_status === "finalized"
    && Number(booking.total_price) > 0;

  if (isCustomBooking && total <= 0) {
    return error("Enter a final payable amount greater than zero before enabling payment for this custom booking.", 400);
  }

  if (isCustomBooking) {
    const now = new Date();
    const nowIso = now.toISOString();
    const startsPaymentWindow = !wasCustomPricingFinalized;
    const pricingUpdate = db
      .from("bookings")
      .update({
        total_price: total,
        minimum_payment_amount: minimumPayment,
        remaining_balance_amount: remainingBalance,
        quotation_status: "finalized",
        quotation_finalized_at: booking.quotation_finalized_at ?? nowIso,
        ...(startsPaymentWindow && booking.reservation_expires_at == null
          ? { reservation_expires_at: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString() }
          : {}),
        estimate_summary: {
          ...previousEstimateSummary,
          pricingStatus: "finalized",
        },
        updated_at: nowIso,
      })
      .eq("id", booking.id);
    const guardedPricingUpdate = startsPaymentWindow
      ? pricingUpdate.or("quotation_status.is.null,quotation_status.neq.finalized")
      : pricingUpdate;
    const { data: updatedBooking, error: pricingError } = await guardedPricingUpdate
      .select("id")
      .maybeSingle();

    if (pricingError) {
      console.error("[UpdateBookingPayment] Custom booking pricing update failed", pricingError.message);
      if (pricingError.message.includes("booking_unavailable")) {
        return error("The selected schedule is no longer available. Please choose another date or time.", 409);
      }
      return error("Could not finalize the custom booking price", 500);
    }
    if (!updatedBooking) return error("This booking changed while you were editing it. Reload and try again.", 409);
  }

  const payment = {
    booking_id: parsed.data.bookingId,
    total_booking_amount: total,
    minimum_payment_amount: minimumPayment,
    amount_paid: amountPaid,
    remaining_balance: remainingBalance,
    payment_status: parsed.data.paymentStatus,
    payment_method: parsed.data.paymentMethod || null,
    payment_notes: parsed.data.paymentNotes || null,
    payment_recorded_at: parsed.data.paymentRecordedAt ?? null,
    recorded_by: guard.user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error: dbError } = await db
    .from("booking_payments")
    .upsert(payment, { onConflict: "booking_id" })
    .select("*")
    .single();
  if (dbError) {
    console.error("[UpdateBookingPayment]", dbError.message);
    if (dbError.message.includes("booking_unavailable")) {
      return error("The selected schedule is no longer available. Please choose another date or time.", 409);
    }
    return error("Could not save payment information", 500);
  }

  await logBookingAudit(
    {
      bookingId: booking.id,
      actorId: guard.user.id,
      actorType: guard.role,
      action: "payment_status_updated",
      fromStatus: booking.status,
      toStatus: booking.status,
      reason: parsed.data.paymentNotes || null,
      metadata: {
        paymentStatus: parsed.data.paymentStatus,
        amountPaid,
        totalBookingAmount: total,
        customPricingFinalized: isCustomBooking,
        paymentMethod: parsed.data.paymentMethod ?? null,
        paymentRecordedAt: parsed.data.paymentRecordedAt ?? null,
      },
    },
    db,
  );

  const warnings: string[] = [];
  if (
    isCustomBooking
    && !wasCustomPricingFinalized
    && !hasRequiredSecuringPayment({ minimum_payment_amount: minimumPayment, total_price: total }, data)
  ) {
    try {
      const quotationNotification = await notifyCustomQuotationReady(booking.id, db);
      if (!notificationSucceeded(quotationNotification)) {
        warnings.push("The custom quotation was finalized, but its notification could not be delivered.");
      }
    } catch (notificationError) {
      console.error("[UpdateBookingPayment] Custom quotation notification failed", {
        bookingId: booking.id,
        error: notificationError instanceof Error ? notificationError.message : "Quotation notification failed",
      });
      warnings.push("The custom quotation was finalized, but its notification could not be sent.");
    }
  }

  if (booking.status === "pending" && hasRequiredSecuringPayment(
    { minimum_payment_amount: minimumPayment, total_price: total }, data,
  )) {
    const result = await updateBookingStatusAndNotify(booking.id, "booked", {
      client: db,
      actorId: guard.user.id,
      actorType: guard.role,
      reason: "Required down payment recorded by staff",
    });
    if (result.warning) warnings.push(result.warning);
  }

  return ok({ message: "Payment information saved", payment: data, ...(warnings.length ? { warning: warnings.join(" ") } : {}) });
};
