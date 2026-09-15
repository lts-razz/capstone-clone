import { z } from "zod";
import {
  ADD_ON_OPTIONS,
  BOOKING_EVENT_TYPES,
  CORKAGE_OPTIONS,
  EXTENSION_OPTIONS,
  ROOM_RATE_OPTIONS,
} from "../lib/bookingOptions";

const timeValue = z
  .string({
    required_error: "Choose both package time-range values.",
    invalid_type_error: "Package times must use HH:MM format.",
  })
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Package times must use HH:MM format.");
const durationHours = z
  .number({
    required_error: "Enter the required package duration.",
    invalid_type_error: "Package duration must be a number of hours.",
  })
  .positive("Duration must be greater than 0 hours.")
  .max(168, "Duration must be 168 hours or less.")
  .multipleOf(0.5, "Duration must use 30-minute increments.");

export const packageTimeOptionsSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("fixed_range"),
    from_time: timeValue,
    to_time: timeValue,
  }).strict("Time range packages cannot also include a specific duration."),
  z.object({
    mode: z.literal("duration"),
    hours: durationHours,
  }).strict("Duration-only packages cannot also include a time range."),
  z.object({
    mode: z.literal("range_duration"),
    from_time: timeValue,
    to_time: timeValue,
    hours: durationHours,
  }).strict(),
]).superRefine((options, ctx) => {
  if (options.mode === "duration") return;
  if (options.from_time === options.to_time) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Package start and end times must be different.",
      path: ["to_time"],
    });
    return;
  }
  if (options.mode === "range_duration") {
    const [fromHours, fromMinutes] = options.from_time.split(":").map(Number);
    const [toHours, toMinutes] = options.to_time.split(":").map(Number);
    const from = fromHours * 60 + fromMinutes;
    const to = toHours * 60 + toMinutes;
    const rangeMinutes = to > from ? to - from : 24 * 60 - from + to;
    if (options.hours * 60 > rangeMinutes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The required duration must fit inside the configured time range.",
        path: ["hours"],
      });
    }
  }
});

// Package configuration is stored separately in booking_options. This field is
// always the administrator-entered base amount, never a configuration total.
export const packageBasePriceSchema = z.number().nonnegative("base price must be 0 or more");

const optionKey = (values: string[], message: string) => z.string().refine(
  (value) => values.includes(value),
  message,
);
const packageDefaultItemSchema = (values: string[]) => z.object({
  key: optionKey(values, "Unknown booking option"),
  locked: z.boolean().default(false),
  included: z.boolean().default(false),
});
const packageDefaultQuantityItemSchema = (values: string[]) => z.object({
  key: optionKey(values, "Unknown booking option"),
  quantity: z.number().int().min(1).max(168),
  locked: z.boolean().default(false),
  included: z.boolean().default(false),
});

const packageBookingLockoutsSchema = z.object({
  sections: z.array(z.enum(["rooms", "addOns", "extensions", "corkage"])).default([]),
  eventTypes: z.array(optionKey(BOOKING_EVENT_TYPES.map((item) => item.key), "Unknown event type")).default([]),
  rooms: z.array(optionKey(ROOM_RATE_OPTIONS.map((item) => item.key), "Unknown room option")).default([]),
  roomExtensionHours: z.boolean().default(false),
  addOns: z.array(optionKey(ADD_ON_OPTIONS.map((item) => item.key), "Unknown add-on option")).default([]),
  extensions: z.array(optionKey(EXTENSION_OPTIONS.map((item) => item.key), "Unknown extension option")).default([]),
  corkage: z.array(optionKey(CORKAGE_OPTIONS.map((item) => item.key), "Unknown corkage option")).default([]),
}).default({});

export const packageBookingOptionsSchema = z.object({
  isMultiDay: z.object({
    selected: z.boolean(),
    locked: z.boolean().default(false),
  }).nullable().default(null),
  eventType: z.object({
    value: optionKey(BOOKING_EVENT_TYPES.map((item) => item.key), "Unknown event type"),
    locked: z.boolean().default(false),
  }).nullable().default(null),
  customEventType: z.object({
    value: z.string().trim().min(1).max(100),
    locked: z.boolean().default(false),
  }).nullable().default(null),
  rooms: z.array(packageDefaultItemSchema(ROOM_RATE_OPTIONS.map((item) => item.key))).default([]),
  roomExtensionHours: z.object({
    value: z.number().int().min(1).max(168),
    locked: z.boolean().default(false),
    included: z.boolean().default(false),
  }).nullable().default(null),
  addOns: z.array(packageDefaultItemSchema(ADD_ON_OPTIONS.map((item) => item.key))).default([]),
  extensions: z.array(packageDefaultQuantityItemSchema(EXTENSION_OPTIONS.map((item) => item.key))).default([]),
  corkage: z.array(packageDefaultItemSchema(CORKAGE_OPTIONS.map((item) => item.key))).default([]),
  lockouts: packageBookingLockoutsSchema,
});

const packageRulesSchema = z.object({
  event_types: z.array(optionKey(BOOKING_EVENT_TYPES.map((item) => item.key), "Unknown event type")).default([]),
}).passthrough();

/**
 * POST /api/packages  (admin — create)
 * PUT  /api/packages/:id  (admin — update)
 */
export const packageSchema = z.object({
  name:        z.string().min(1, "name is required").max(200),
  description: z.string().max(2000).nullable().optional(),
  price:       packageBasePriceSchema,
  inclusions:  z.string().max(2000).nullable().optional(),
  included_facilities: z.array(z.string().trim().min(1).max(200)).max(100).nullable().optional(),
  rules: packageRulesSchema.nullable().optional(),
  min_pax:     z.number().int().positive("min_pax must be positive").nullable().optional(),
  max_pax:     z.number().int().positive("max_pax must be positive").nullable().optional(),
  venue_id:    z.string().uuid("venue_id must be a valid venue id").nullable().optional(),
  venue_ids:   z.array(z.string().uuid("venue_ids must contain valid venue ids"))
    .max(50)
    .superRefine((venueIds, ctx) => {
      const seen = new Set<string>();
      venueIds.forEach((venueId, index) => {
        if (seen.has(venueId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "A venue can only be assigned to a package once.",
            path: [index],
          });
        }
        seen.add(venueId);
      });
    })
    .optional(),
  time_options: packageTimeOptionsSchema.nullable().optional(),
  thumbnail_url: z.string().url("thumbnail_url must be a valid URL").max(2048).nullable().optional(),
  booking_options: packageBookingOptionsSchema.optional(),
  is_active:   z.boolean().optional(),
});

export type PackageInput = z.infer<typeof packageSchema>;
