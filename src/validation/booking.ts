import { z } from "zod";
import { isOnOrAfterMinimumBookingDate, parseDateOnly } from "../lib/bookingDateRules";

const dateTimeLocalString = z
  .string({
    required_error: "Please choose a valid date and time.",
    invalid_type_error: "Please choose a valid date and time.",
  })
  .regex(
    /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/,
    "Please choose a valid date and time.",
  )
  .refine(
    (value) => !Number.isNaN(parseDateOnly(value.slice(0, 10)).getTime()),
    "Please choose a valid date and time.",
  );

const packageTypeSchema = z
  .string({
    required_error: "Please choose an available Woodberry package.",
    invalid_type_error: "Please choose an available Woodberry package.",
  })
  .trim()
  .min(1, "Please choose an available Woodberry package.")
  .max(200, "Please choose an available Woodberry package.");

const selectedItemSchema = z.object({
  key: z.string().trim().min(1, "Each selected option must have a valid key.").max(100),
  label: z.string().trim().min(1, "Each selected option must have a readable label.").max(200),
  group: z.string().trim().min(1).max(100).optional(),
  price: z.number().min(0),
  quantity: z.number().int().min(1).optional(),
  hours: z.number().int().min(0).max(168).optional(),
  amount: z.number().min(0).optional(),
});

const estimateSummarySchema = z.object({
  packageBase: z.number().min(0),
  rooms: z.number().min(0),
  addOns: z.number().min(0),
  extensions: z.number().min(0),
  corkage: z.number().min(0),
  total: z.number().min(0),
  minimumPayment: z.number().min(0),
  remainingBalance: z.number().min(0),
  roughAdditionsTotal: z.number().min(0).optional(),
});

const termsAgreementMessage =
  "Please confirm that you have read and agree to the Terms and Conditions before submitting your request.";

const notificationPreferenceSchema = z
  .enum(["email", "sms", "both"], {
    errorMap: () => ({ message: "Please choose how you would like to receive booking updates." }),
  })
  .default("both");

export const createBookingSchema = z
  .object({
    venueId: z
      .string({
        required_error: "We could not prepare the booking calendar for this package. Please return to the packages page and try again.",
        invalid_type_error: "We could not prepare the booking calendar for this package. Please return to the packages page and try again.",
      })
      .uuid("We could not prepare the booking calendar for this package. Please return to the packages page and try again."),
    isMultiDay: z.boolean().default(false),
    startDateTime: dateTimeLocalString,
    endDateTime: dateTimeLocalString,
    eventType: z
      .string({
        required_error: "Please choose the type of celebration or event.",
        invalid_type_error: "Please choose the type of celebration or event.",
      })
      .trim()
      .min(1, "Please choose the type of celebration or event.")
      .max(100, "Please choose a valid event type."),
    customEventType: z
      .string()
      .trim()
      .max(100, "Please shorten the celebration type to 100 characters or fewer.")
      .optional()
      .nullable(),
    packageId: z.string().uuid("We could not verify the selected package. Please choose the package again.").optional().nullable(),
    packageType: packageTypeSchema,
    packagePrice: z
      .number({
        required_error: "The package estimate is missing. Please refresh the page and try again.",
        invalid_type_error: "The package estimate is invalid. Please refresh the page and try again.",
      })
      .min(0, "The package estimate is invalid. Please refresh the page and try again."),
    // Accept both pax and guests from booking forms.
    pax: z
      .number({ invalid_type_error: "Please enter the expected number of guests as a whole number." })
      .int("Please enter the expected number of guests as a whole number.")
      .min(1, "The expected number of guests must be at least 1.")
      .optional()
      .nullable(),
    guests: z
      .number({ invalid_type_error: "Please enter the expected number of guests as a whole number." })
      .int("Please enter the expected number of guests as a whole number.")
      .min(1, "The expected number of guests must be at least 1.")
      .optional()
      .nullable(),
    fullName: z
      .string({
        required_error: "Please enter the primary contact's full name.",
        invalid_type_error: "Please enter the primary contact's full name.",
      })
      .trim()
      .min(2, "Please enter the primary contact's full name.")
      .max(200, "Please shorten the primary contact's name to 200 characters or fewer."),
    email: z
      .string({
        required_error: "Please enter the email address for booking updates.",
        invalid_type_error: "Please enter the email address for booking updates.",
      })
      .trim()
      .email("Please enter a complete email address, such as name@example.com.")
      .max(254, "Please enter an email address with 254 characters or fewer."),
    phone: z
      .string({
        required_error: "Please enter a mobile number where Woodberry can contact you.",
        invalid_type_error: "Please enter a mobile number where Woodberry can contact you.",
      })
      .trim()
      .min(7, "Please enter a valid mobile number with at least 7 characters.")
      .max(30, "Please enter a mobile number with 30 characters or fewer."),
    specialRequests: z
      .string()
      .max(1000, "Please shorten your notes or special requests to 1,000 characters or fewer.")
      .optional()
      .nullable(),
    notificationPreference: notificationPreferenceSchema,
    address: z
      .string({
        required_error: "Please enter your complete home or billing address.",
        invalid_type_error: "Please enter your complete home or billing address.",
      })
      .trim()
      .min(5, "Please enter a more complete address, including your city or municipality.")
      .max(500, "Please shorten the address to 500 characters or fewer."),
    caterer: z
      .string()
      .max(200, "Please shorten the caterer's name to 200 characters or fewer.")
      .optional()
      .nullable(),
    useWoodberryCaterer: z.boolean().optional(),
    selectedRooms: z.array(selectedItemSchema).optional().nullable(),
    addOns: z.array(selectedItemSchema).optional().nullable(),
    extensionSelections: z.array(selectedItemSchema).optional().nullable(),
    corkageSelections: z.array(selectedItemSchema).optional().nullable(),
    customItems: z.array(selectedItemSchema).optional().nullable(),
    customOtherRequest: z
      .string()
      .trim()
      .max(1000, "Please shorten the other custom request notes to 1,000 characters or fewer.")
      .optional()
      .nullable(),
    estimateSummary: estimateSummarySchema.optional().nullable(),
    minimumPaymentAmount: z.number().min(0).optional().nullable(),
    remainingBalanceAmount: z.number().min(0).optional().nullable(),
    termsAccepted: z
      .boolean({
        required_error: termsAgreementMessage,
        invalid_type_error: termsAgreementMessage,
      })
      .refine((accepted) => accepted, {
        message: termsAgreementMessage,
      }),
  })
  .superRefine((data, ctx) => {
    if (data.packageType === "custom-booking" && data.packageId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom booking requests cannot use preset package pricing.",
        path: ["packageId"],
      });
    }

    const startDate = data.startDateTime.slice(0, 10);
    if (!isOnOrAfterMinimumBookingDate(startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select a start date at least 1 week from today.",
        path: ["startDateTime"],
      });
    }

    const endDate = data.endDateTime.slice(0, 10);
    if (data.isMultiDay && parseDateOnly(endDate) <= parseDateOnly(startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A multi-day stay must end on a later calendar date.",
        path: ["endDateTime"],
      });
    } else if (!data.isMultiDay && endDate !== startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A single-day booking must start and end on the same calendar date.",
        path: ["endDateTime"],
      });
    }

    if (data.endDateTime <= data.startDateTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Booking end date and time must be after the start date and time.",
        path: ["endDateTime"],
      });
    }

    if (data.eventType === "other" && !data.customEventType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please specify the celebration or event type.",
        path: ["customEventType"],
      });
    }
  })
  .transform((d) => ({
    ...d,
    startDate: d.startDateTime.slice(0, 10),
    endDate: d.endDateTime.slice(0, 10),
    eventDate: d.startDateTime.slice(0, 10),
    eventType: d.eventType === "other" ? d.customEventType?.trim() ?? null : d.eventType,
    pax: d.pax ?? d.guests ?? null,
    specialRequests: d.specialRequests || null,
    emailNotificationsEnabled:
      d.notificationPreference === "email" || d.notificationPreference === "both",
    smsNotificationsEnabled:
      d.notificationPreference === "sms" || d.notificationPreference === "both",
  }));

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
