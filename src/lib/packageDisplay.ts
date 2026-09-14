import type { Json } from "./database.types";
import type { WoodberryPackage } from "./woodberryPackages";
import { normalizePackageBookingOptions } from "./bookingOptions";
import { normalizePackageTimeOptions } from "./packageTimeOptions";

export type PackageVenueSummary = {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  image_url: string | null;
  is_active?: boolean | null;
};

export type PackageDisplayRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  inclusions: string | null;
  max_pax: number | null;
  min_pax?: number | null;
  duration_label?: string | null;
  time_options?: Json | null;
  included_facilities?: Json | null;
  rules?: Json | null;
  venue_id?: string | null;
  thumbnail_url?: string | null;
  booking_options?: Json | null;
  venue?: PackageVenueSummary | null;
  venues?: PackageVenueSummary[];
};

export type PackageDisplayItem = WoodberryPackage & {
  id: string;
  description: string | null;
  venueId: string | null;
  venue: PackageVenueSummary | null;
  venues: PackageVenueSummary[];
  thumbnailUrl: string | null;
  timeOptions: Json | null | undefined;
};

const DEFAULT_EVENT_TYPES = [
  "wedding",
  "birthday",
  "reunion",
  "family-gathering",
  "staycation",
  "private-event",
  "corporate",
  "conference",
  "debut",
  "other",
];

export function toPackageDisplayItem(row: PackageDisplayRow): PackageDisplayItem {
  const inclusions = parseInclusions(row.inclusions, row.included_facilities);
  const venues = (row.venues ?? (row.venue ? [row.venue] : []))
    .filter((venue) => venue.is_active !== false);
  const venue = venues[0] ?? null;
  const venueCapacity = venues
    .map((item) => Number(item.capacity) || 0)
    .filter((capacity) => capacity > 0);
  const maxPax = Number(row.max_pax ?? (venueCapacity.length > 0 ? Math.min(...venueCapacity) : 999));
  const includedRooms = deriveIncludedRooms(inclusions);

  return {
    type: row.id,
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    price: Number(row.price) || 0,
    duration: formatDuration(row.time_options) || row.duration_label || "Schedule arranged with Woodberry",
    schedule: formatSchedule(row.time_options) || "Schedule arranged with Woodberry",
    minPax: Number(row.min_pax ?? 1),
    maxPax,
    inclusions,
    facilityKeys: deriveFacilityKeys(inclusions),
    eventTypes: parseEventTypes(row.rules),
    ...(includedRooms ? { includedRooms } : {}),
    venueId: row.venue_id ?? venue?.id ?? null,
    venue,
    venues,
    thumbnailUrl: row.thumbnail_url ?? null,
    bookingOptions: normalizePackageBookingOptions(row.booking_options),
    timeOptions: row.time_options,
  };
}

export function parseInclusions(inclusions: string | null | undefined, includedFacilities?: Json | null) {
  if (Array.isArray(includedFacilities)) {
    const values = includedFacilities
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    if (values.length > 0) return values;
  }

  return (inclusions ?? "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSchedule(timeOptions?: Json | null) {
  const normalized = normalizePackageTimeOptions(timeOptions);
  if (normalized?.mode === "fixed_range" || normalized?.mode === "range_duration") {
    return `${formatTime(normalized.from_time)}-${formatTime(normalized.to_time)}`;
  }
  if (normalized?.mode === "duration") {
    return `Flexible ${formatHours(normalized.hours)} schedule`;
  }

  if (!Array.isArray(timeOptions)) return "";
  return timeOptions
    .map((option) => {
      if (typeof option === "string") return option.trim();
      if (option && typeof option === "object") {
        const label = "label" in option && typeof option.label === "string" ? option.label : "";
        const from = "from" in option && typeof option.from === "string" ? option.from : "";
        const to = "to" in option && typeof option.to === "string" ? option.to : "";
        return label || [from, to].filter(Boolean).join("-");
      }
      return "";
    })
    .filter(Boolean)
    .join(", ");
}

function formatDuration(timeOptions?: Json | null) {
  const normalized = normalizePackageTimeOptions(timeOptions);
  if (normalized?.mode === "duration" || normalized?.mode === "range_duration") {
    return formatHours(normalized.hours);
  }
  return normalized?.mode === "fixed_range" ? "Flexible within time range" : "";
}

function formatHours(hours: number) {
  const value = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(/\.0$/, "");
  return `${value} ${hours === 1 ? "hour" : "hours"}`;
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function parseEventTypes(rules?: Json | null) {
  if (rules && typeof rules === "object" && !Array.isArray(rules) && Array.isArray(rules.event_types)) {
    const eventTypes = rules.event_types.filter((item): item is string => typeof item === "string");
    if (eventTypes.length > 0) return eventTypes;
  }
  return DEFAULT_EVENT_TYPES;
}

function deriveIncludedRooms(inclusions: string[]) {
  for (const inclusion of inclusions) {
    const match = inclusion.match(/(\d+)\s*rooms?/i);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function deriveFacilityKeys(inclusions: string[]) {
  const keys = new Set<string>();
  for (const inclusion of inclusions) {
    const value = inclusion.toLowerCase();
    if (value.includes("pavilion") || value.includes("pavillion")) keys.add("pavillion");
    if (value.includes("pool")) keys.add("pool");
    if (value.includes("room")) keys.add("rooms");
    if (value.includes("sound")) keys.add("sound-system");
    if (value.includes("videoke")) keys.add("videoke");
  }
  return [...keys];
}
