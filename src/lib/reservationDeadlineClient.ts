export const CUSTOMER_TIME_ZONE = "Asia/Manila";

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function getReservationExpiryMs(expiresAt: string | null | undefined): number | null {
  if (!expiresAt) return null;
  const expiresMs = new Date(expiresAt).getTime();
  return Number.isFinite(expiresMs) ? expiresMs : null;
}

export function getReservationRemainingMs(
  expiresAt: string | null | undefined,
  nowMs = Date.now(),
): number | null {
  const expiresMs = getReservationExpiryMs(expiresAt);
  return expiresMs === null ? null : expiresMs - nowMs;
}

export function formatReservationDeadline(expiresAt: string | null | undefined): string {
  const expiresMs = getReservationExpiryMs(expiresAt);
  if (expiresMs === null) return "Deadline unavailable";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: CUSTOMER_TIME_ZONE,
  }).format(new Date(expiresMs));
}

export function formatReservationCountdown(remainingMs: number | null | undefined): string {
  if (remainingMs === null || remainingMs === undefined || !Number.isFinite(remainingMs)) {
    return "Deadline unavailable";
  }
  const safeMs = Math.max(0, remainingMs);
  const days = Math.floor(safeMs / MS_PER_DAY);
  const hours = Math.floor((safeMs % MS_PER_DAY) / MS_PER_HOUR);
  const minutes = Math.floor((safeMs % MS_PER_HOUR) / MS_PER_MINUTE);
  const seconds = Math.floor((safeMs % MS_PER_MINUTE) / MS_PER_SECOND);
  const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return days > 0
    ? `${days} ${days === 1 ? "day" : "days"} ${time} remaining`
    : `${time} remaining`;
}

export function isReservationCountdownActive(expiresAt: string | null | undefined, nowMs = Date.now()): boolean {
  const remainingMs = getReservationRemainingMs(expiresAt, nowMs);
  return remainingMs !== null && remainingMs > 0;
}
