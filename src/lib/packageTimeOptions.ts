export type PackageTimeOptions =
  | { mode: "fixed_range"; from_time: string; to_time: string }
  | { mode: "duration"; hours: number }
  | { mode: "range_duration"; from_time: string; to_time: string; hours: number };

const TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d{1,3})?)?$/;

export function timeValueToMinutes(value: string) {
  if (!TIME_VALUE_PATTERN.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function getTimeRangeDurationMinutes(fromTime: string, toTime: string) {
  const fromMinutes = timeValueToMinutes(fromTime);
  const toMinutes = timeValueToMinutes(toTime);
  if (fromMinutes === null || toMinutes === null || fromMinutes === toMinutes) return null;
  return toMinutes > fromMinutes
    ? toMinutes - fromMinutes
    : 24 * 60 - fromMinutes + toMinutes;
}

export function normalizePackageTimeOptions(value: unknown): PackageTimeOptions | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const option = value as Record<string, unknown>;
  const fromTime = typeof option.from_time === "string" ? option.from_time : "";
  const toTime = typeof option.to_time === "string" ? option.to_time : "";
  const hours = typeof option.hours === "number" ? option.hours : Number(option.hours);

  if (
    option.mode === "fixed_range"
    && getTimeRangeDurationMinutes(fromTime, toTime) !== null
  ) {
    return { mode: "fixed_range", from_time: fromTime, to_time: toTime };
  }
  if (option.mode === "duration" && Number.isFinite(hours) && hours > 0) {
    return { mode: "duration", hours };
  }
  if (
    option.mode === "range_duration"
    && getTimeRangeDurationMinutes(fromTime, toTime) !== null
    && Number.isFinite(hours)
    && hours > 0
  ) {
    return { mode: "range_duration", from_time: fromTime, to_time: toTime, hours };
  }
  return null;
}

function parseLocalDateTimeToMinutes(value: string) {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);
  if (!match) return null;
  const [, year, month, day, hours, minutes, seconds = "0"] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== Number(year)
    || parsed.getUTCMonth() !== Number(month) - 1
    || parsed.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return timestamp / 60000;
}

function formatHours(hours: number) {
  const value = Number.isInteger(hours) ? String(hours) : String(hours).replace(/\.0+$/, "");
  return `${value} ${hours === 1 ? "hour" : "hours"}`;
}

function fitsConfiguredTimeRange(
  startDateTime: string,
  endDateTime: string,
  fromTime: string,
  toTime: string,
) {
  const selectedStart = parseLocalDateTimeToMinutes(startDateTime);
  const selectedEnd = parseLocalDateTimeToMinutes(endDateTime);
  const startMatch = DATE_TIME_LOCAL_PATTERN.exec(startDateTime);
  const fromMinutes = timeValueToMinutes(fromTime);
  const rangeMinutes = getTimeRangeDurationMinutes(fromTime, toTime);
  if (
    selectedStart === null
    || selectedEnd === null
    || !startMatch
    || fromMinutes === null
    || rangeMinutes === null
  ) {
    return false;
  }

  const startOfSelectedDay = Date.UTC(
    Number(startMatch[1]),
    Number(startMatch[2]) - 1,
    Number(startMatch[3]),
  ) / 60000;
  return [startOfSelectedDay, startOfSelectedDay - 24 * 60].some((dayStart) => {
    const windowStart = dayStart + fromMinutes;
    const windowEnd = windowStart + rangeMinutes;
    return selectedStart >= windowStart && selectedEnd <= windowEnd;
  });
}

export function validatePackageBookingTimes(
  value: unknown,
  startDateTime: string,
  endDateTime: string,
) {
  const options = normalizePackageTimeOptions(value);
  if (!options) return null;

  const selectedStart = parseLocalDateTimeToMinutes(startDateTime);
  const selectedEnd = parseLocalDateTimeToMinutes(endDateTime);
  if (selectedStart === null || selectedEnd === null || selectedEnd <= selectedStart) {
    return "Please choose a valid end date and time after the booking start.";
  }

  if (options.mode === "fixed_range" || options.mode === "range_duration") {
    if (!fitsConfiguredTimeRange(startDateTime, endDateTime, options.from_time, options.to_time)) {
      return `The selected start and end must fit within the package time range (${options.from_time}-${options.to_time}).`;
    }
  }

  if (options.mode === "duration" || options.mode === "range_duration") {
    const selectedDurationMinutes = selectedEnd - selectedStart;
    const requiredDurationMinutes = Math.round(options.hours * 60);
    if (selectedDurationMinutes !== requiredDurationMinutes) {
      return `This package requires a booking duration of exactly ${formatHours(options.hours)}.`;
    }
  }

  return null;
}
