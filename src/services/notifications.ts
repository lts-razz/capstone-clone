import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../lib/database.types";
import {
  BOOKING_STATUS_LABELS,
  bookingStatusTransitionErrorMessage,
  type BookingStatus,
  type NotifiableBookingStatus,
  isValidBookingStatusTransition,
  isNotifiableBookingStatus,
  normalizeBookingStatus,
} from "../lib/bookingStatus";
import { supabaseAdmin, supabase } from "../lib/supabase";
import { logBookingAudit, type BookingAuditActorType } from "./bookingAudit";
import { hasRequiredSecuringPayment } from "../lib/reservationValidity";
import { sendTransactionalEmail, type EmailSendResult } from "./email";
import { sendSmsNotification, type SmsSendResult } from "./sms";

type DbClient = SupabaseClient<Database>;

type NotificationBooking = {
  id: string;
  userId: string;
  status: BookingStatus;
  fullName: string;
  phone: string | null;
  eventDate: string;
  startDate: string;
  endDate: string;
  packageName: string;
  isCustomBooking: boolean;
  venueName: string;
  email: string | null;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  totalPrice: number | null;
  minimumPaymentAmount: number | null;
  oneWeekEmailSentAt: string | null;
  oneWeekSmsSentAt: string | null;
  reservationExpiresAt: string | null;
  expirationReminderSentAt: string | null;
  expirationCancelNoticeSentAt: string | null;
};

export type NotificationResult = {
  email?: EmailSendResult;
  sms?: SmsSendResult;
};

export type OneWeekReminderResult = NotificationResult & {
  bookingLoaded: boolean;
  enabledChannels: {
    email: boolean;
    sms: boolean;
  };
  sentAt: {
    email: string | null;
    sms: string | null;
  };
};

export type BookingStatusUpdateResult = {
  booking: { id: string; status: BookingStatus };
  notification?: NotificationResult;
  message?: string;
  unchanged?: boolean;
  warning?: string;
};

const db = supabaseAdmin ?? supabase;
const WOODBERRY_PACKAGE_LABELS: Record<string, string> = {
  "lunch-time": "Lunch Time Package",
  "dinner-time": "Dinner Time Package",
  "barkada-staycation": "Barkada Staycation",
  "pamilya-staycation": "Pamilya Staycation",
  "room-rates": "Room Rates",
  "custom-booking": "Custom Booking",
};

export class BookingStatusTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingStatusTransitionError";
  }
}

type BookingNotificationKind =
  | NotifiableBookingStatus
  | "booking_submitted"
  | "quotation_ready"
  | "one_week_event_reminder"
  | "expiration_reminder"
  | "expiration_cancel_notice";

type NotificationContent = {
  subject: string;
  textContent: string;
  htmlContent: string;
  smsMessage: string;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "No event date provided";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No event date provided";
  return parsed.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "the stated reservation deadline";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "the stated reservation deadline";
  return parsed.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
    timeZoneName: "short",
  });
}

function formatBookingDates(booking: NotificationBooking): string {
  return `${formatDate(booking.startDate)} to ${formatDate(booking.endDate)}`;
}

function formatMoney(value: number | null | undefined): string {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) && amount > 0
    ? amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })
    : "To be confirmed";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailContent(
  booking: NotificationBooking,
  status: BookingNotificationKind,
): NotificationContent {
  const expirationDeadline = formatDateTime(booking.reservationExpiresAt);
  const bookingStatusLabel = booking.status === "pending" && booking.isCustomBooking && !booking.reservationExpiresAt
    ? "Waiting for Quotation"
    : booking.status === "pending" && booking.isCustomBooking
      ? "Quotation Ready / Payment Required"
      : booking.status === "pending"
        ? "Temporary Reservation / Payment Required"
    : BOOKING_STATUS_LABELS[booking.status];
  let subject: string;
  let statusLine: string;
  let statusMessage: string;

  switch (status) {
    case "booking_submitted":
      subject = booking.isCustomBooking
        ? "We received your Woodberry custom booking request"
        : "Your Woodberry reservation is temporarily held";
      statusLine = booking.isCustomBooking
        ? "Thank you - your custom booking request has been received. Woodberry will review your requirements and finalize your quotation."
        : `Thank you - your selected schedule is temporarily reserved until ${expirationDeadline}.`;
      statusMessage = booking.isCustomBooking && !booking.reservationExpiresAt
        ? "Next step: Woodberry is finalizing your quotation. No payment is due until the final payable amount is set."
        : `Next step: complete the required down payment of ${formatMoney(booking.minimumPaymentAmount)} by ${expirationDeadline} to secure your booking.`;
      break;
    case "quotation_ready":
      subject = "Your Woodberry custom quotation is ready";
      statusLine = `Your quotation for ${booking.packageName} is ready. The final amount is ${formatMoney(booking.totalPrice)}.`;
      statusMessage = `Next step: complete the required down payment of ${formatMoney(booking.minimumPaymentAmount)} by ${expirationDeadline} to secure your booking.`;
      break;
    case "one_week_event_reminder":
      subject = "One-week reminder for your Woodberry event";
      statusLine = `Your event at ${booking.venueName} is one week away, on ${formatDate(booking.eventDate)}.`;
      statusMessage =
        "Next step: review the venue, package, and dates below. Contact the Woodberry team promptly if you have final questions or need to discuss an update.";
      break;
    case "expiration_reminder":
      subject = "Action needed: your reservation payment deadline is approaching";
      statusLine = `Your 48-hour reservation hold ends on ${expirationDeadline}.`;
      statusMessage =
        "Next step: complete or arrange the required minimum payment before the deadline to keep your requested dates on hold. Contact the Woodberry team now if you need assistance.";
      break;
    case "expiration_cancel_notice":
      subject = "Your Woodberry reservation was cancelled after the payment deadline";
      statusLine = `Your 48-hour reservation hold ended on ${expirationDeadline}. The booking is now Cancelled.`;
      statusMessage =
        "Next step: if you would still like to book, contact the Woodberry team to check whether the dates are still available before submitting a new request.";
      break;
    case "booked":
      subject = "Your Woodberry event is booked";
      statusLine = "Your booking is secured, and your event dates are reserved.";
      statusMessage =
        "Next step: review the confirmed details below and contact the Woodberry team promptly if anything needs to be corrected.";
      break;
    case "rescheduled":
      subject = "Your Woodberry booking schedule was updated";
      statusLine = `Your booking status is Rescheduled, with booking dates of ${formatBookingDates(booking)}.`;
      statusMessage =
        "Next step: review the updated event and booking dates below, then contact the Woodberry team promptly if anything is incorrect.";
      break;
    case "cancelled":
      subject = "Your Woodberry booking was cancelled";
      statusLine = "Your booking status is Cancelled, and its dates are no longer being held.";
      statusMessage =
        "Next step: contact the Woodberry team if this was unexpected or if you would like help checking dates for a new booking.";
      break;
    case "completed":
      subject = "Thank you for celebrating with Woodberry";
      statusLine = "Your booking status is Completed.";
      statusMessage =
        "No further booking action is needed. Thank you for choosing Woodberry Resorts and Events Place; we hope to welcome you again.";
      break;
  }

  const includeExpirationDeadline =
    ((status === "booking_submitted" || status === "quotation_ready") && Boolean(booking.reservationExpiresAt)) ||
    status === "expiration_reminder" ||
    status === "expiration_cancel_notice";

  const lines = [
    `Hello ${booking.fullName},`,
    "",
    statusLine,
    "",
    "Booking Details:",
    `Booking Status: ${bookingStatusLabel}`,
    `Venue: ${booking.venueName}`,
    `Package: ${booking.packageName}`,
    `Final Amount: ${formatMoney(booking.totalPrice)}`,
    `Required Down Payment: ${formatMoney(booking.minimumPaymentAmount)}`,
    `Event Date: ${formatDate(booking.eventDate)}`,
    `Booking Dates: ${formatBookingDates(booking)}`,
    `Reference ID: ${booking.id}`,
    ...(includeExpirationDeadline
      ? [`Payment Deadline: ${expirationDeadline}`]
      : []),
    "",
    statusMessage,
    "",
    "For questions or concerns, please contact Woodberry Resorts and Events Place.",
    "",
    "Thank you,",
    "Woodberry Resorts and Events Place",
  ];

  const htmlLines = lines.map((line) => (line ? escapeHtml(line) : ""));

  return {
    subject,
    textContent: lines.join("\n"),
    htmlContent: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;">${htmlLines
      .map((line) => (line ? `<p>${line}</p>` : "<br>"))
      .join("")}</div>`,
    smsMessage: [
      `Hello ${booking.fullName},`,
      statusLine,
      `Status: ${bookingStatusLabel}. ${booking.venueName} - ${booking.packageName}.`,
      `Required down payment: ${formatMoney(booking.minimumPaymentAmount)}.`,
      `Event: ${formatDate(booking.eventDate)}. Booking dates: ${formatBookingDates(booking)}.`,
      ...(includeExpirationDeadline ? [`Payment deadline: ${expirationDeadline}.`] : []),
      statusMessage,
      `Reference: ${booking.id}.`,
      "- Woodberry Resorts and Events Place",
    ].join(" "),
  };
}

async function fetchNotificationBooking(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationBooking | null> {
  const { data: booking, error: bookingError } = await client
    .from("bookings")
    .select(
      "id, user_id, status, full_name, phone, event_date, start_date, end_date, package_id, package_type, venue_id, total_price, minimum_payment_amount, one_week_email_sent_at, one_week_sms_sent_at, reservation_expires_at, expiration_reminder_sent_at, expiration_cancel_notice_sent_at",
    )
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    console.error("[Notifications] Booking fetch failed", {
      bookingId,
      error: bookingError?.message ?? "Booking not found",
    });
    return null;
  }

  const [customerResult, venueResult, packageResult] = await Promise.all([
    client
      .from("customers")
      .select("email, first_name, last_name, phone, email_notifications_enabled, sms_notifications_enabled")
      .eq("id", booking.user_id)
      .maybeSingle(),
    client.from("venues").select("name").eq("id", booking.venue_id).maybeSingle(),
    booking.package_id
      ? client.from("packages").select("name").eq("id", booking.package_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (customerResult.error || !customerResult.data) {
    console.error("[Notifications] Customer preference fetch failed", {
      bookingId,
      error: customerResult.error?.message ?? "Customer profile not found",
    });
    return null;
  }

  const customer = customerResult.data;
  const venue = venueResult.data;
  const pkg = packageResult.data;

  const profileName = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ").trim();

  return {
    id: booking.id,
    userId: booking.user_id,
    status: normalizeBookingStatus(booking.status),
    fullName: (booking.full_name ?? profileName) || "Client",
    phone: booking.phone ?? customer?.phone ?? null,
    eventDate: booking.event_date ?? booking.start_date ?? "No event date provided",
    startDate: booking.start_date,
    endDate: booking.end_date,
    packageName:
      pkg?.name ??
      WOODBERRY_PACKAGE_LABELS[booking.package_type ?? ""] ??
      "Package details pending confirmation",
    isCustomBooking: booking.package_type === "custom-booking",
    venueName: venue?.name ?? "Unknown venue",
    email: customer?.email ?? null,
    emailNotificationsEnabled: customer?.email_notifications_enabled ?? true,
    smsNotificationsEnabled: customer?.sms_notifications_enabled ?? true,
    totalPrice: Number(booking.total_price ?? 0) || null,
    minimumPaymentAmount: Number(booking.minimum_payment_amount ?? 0) || null,
    oneWeekEmailSentAt: booking.one_week_email_sent_at,
    oneWeekSmsSentAt: booking.one_week_sms_sent_at,
    reservationExpiresAt: booking.reservation_expires_at,
    expirationReminderSentAt: booking.expiration_reminder_sent_at,
    expirationCancelNoticeSentAt: booking.expiration_cancel_notice_sent_at,
  };
}

export async function notifyBookingStatusChange(
  bookingId: string,
  status: BookingStatus,
  client: DbClient = db,
): Promise<NotificationResult> {
  if (!isNotifiableBookingStatus(status)) return {};

  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) return {};

  return sendBookingNotification(booking, status);
}

export async function notifyBookingSubmitted(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) return {};

  return sendBookingNotification(booking, "booking_submitted");
}

export async function notifyCustomQuotationReady(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) return {};

  return sendBookingNotification(booking, "quotation_ready");
}

async function sendBookingNotification(
  booking: NotificationBooking,
  status: BookingNotificationKind,
): Promise<NotificationResult> {
  const content = buildEmailContent(booking, status);
  const result: NotificationResult = {};
  const tasks: Array<{
    channel: "email" | "sms";
    promise: Promise<EmailSendResult | SmsSendResult>;
  }> = [];
  const isOneWeekEventReminder = status === "one_week_event_reminder";

  if (!booking.emailNotificationsEnabled) {
    result.email = { ok: true, skipped: true, reason: "Email notifications are disabled for this customer" };
  } else if (isOneWeekEventReminder && booking.oneWeekEmailSentAt) {
    result.email = { ok: true, skipped: true, reason: "One-week email reminder was already sent" };
  } else if (!booking.email) {
    result.email = { ok: false, error: "No customer email is saved for this booking" };
  } else {
    tasks.push({
      channel: "email",
      promise: sendTransactionalEmail({
        toEmail: booking.email,
        toName: booking.fullName,
        subject: content.subject,
        textContent: content.textContent,
        htmlContent: content.htmlContent,
      }),
    });
  }

  if (!booking.smsNotificationsEnabled) {
    result.sms = { ok: true, skipped: true, reason: "SMS notifications are disabled for this customer" };
  } else if (isOneWeekEventReminder && booking.oneWeekSmsSentAt) {
    result.sms = { ok: true, skipped: true, reason: "One-week SMS reminder was already sent" };
  } else {
    tasks.push({
      channel: "sms",
      promise: sendSmsNotification({
        to: booking.phone ?? "",
        message: content.smsMessage,
      }),
    });
  }

  console.info("[Notifications] Delivery attempt", {
    bookingId: booking.id,
    kind: status,
    channels: tasks.map((task) => task.channel),
  });

  const settled = await Promise.allSettled(tasks.map((task) => task.promise));
  settled.forEach((settledResult, index) => {
    const channel = tasks[index].channel;
    if (settledResult.status === "rejected") {
      console.error("[Notifications] Channel request threw an error", {
        bookingId: booking.id,
        kind: status,
        channel,
        error:
          settledResult.reason instanceof Error
            ? settledResult.reason.message
            : `${channel.toUpperCase()} notification failed`,
      });
    }
    const value =
      settledResult.status === "fulfilled"
        ? settledResult.value
        : {
            ok: false as const,
            error: `${channel === "email" ? "Email" : "SMS"} notification could not be sent`,
          };

    if (channel === "email") {
      result.email = value as EmailSendResult;
    } else {
      result.sms = value as SmsSendResult;
    }
  });

  for (const channel of ["email", "sms"] as const) {
    const channelResult = result[channel];
    if (!channelResult) continue;
    if (delivered(channelResult)) {
      console.info("[Notifications] Channel succeeded", {
        bookingId: booking.id,
        kind: status,
        channel,
      });
    } else if (channelResult.ok) {
      console.info("[Notifications] Channel skipped", {
        bookingId: booking.id,
        kind: status,
        channel,
        reason: "reason" in channelResult ? channelResult.reason : "Not delivered",
      });
    } else {
      console.error("[Notifications] Channel failed", {
        bookingId: booking.id,
        kind: status,
        channel,
        error: channelResult.error,
      });
    }
  }

  return result;
}

function delivered(result: EmailSendResult | SmsSendResult | undefined): boolean {
  return Boolean(result?.ok && (!("skipped" in result) || !result.skipped));
}

function notificationWarning(result: NotificationResult): string | undefined {
  const unavailableChannels = (["email", "sms"] as const).filter((channel) => {
    const channelResult = result[channel];
    if (!channelResult) return false;
    if (!channelResult.ok) return true;
    if (!("skipped" in channelResult) || !channelResult.skipped) return false;
    return !(
      channelResult.reason.includes("disabled for this customer") ||
      channelResult.reason.includes("already sent")
    );
  });

  if (unavailableChannels.length === 0) return undefined;
  if (unavailableChannels.length === 2) {
    return "The booking was updated, but email and SMS notifications could not be sent.";
  }
  return `The booking was updated, but the ${unavailableChannels[0]} notification could not be sent.`;
}

export async function sendOneWeekReminder(
  bookingId: string,
  client: DbClient = db,
): Promise<OneWeekReminderResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking) {
    return {
      bookingLoaded: false,
      enabledChannels: { email: false, sms: false },
      sentAt: { email: null, sms: null },
    };
  }

  const result = await sendBookingNotification(booking, "one_week_event_reminder");
  return {
    ...result,
    bookingLoaded: true,
    enabledChannels: {
      email: booking.emailNotificationsEnabled,
      sms: booking.smsNotificationsEnabled,
    },
    sentAt: {
      email: booking.oneWeekEmailSentAt,
      sms: booking.oneWeekSmsSentAt,
    },
  };
}

export function notificationSucceeded(result: NotificationResult): boolean {
  return delivered(result.email) || delivered(result.sms);
}

export async function sendExpirationReminder(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking || !booking.reservationExpiresAt || booking.expirationReminderSentAt) return {};
  return sendBookingNotification(booking, "expiration_reminder");
}

export async function sendExpirationCancellationNotice(
  bookingId: string,
  client: DbClient = db,
): Promise<NotificationResult> {
  const booking = await fetchNotificationBooking(bookingId, client);
  if (!booking || booking.expirationCancelNoticeSentAt) return {};
  return sendBookingNotification(booking, "expiration_cancel_notice");
}

export function notificationChannelSucceeded(
  result: EmailSendResult | SmsSendResult | undefined,
): boolean {
  return delivered(result);
}

function statusAuditAction(
  fromStatus: BookingStatus,
  toStatus: BookingStatus,
  manualOverride?: boolean,
): string {
  if (manualOverride) return "manual_override";
  if (toStatus === "cancelled") return "booking_cancelled";
  if (toStatus === "rescheduled") return "booking_rescheduled";
  if (toStatus === "booked" && fromStatus === "rescheduled") return "booking_rebooked";
  if (toStatus === "booked") return "booking_booked";
  if (toStatus === "completed") return "booking_completed";
  return "booking_status_changed";
}

export async function updateBookingStatusAndNotify(
  bookingId: string,
  newStatus: BookingStatus,
  options: {
    client?: DbClient;
    update?: Record<string, unknown>;
    notify?: boolean;
    manualOverride?: boolean;
    actorId?: string | null;
    actorType?: BookingAuditActorType;
    action?: string;
    reason?: string | null;
    metadata?: Json;
  } = {},
): Promise<BookingStatusUpdateResult> {
  const client = options.client ?? db;
  const now = new Date().toISOString();
  const normalizedStatus = normalizeBookingStatus(newStatus);

  const { data: currentBooking, error: fetchError } = await client
    .from("bookings")
    .select("id, status, minimum_payment_amount, total_price")
    .eq("id", bookingId)
    .single();

  if (fetchError || !currentBooking) {
    throw new Error(fetchError?.message ?? "Booking not found");
  }

  const currentStatus = normalizeBookingStatus(currentBooking.status);
  if (
    !isValidBookingStatusTransition(currentStatus, normalizedStatus, {
      manualOverride: options.manualOverride,
    })
  ) {
    throw new BookingStatusTransitionError(
      bookingStatusTransitionErrorMessage(currentStatus, normalizedStatus, {
        manualOverride: options.manualOverride,
      }),
    );
  }

  if (currentStatus === normalizedStatus && !options.update) {
    return {
      booking: { id: currentBooking.id, status: currentStatus },
      message: "Booking status unchanged.",
      unchanged: true,
    };
  }

  if (normalizedStatus === "booked" && currentStatus !== "booked") {
    const { data: payment, error: paymentError } = await client
      .from("booking_payments")
      .select("payment_status, amount_paid, minimum_payment_amount")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (paymentError) throw new Error(paymentError.message);
    if (!hasRequiredSecuringPayment(currentBooking, payment)) {
      throw new BookingStatusTransitionError("The required down payment has not been verified.");
    }
  }

  const statusDates: Record<string, string> = {};
  if (normalizedStatus === "booked") statusDates.confirmed_at = now;
  if (normalizedStatus === "cancelled") statusDates.cancelled_at = now;
  if (normalizedStatus === "rescheduled") statusDates.rescheduled_at = now;

  const { data: booking, error: updateError } = await client
    .from("bookings")
    .update({
      ...(options.update ?? {}),
      ...statusDates,
      status: normalizedStatus,
      status_updated_at: now,
      updated_at: now,
    })
    .eq("id", bookingId)
    .eq("status", currentBooking.status)
    .select("id, status")
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }
  if (!booking) {
    throw new BookingStatusTransitionError(
      "Booking status changed while this action was being processed. Refresh and try again.",
    );
  }

  await logBookingAudit(
    {
      bookingId,
      actorId: options.actorId ?? null,
      actorType: options.actorType ?? "system",
      action: options.action ?? statusAuditAction(currentStatus, normalizedStatus, options.manualOverride),
      fromStatus: currentStatus,
      toStatus: normalizedStatus,
      reason: options.reason ?? null,
      metadata: {
        ...(typeof options.metadata === "object" && options.metadata !== null && !Array.isArray(options.metadata)
          ? options.metadata
          : {}),
        manualOverride: options.manualOverride === true,
      },
    },
    client,
  );

  const result: BookingStatusUpdateResult = {
    booking: { id: booking.id, status: normalizeBookingStatus(booking.status) },
  };

  if (options.notify === false || !isNotifiableBookingStatus(normalizedStatus)) {
    return result;
  }

  try {
    result.notification = await notifyBookingStatusChange(bookingId, normalizedStatus, client);
    const warning = notificationWarning(result.notification);
    if (warning) {
      result.warning = warning;
      console.warn("[Notifications] Status notification incomplete", {
        bookingId,
        kind: normalizedStatus,
        warning,
      });
    }
  } catch (notificationError) {
    const message =
      notificationError instanceof Error ? notificationError.message : "Notification failed";
    result.warning = "The booking was updated, but its notification could not be sent.";
    console.error("[Notifications] Status notification failed", {
      bookingId,
      kind: normalizedStatus,
      error: message,
    });
  }

  return result;
}

