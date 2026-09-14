import type { PackageBookingOptions } from "./bookingOptions";

export type WoodberryPackageType =
  | "lunch-time"
  | "dinner-time"
  | "barkada-staycation"
  | "pamilya-staycation"
  | "room-rates";

export type WoodberryPackage = {
  type: string;
  name: string;
  description?: string | null;
  price: number;
  browsePrice?: number;
  duration: string;
  schedule: string;
  minPax: number;
  maxPax: number;
  inclusions: string[];
  facilityKeys: string[];
  eventTypes: string[];
  includedRooms?: number;
  pricingNote?: string;
  bookingOptions?: PackageBookingOptions;
  timeOptions?: unknown;
};

export type PackageStatusRow = {
  id?: string | null;
  name: string | null;
  is_active: boolean | null;
};

export const WOODBERRY_PACKAGES: WoodberryPackage[] = [
  {
    type: "lunch-time",
    name: "Lunch Time Package",
    price: 12000,
    duration: "4 hours",
    schedule: "11:00 AM-3:00 PM or noon-4:00 PM",
    minPax: 80,
    maxPax: 200,
    inclusions: ["Pavilion", "Pool", "Sound system with DJ operator"],
    facilityKeys: ["pavillion", "pool", "sound-system"],
    eventTypes: [
      "wedding",
      "birthday",
      "reunion",
      "family-gathering",
      "corporate",
      "conference",
      "debut",
      "private-event",
      "other",
    ],
  },
  {
    type: "dinner-time",
    name: "Dinner Time Package",
    price: 13000,
    duration: "4 hours",
    schedule: "Starts at 5:00 PM",
    minPax: 80,
    maxPax: 200,
    inclusions: ["Pavilion", "Pool", "Sound system with DJ operator"],
    facilityKeys: ["pavillion", "pool", "sound-system"],
    eventTypes: [
      "wedding",
      "birthday",
      "reunion",
      "family-gathering",
      "corporate",
      "conference",
      "debut",
      "private-event",
      "other",
    ],
  },
  {
    type: "barkada-staycation",
    name: "Barkada Staycation",
    price: 14500,
    duration: "24-hour accommodation",
    schedule: "Overnight accommodation",
    minPax: 10,
    maxPax: 15,
    inclusions: ["Pavilion", "Pool", "Videoke", "Tables/chairs", "2 rooms"],
    facilityKeys: ["pavillion", "pool", "videoke", "rooms"],
    eventTypes: [
      "birthday",
      "reunion",
      "family-gathering",
      "staycation",
      "private-event",
      "other",
    ],
    includedRooms: 2,
  },
  {
    type: "pamilya-staycation",
    name: "Pamilya Staycation",
    price: 20500,
    duration: "24-hour accommodation",
    schedule: "Overnight accommodation",
    minPax: 20,
    maxPax: 30,
    inclusions: ["Pavilion", "Pool", "Videoke", "Tables/chairs", "4 rooms"],
    facilityKeys: ["pavillion", "pool", "videoke", "rooms"],
    eventTypes: [
      "birthday",
      "reunion",
      "family-gathering",
      "staycation",
      "private-event",
      "other",
    ],
    includedRooms: 4,
  },
  {
    type: "room-rates",
    name: "Room Rates",
    price: 0,
    browsePrice: 999,
    duration: "12 hours per selected room",
    schedule: "Room accommodation only",
    minPax: 1,
    maxPax: 24,
    inclusions: ["Selected room accommodation", "Pool use not included"],
    pricingNote: "No fixed package fee; selected room rates are added below.",
    facilityKeys: ["rooms"],
    eventTypes: ["staycation", "private-event", "other"],
  },
];

export const WOODBERRY_PACKAGE_BY_TYPE = Object.fromEntries(
  WOODBERRY_PACKAGES.map((pkg) => [pkg.type, pkg]),
) as Record<WoodberryPackageType, WoodberryPackage>;

const PACKAGE_TYPE_BY_NORMALIZED_NAME = new Map<string, WoodberryPackageType>(
  WOODBERRY_PACKAGES.map((pkg) => [normalizePackageName(pkg.name), pkg.type as WoodberryPackageType]),
);

export function getWoodberryPackage(type: string | null | undefined) {
  return type && type in WOODBERRY_PACKAGE_BY_TYPE
    ? WOODBERRY_PACKAGE_BY_TYPE[type as WoodberryPackageType]
    : null;
}

export function getPackageTypeForManagedPackageName(name: string | null | undefined) {
  return PACKAGE_TYPE_BY_NORMALIZED_NAME.get(normalizePackageName(name)) ?? null;
}

export function getInactiveWoodberryPackageTypes(rows: PackageStatusRow[] | null | undefined) {
  const inactiveTypes = new Set<WoodberryPackageType>();
  for (const row of rows ?? []) {
    const packageType = getPackageTypeForManagedPackageName(row.name);
    if (packageType && row.is_active === false) inactiveTypes.add(packageType);
  }
  return inactiveTypes;
}

export function filterActiveWoodberryPackages(rows: PackageStatusRow[] | null | undefined) {
  const inactiveTypes = getInactiveWoodberryPackageTypes(rows);
  return WOODBERRY_PACKAGES.filter((pkg) => !inactiveTypes.has(pkg.type as WoodberryPackageType));
}

function normalizePackageName(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}
