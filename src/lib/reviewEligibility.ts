import { getAllowedNextBookingStatuses, normalizeBookingStatus } from "./bookingStatus";

type ReviewEligibilityBooking = {
  status: string | null | undefined;
  end_date: string | null | undefined;
  end_datetime?: string | null | undefined;
};

function manilaLocalTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  millisecond = 0,
): number {
  return Date.UTC(year, month - 1, day, hour - 8, minute, second, millisecond);
}

function parseEventEndMs(booking: ReviewEligibilityBooking): number | null {
  if (booking.end_datetime) {
    const match = booking.end_datetime.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
    );
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      return manilaLocalTimeToUtcMs(
        Number(year),
        Number(month),
        Number(day),
        Number(hour),
        Number(minute),
        Number(second ?? 0),
      );
    }

    const parsed = Date.parse(booking.end_datetime);
    if (Number.isFinite(parsed)) return parsed;
  }

  if (!booking.end_date) return null;
  const dateMatch = booking.end_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;

  const [, year, month, day] = dateMatch;
  return manilaLocalTimeToUtcMs(Number(year), Number(month), Number(day) + 1);
}

export function hasBookingEventEnded(
  booking: ReviewEligibilityBooking,
  now: Date = new Date(),
): boolean {
  const eventEndMs = parseEventEndMs(booking);
  return eventEndMs !== null && eventEndMs <= now.getTime();
}

export function canReviewBooking(
  booking: ReviewEligibilityBooking,
  now: Date = new Date(),
): boolean {
  const status = normalizeBookingStatus(booking.status);
  if (status === "completed") return true;
  return hasBookingEventEnded(booking, now)
    && getAllowedNextBookingStatuses(status).includes("completed");
}
