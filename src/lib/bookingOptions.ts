export type BookingOptionDefinition = {
  key: string;
  label: string;
  price: number;
  detail?: string;
  description?: string;
  image?: string;
  unit?: "hr" | "block";
};

export type PackageDefaultToggle = {
  selected: boolean;
  locked: boolean;
};

export type PackageDefaultValue = {
  value: string | number;
  locked: boolean;
  included?: boolean;
};

export type PackageDefaultItem = {
  key: string;
  quantity?: number;
  locked: boolean;
  included?: boolean;
};

export type PackageBookingSectionLock = "rooms" | "addOns" | "extensions" | "corkage";

export type PackageBookingLockouts = {
  sections: PackageBookingSectionLock[];
  eventTypes: string[];
  rooms: string[];
  roomExtensionHours: boolean;
  addOns: string[];
  extensions: string[];
  corkage: string[];
};

export type PackageBookingOptions = {
  isMultiDay: PackageDefaultToggle | null;
  eventType: PackageDefaultValue | null;
  customEventType: PackageDefaultValue | null;
  rooms: PackageDefaultItem[];
  roomExtensionHours: PackageDefaultValue | null;
  addOns: PackageDefaultItem[];
  extensions: PackageDefaultItem[];
  corkage: PackageDefaultItem[];
  lockouts: PackageBookingLockouts;
};

export const BOOKING_EVENT_TYPES = [
  { key: "wedding", label: "Wedding" },
  { key: "birthday", label: "Birthday Party" },
  { key: "reunion", label: "Reunion" },
  { key: "family-gathering", label: "Family Gathering" },
  { key: "staycation", label: "Staycation" },
  { key: "private-event", label: "Private Event" },
  { key: "corporate", label: "Corporate Event" },
  { key: "conference", label: "Conference" },
  { key: "debut", label: "Debut" },
  { key: "other", label: "Other" },
] as const;

const OPTION_PLACEHOLDER_IMAGE = "/images/booking-options/placeholder.svg";

// TODO: Replace the shared placeholder path with approved photography for each option.
export const BOOKING_OPTION_CATALOG: {
  rooms: BookingOptionDefinition[];
  roomExtension: BookingOptionDefinition;
  addOns: BookingOptionDefinition[];
  extensions: BookingOptionDefinition[];
  corkage: BookingOptionDefinition[];
} = {
  rooms: [
    { key: "room-1", label: "Room 1", price: 999, detail: "12 hours / up to 4 guests", description: "A comfortable private room for guests who need a nearby place to rest.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "room-2", label: "Room 2", price: 999, detail: "12 hours / up to 4 guests", description: "An extra guest room suited to small families or event participants.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "room-3", label: "Room 3", price: 999, detail: "12 hours / up to 4 guests", description: "A convenient overnight or daytime room addition for your group.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "room-4", label: "Room 4", price: 999, detail: "12 hours / up to 4 guests", description: "Additional private accommodation close to your Woodberry celebration.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "room-5", label: "Room 5", price: 1499, detail: "12 hours / up to 2 guests", description: "A room option for two guests who would like a quieter retreat.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "room-6", label: "Room 6", price: 1999, detail: "12 hours / up to 2 guests", description: "A premium two-guest room addition for extra comfort during the stay.", image: OPTION_PLACEHOLDER_IMAGE },
  ],
  roomExtension: {
    key: "room-extension",
    label: "Room extension",
    price: 200,
    detail: "Per extra hour",
    description: "Keep your selected room or rooms beyond the standard 12-hour period.",
    image: OPTION_PLACEHOLDER_IMAGE,
    unit: "hr",
  },
  addOns: [
    { key: "lights", label: "Lights", price: 3500, description: "Add Woodberry event lighting to your booking.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "projector", label: "Projector", price: 1500, description: "Use Woodberry's projector for presentations, videos, or slideshows.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "big-tv", label: '65" Big TV', price: 1500, description: "Add a large display for videos, presentations, or event visuals.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "videoke", label: "Videoke", price: 500, description: "Add Woodberry's videoke setup for your celebration.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "led-wall", label: "LED Wall", price: 16000, description: "Add Woodberry's LED wall for a large-format event display.", image: OPTION_PLACEHOLDER_IMAGE },
  ],
  extensions: [
    { key: "pavilion-pool", label: "Pavilion + Pool", price: 500, unit: "hr", description: "Extend access to the pavilion and swimming pool for your gathering.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "sound-system", label: "Sound system", price: 400, unit: "hr", description: "Add more operating time for Woodberry's sound system during your event.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "over-200-guests", label: "Add capacity for 50 guests over 200", price: 1000, unit: "block", description: "Increase the planned capacity in blocks of up to 50 additional guests.", image: OPTION_PLACEHOLDER_IMAGE },
  ],
  corkage: [
    { key: "led-wall", label: "LED wall", price: 2000, description: "Bring an external LED wall for presentations, videos, or event visuals.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "lights", label: "Lights", price: 1000, description: "Bring external event lighting that requires venue power or setup access.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "projector", label: "Projector", price: 500, description: "Bring an outside projector for presentations, videos, or slideshows.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "electric-booth", label: "Electric booth", price: 300, description: "Set up an outside booth that needs access to electricity.", image: OPTION_PLACEHOLDER_IMAGE },
    { key: "electric-instrument", label: "Electric instrument", price: 300, description: "Use an outside electric instrument through the venue's power supply.", image: OPTION_PLACEHOLDER_IMAGE },
  ],
};

export const ROOM_RATE_OPTIONS = BOOKING_OPTION_CATALOG.rooms;
export const ROOM_EXTENSION_OPTION = BOOKING_OPTION_CATALOG.roomExtension;
export const ADD_ON_OPTIONS = BOOKING_OPTION_CATALOG.addOns;
export const EXTENSION_OPTIONS = BOOKING_OPTION_CATALOG.extensions;
export const CORKAGE_OPTIONS = BOOKING_OPTION_CATALOG.corkage;

export const EMPTY_PACKAGE_BOOKING_OPTIONS: PackageBookingOptions = {
  isMultiDay: null,
  eventType: null,
  customEventType: null,
  rooms: [],
  roomExtensionHours: null,
  addOns: [],
  extensions: [],
  corkage: [],
  lockouts: {
    sections: [],
    eventTypes: [],
    rooms: [],
    roomExtensionHours: false,
    addOns: [],
    extensions: [],
    corkage: [],
  },
};

const eventTypeKeys = new Set<string>(BOOKING_EVENT_TYPES.map((item) => item.key));
const roomKeys = new Set(ROOM_RATE_OPTIONS.map((item) => item.key));
const addOnKeys = new Set(ADD_ON_OPTIONS.map((item) => item.key));
const extensionKeys = new Set(EXTENSION_OPTIONS.map((item) => item.key));
const corkageKeys = new Set(CORKAGE_OPTIONS.map((item) => item.key));
const sectionLockKeys = new Set<PackageBookingSectionLock>(["rooms", "addOns", "extensions", "corkage"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeItems(value: unknown, allowedKeys: Set<string>, withQuantity = false): PackageDefaultItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: PackageDefaultItem[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.key !== "string" || !allowedKeys.has(item.key) || seen.has(item.key)) continue;
    seen.add(item.key);
    result.push({
      key: item.key,
      ...(withQuantity
        ? { quantity: Math.max(1, Math.min(168, Math.floor(Number(item.quantity) || 1))) }
        : {}),
      locked: item.locked === true,
      included: item.included === true,
    });
  }
  return result;
}

function normalizeKeys<T extends string>(value: unknown, allowedKeys: Set<T>): T[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !allowedKeys.has(item as T) || seen.has(item as T)) continue;
    seen.add(item as T);
    result.push(item as T);
  }
  return result;
}

export function normalizePackageBookingOptions(value: unknown): PackageBookingOptions {
  if (!isRecord(value)) {
    return {
      ...EMPTY_PACKAGE_BOOKING_OPTIONS,
      rooms: [],
      extensions: [],
      corkage: [],
    };
  }

  const multiDay = isRecord(value.isMultiDay)
    ? { selected: value.isMultiDay.selected === true, locked: value.isMultiDay.locked === true }
    : null;
  const eventType = isRecord(value.eventType) && typeof value.eventType.value === "string" && eventTypeKeys.has(value.eventType.value)
    ? { value: value.eventType.value, locked: value.eventType.locked === true }
    : null;
  const customEventType = isRecord(value.customEventType)
    && typeof value.customEventType.value === "string"
    && value.customEventType.value.trim()
    ? {
        value: value.customEventType.value.trim().slice(0, 100),
        locked: value.customEventType.locked === true,
      }
    : null;
  const roomExtensionHours = isRecord(value.roomExtensionHours)
    && Number.isFinite(Number(value.roomExtensionHours.value))
    && Number(value.roomExtensionHours.value) > 0
    ? {
        value: Math.min(168, Math.floor(Number(value.roomExtensionHours.value))),
        locked: value.roomExtensionHours.locked === true,
        included: value.roomExtensionHours.included === true,
      }
    : null;
  const lockouts = isRecord(value.lockouts) ? value.lockouts : {};

  return {
    isMultiDay: multiDay,
    eventType,
    customEventType,
    rooms: normalizeItems(value.rooms, roomKeys),
    roomExtensionHours,
    addOns: normalizeItems(value.addOns, addOnKeys),
    extensions: normalizeItems(value.extensions, extensionKeys, true),
    corkage: normalizeItems(value.corkage, corkageKeys),
    lockouts: {
      sections: normalizeKeys(lockouts.sections, sectionLockKeys),
      eventTypes: normalizeKeys(lockouts.eventTypes, eventTypeKeys),
      rooms: normalizeKeys(lockouts.rooms, roomKeys),
      roomExtensionHours: lockouts.roomExtensionHours === true,
      addOns: normalizeKeys(lockouts.addOns, addOnKeys),
      extensions: normalizeKeys(lockouts.extensions, extensionKeys),
      corkage: normalizeKeys(lockouts.corkage, corkageKeys),
    },
  };
}
