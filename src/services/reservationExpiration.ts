import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { supabaseAdmin, supabase } from "../lib/supabase";
import {
  notificationSucceeded,
  sendExpirationCancellationNotice,
  sendExpirationReminder,
} from "./notifications";
import { logBookingAudit } from "./bookingAudit";
import { hasRequiredSecuringPayment } from "../lib/reservationValidity";
import { normalizeBookingStatus } from "../lib/bookingStatus";

type DbClient = SupabaseClient<Database>;

export type ExpireUnpaidReservationsResult = {
  count: number;
  bookingIds: string[];
  remindersSent: string[];
  cancellationNoticesSent: string[];
  notificationFailures: Array<{ bookingId: string; kind: "reminder" | "cancellation"; error: string }>;
};

const db = supabaseAdmin ?? supabase;
const EXPIRATION_REASON = "Reservation expired after 48 hours without the required down payment";
const REMINDER_LEAD_TIME_MS = 24 * 60 * 60 * 1000;

function notificationError(result: Awaited<ReturnType<typeof sendExpirationReminder>>): string {
  const failures = [result.email, result.sms]
    .filter((channel) => channel && !channel.ok)
    .map((channel) => (channel && !channel.ok ? channel.error : ""))
    .filter(Boolean)
    .join("; ");
  return failures || "No enabled notification channel was delivered";
}

type ExpirationCandidate = { id: string; minimum_payment_amount: number | null; total_price: number | null };

async function findUnpaidBookingIds(client: DbClient, bookings: ExpirationCandidate[]): Promise<Set<string>> {
  const bookingIds = bookings.map((booking) => booking.id);
  if (bookingIds.length === 0) return new Set();
  const { data, error } = await client
    .from("booking_payments")
    .select("booking_id, payment_status, amount_paid, minimum_payment_amount")
    .in("booking_id", bookingIds);

  if (error) throw new Error(`Could not verify reservation payments: ${error.message}`);
  const paymentByBookingId = new Map(
    (data ?? []).map((payment) => [payment.booking_id, payment]),
  );

  return new Set(
    bookings.filter((booking) => !hasRequiredSecuringPayment(booking, paymentByBookingId.get(booking.id))).map((booking) => booking.id),
  );
}

async function sendDueExpirationReminders(
  client: DbClient,
  now: Date,
  failures: ExpireUnpaidReservationsResult["notificationFailures"],
): Promise<string[]> {
  const nowIso = now.toISOString();
  const reminderCutoff = new Date(now.getTime() + REMINDER_LEAD_TIME_MS).toISOString();
  const { data: candidates, error } = await client
    .from("bookings")
    .select("id, minimum_payment_amount, total_price")
    .eq("status", "pending")
    .not("reservation_expires_at", "is", null)
    .gt("reservation_expires_at", nowIso)
    .lte("reservation_expires_at", reminderCutoff)
    .is("reservation_expired_at", null)
    .is("expiration_reminder_sent_at", null);

  if (error) throw new Error(`Could not find reservation reminders: ${error.message}`);
  const candidateIds = (candidates ?? []).map((booking) => booking.id);
  const unpaidIds = await findUnpaidBookingIds(client, candidates ?? []);
  const sent: string[] = [];

  for (const bookingId of candidateIds) {
    if (!unpaidIds.has(bookingId)) continue;
    try {
      const result = await sendExpirationReminder(bookingId, client);
      if (!notificationSucceeded(result)) {
        const message = notificationError(result);
        console.warn("[ReservationExpiration] Reminder was not delivered", {
          bookingId,
          error: message,
        });
        failures.push({ bookingId, kind: "reminder", error: message });
        continue;
      }
      const { error: updateError } = await client
        .from("bookings")
        .update({ expiration_reminder_sent_at: new Date().toISOString() })
        .eq("id", bookingId)
        .is("expiration_reminder_sent_at", null);
      if (updateError) throw updateError;
      sent.push(bookingId);
      console.info("[ReservationExpiration] Reminder sent and tracked", { bookingId });
    } catch (error) {
      console.error("[ReservationExpiration] Reminder processing failed", {
        bookingId,
        error: error instanceof Error ? error.message : "Expiration reminder failed",
      });
      failures.push({
        bookingId,
        kind: "reminder",
        error: "Expiration reminder processing failed",
      });
    }
  }
  return sent;
}

async function sendUnsentCancellationNotices(
  client: DbClient,
  failures: ExpireUnpaidReservationsResult["notificationFailures"],
): Promise<string[]> {
  const { data: candidates, error } = await client
    .from("bookings")
    .select("id")
    .eq("status", "cancelled")
    .eq("cancellation_source", "system")
    .not("reservation_expired_at", "is", null)
    .is("expiration_cancel_notice_sent_at", null);

  if (error) throw new Error(`Could not find unsent expiration notices: ${error.message}`);
  const sent: string[] = [];

  for (const booking of candidates ?? []) {
    try {
      const result = await sendExpirationCancellationNotice(booking.id, client);
      if (!notificationSucceeded(result)) {
        const message = notificationError(result);
        console.warn("[ReservationExpiration] Cancellation notice was not delivered", {
          bookingId: booking.id,
          error: message,
        });
        failures.push({ bookingId: booking.id, kind: "cancellation", error: message });
        continue;
      }
      const { error: updateError } = await client
        .from("bookings")
        .update({ expiration_cancel_notice_sent_at: new Date().toISOString() })
        .eq("id", booking.id)
        .is("expiration_cancel_notice_sent_at", null);
      if (updateError) throw updateError;
      sent.push(booking.id);
      console.info("[ReservationExpiration] Cancellation notice sent and tracked", {
        bookingId: booking.id,
      });
    } catch (error) {
      console.error("[ReservationExpiration] Cancellation notice processing failed", {
        bookingId: booking.id,
        error: error instanceof Error ? error.message : "Expiration cancellation notice failed",
      });
      failures.push({
        bookingId: booking.id,
        kind: "cancellation",
        error: "Expiration cancellation notice processing failed",
      });
    }
  }
  return sent;
}

export async function expireUnpaidReservations(
  client: DbClient = db,
  now = new Date(),
): Promise<ExpireUnpaidReservationsResult> {
  const notificationFailures: ExpireUnpaidReservationsResult["notificationFailures"] = [];
  const remindersSent = await sendDueExpirationReminders(client, now, notificationFailures);
  const expiredAt = now.toISOString();
  const { data: candidates, error: candidateError } = await client
    .from("bookings")
    .select("id, status, reservation_expires_at, minimum_payment_amount, total_price")
    .eq("status", "pending")
    .not("reservation_expires_at", "is", null)
    .lte("reservation_expires_at", expiredAt)
    .is("reservation_expired_at", null);

  if (candidateError) {
    throw new Error(`Could not find expired reservations: ${candidateError.message}`);
  }

  const unpaidBookingIds = await findUnpaidBookingIds(client, candidates ?? []);
  const expiredBookingIds: string[] = [];

  for (const candidate of candidates ?? []) {
    const bookingId = candidate.id;
    if (!unpaidBookingIds.has(bookingId)) continue;

    const { data: cancelledBooking, error: updateError } = await client
      .from("bookings")
      .update({
        status: "cancelled",
        cancelled_at: expiredAt,
        reservation_expired_at: expiredAt,
        cancellation_reason: EXPIRATION_REASON,
        cancellation_source: "system",
        status_updated_at: expiredAt,
        updated_at: expiredAt,
      })
      .eq("id", bookingId)
      .eq("status", candidate.status)
      .not("reservation_expires_at", "is", null)
      .lte("reservation_expires_at", expiredAt)
      .is("reservation_expired_at", null)
      .select("id")
      .maybeSingle();

    if (updateError) {
      throw new Error(`Could not expire reservation ${bookingId}: ${updateError.message}`);
    }

    if (cancelledBooking) {
      expiredBookingIds.push(cancelledBooking.id);
      await logBookingAudit(
        {
          bookingId: cancelledBooking.id,
          actorType: "system",
          action: "reservation_expired_cancelled",
          fromStatus: normalizeBookingStatus(candidate.status),
          toStatus: "cancelled",
          reason: EXPIRATION_REASON,
          metadata: {
            reservationExpiresAt: candidate.reservation_expires_at,
            expiredAt,
          },
        },
        client,
      );
    }
  }

  const cancellationNoticesSent = await sendUnsentCancellationNotices(
    client,
    notificationFailures,
  );

  return {
    count: expiredBookingIds.length,
    bookingIds: expiredBookingIds,
    remindersSent,
    cancellationNoticesSent,
    notificationFailures,
  };
}
