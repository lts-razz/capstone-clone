// POST /api/bookings/CreateBookings - create a booking (requires auth)
import type { APIRoute } from "astro";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { isEmailVerified } from "../../../lib/auth";
import { customerGuard } from "../../../lib/adminGuard";
import { createBookingSchema } from "../../../validation/booking";
import { created, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import { notifyBookingSubmitted } from "../../../services/notifications";
import { getWoodberryPackage } from "../../../lib/woodberryPackages";
import { parseInclusions } from "../../../lib/packageDisplay";
import { getRequiredPackageVenueIds } from "../../../services/packageAssignments";
import { validatePackageBookingTimes } from "../../../lib/packageTimeOptions";
import {
  ADD_ON_OPTIONS,
  CORKAGE_OPTIONS,
  EXTENSION_OPTIONS,
  ROOM_EXTENSION_OPTION,
  ROOM_RATE_OPTIONS,
  normalizePackageBookingOptions,
  type BookingOptionDefinition,
  type PackageDefaultItem,
} from "../../../lib/bookingOptions";

export const prerender = false;

const CUSTOM_BOOKING_TYPE = "custom-booking";
const CUSTOM_BOOKING_NAME = "Custom Booking";

const ROOM_OPTIONS_WITH_EXTENSION: BookingOptionDefinition[] = [
  ...ROOM_RATE_OPTIONS,
  ROOM_EXTENSION_OPTION,
];

type RateItem = {
  key: string;
  label: string;
  price: number;
  quantity?: number;
  hours?: number;
  amount?: number;
  included?: boolean;
  includedQuantity?: number;
};

function priceItems(items: RateItem[] | null | undefined, definitions: BookingOptionDefinition[]) {
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  return (items ?? []).flatMap((item) => {
    const definition = definitionByKey.get(item.key);
    if (!definition) return [];
    const unitPrice = definition.price;
    const multiplier = Math.max(1, Number(item.hours ?? item.quantity ?? 1));
    const includedQuantity = item.included === true
      ? Math.min(multiplier, Math.max(0, Number(item.includedQuantity ?? multiplier) || 0))
      : 0;
    return [{
      ...item,
      label: definition.label,
      price: unitPrice,
      included: item.included === true,
      includedQuantity: item.included === true ? includedQuantity : undefined,
      amount: unitPrice * Math.max(0, multiplier - includedQuantity),
    }];
  });
}

function mergePackageDefaults(
  items: RateItem[] | null | undefined,
  defaults: PackageDefaultItem[],
) {
  // Inclusion metadata is package-owned. Never trust a booking payload to mark
  // an arbitrary selection as already covered by the package base price.
  const itemByKey = new Map<string, RateItem>((items ?? []).map((item) => [item.key, {
    ...item,
    included: false,
    includedQuantity: undefined,
  }] as [string, RateItem]));
  for (const configured of defaults) {
    const existing = itemByKey.get(configured.key);
    if (existing) {
      if (configured.locked && configured.quantity) existing.hours = configured.quantity;
      existing.included = configured.included === true;
      existing.includedQuantity = configured.included && configured.quantity
        ? configured.quantity
        : undefined;
      itemByKey.set(configured.key, existing);
      continue;
    }
    if (configured.locked) {
      const item: RateItem = {
        key: configured.key,
        label: "",
        price: 0,
        included: configured.included === true,
      };
      if (configured.quantity) item.hours = configured.quantity;
      if (configured.included && configured.quantity) item.includedQuantity = configured.quantity;
      itemByKey.set(configured.key, item);
    }
  }
  return [...itemByKey.values()];
}

function selectedKeys(items: RateItem[] | null | undefined) {
  return new Set((items ?? []).map((item) => item.key).filter(Boolean));
}

function hasAnyKey(items: RateItem[] | null | undefined, keys: Set<string>) {
  if (keys.size === 0) return false;
  return (items ?? []).some((item) => keys.has(item.key));
}

function withoutDisabledDefaults(defaults: PackageDefaultItem[], disabledKeys: Set<string>) {
  if (disabledKeys.size === 0) return defaults;
  return defaults.filter((item) => !disabledKeys.has(item.key));
}

function sumItems(items: RateItem[]) {
  return items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
}

function validateCatalogSelections(
  items: RateItem[] | null | undefined,
  definitions: BookingOptionDefinition[],
  groupLabel: string,
  hourlyKeys: Set<string> = new Set(),
) {
  const allowedKeys = new Set(definitions.map((definition) => definition.key));
  const seenKeys = new Set<string>();

  for (const item of items ?? []) {
    if (!allowedKeys.has(item.key)) {
      return `One or more selected ${groupLabel} are not recognized. Please reload the booking form and try again.`;
    }
    if (seenKeys.has(item.key)) {
      return `Each ${groupLabel} selection can only be included once.`;
    }
    seenKeys.add(item.key);

    if (hourlyKeys.has(item.key)) {
      if (!Number.isInteger(item.hours) || Number(item.hours) < 1 || Number(item.hours) > 168) {
        return `Please enter between 1 and 168 hours for each selected ${groupLabel}.`;
      }
      continue;
    }

    if (item.hours !== undefined || (item.quantity !== undefined && item.quantity !== 1)) {
      return `${groupLabel[0].toUpperCase()}${groupLabel.slice(1)} selections are charged once per selected item.`;
    }
  }

  return null;
}

const db = supabaseAdmin ?? supabase;

function reservationInsertError(insertError: { message: string }) {
  if (insertError.message.includes("booking_unavailable")) {
    return error("The selected schedule is no longer available. Please choose another date or time.", 409);
  }
  if (insertError.message.includes("invalid_booking_schedule") || insertError.message.includes("invalid_booking_venues")) {
    return error("The booking schedule or its venues could not be verified. Please reload and try again.", 400);
  }
  console.error("[CreateBookings] Reservation insert failed", insertError.message);
  return error("We could not submit your booking request. Please try again.", 500);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await customerGuard(cookies);
  if (guard instanceof Response) return guard;
  const user = guard.user;
  if (!isEmailVerified(user)) {
    return error("Please verify your email before booking.", 403);
  }

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = createBookingSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const selectionValidationError = [
    validateCatalogSelections(
      parsed.data.selectedRooms,
      ROOM_OPTIONS_WITH_EXTENSION,
      "room options",
      new Set([ROOM_EXTENSION_OPTION.key]),
    ),
    validateCatalogSelections(parsed.data.addOns, ADD_ON_OPTIONS, "add-ons"),
    validateCatalogSelections(
      parsed.data.extensionSelections,
      EXTENSION_OPTIONS,
      "extension options",
      new Set(EXTENSION_OPTIONS.map((option) => option.key)),
    ),
    validateCatalogSelections(parsed.data.corkageSelections, CORKAGE_OPTIONS, "corkage options"),
  ].find(Boolean);
  if (selectionValidationError) return error(selectionValidationError, 400);

  const {
    venueId,
    startDate,
    endDate,
    eventDate,
    startDateTime,
    endDateTime,
    eventType,
    packageId,
    packageType,
    pax,
    fullName,
    email,
    phone,
    specialRequests,
    emailNotificationsEnabled,
    smsNotificationsEnabled,
  } = parsed.data;

  const now = new Date().toISOString();
  const reservationExpiresAt = new Date(
    new Date(now).getTime() + 48 * 60 * 60 * 1000,
  ).toISOString();
  const notificationPreferenceLabel =
    parsed.data.notificationPreference === "email"
      ? "email only"
      : parsed.data.notificationPreference === "sms"
        ? "SMS only"
        : "both email and SMS";

  const isCustomBooking = packageType === CUSTOM_BOOKING_TYPE && !packageId;

  if (isCustomBooking) {
    const { data: venue, error: venueError } = await db
      .from("venues")
      .select("id, price_per_night, is_active, name, capacity")
      .eq("id", venueId)
      .maybeSingle();

    if (venueError) {
      console.error("[CreateBookings] Custom venue lookup failed", venueError.message);
      return error("Could not verify the selected venue. Please try again.", 500);
    }
    if (!venue || !venue.is_active) {
      return error("This venue is not currently available for custom booking. Please choose another venue.", 400);
    }
    const venueCapacity = Number(venue.capacity) || 0;
    if (venueCapacity > 0 && pax && pax > venueCapacity) {
      return error(`${venue.name} can accommodate up to ${venueCapacity} guests. Please adjust the guest count or choose another venue.`, 400);
    }

    // Custom bookings retain catalog rates as rough estimates for admin review,
    // while payable booking totals remain zero until an admin sets final pricing.
    const selectedRooms = priceItems(parsed.data.selectedRooms, ROOM_OPTIONS_WITH_EXTENSION);
    const selectedAddOns = priceItems(parsed.data.addOns, ADD_ON_OPTIONS);
    const selectedExtensions = priceItems(parsed.data.extensionSelections, EXTENSION_OPTIONS);
    const selectedCorkage = priceItems(parsed.data.corkageSelections, CORKAGE_OPTIONS);
    const customItems = (parsed.data.customItems ?? []).map((item) => ({
      key: item.key,
      label: item.label,
      group: item.group ?? "Custom",
      price: 0,
      quantity: item.quantity ?? 1,
      amount: 0,
    }));
    const customOtherRequest = parsed.data.customOtherRequest?.trim() || null;
    const customSpecialRequests = [
      specialRequests?.trim() ? specialRequests.trim() : "",
      customOtherRequest ? `Other custom request: ${customOtherRequest}` : "",
    ].filter(Boolean).join("\n\n") || null;
    const roomsTotal = sumItems(selectedRooms);
    const addOnsTotal = sumItems(selectedAddOns);
    const extensionsTotal = sumItems(selectedExtensions);
    const corkageTotal = sumItems(selectedCorkage);
    const roughAdditionsTotal = roomsTotal + addOnsTotal + extensionsTotal + corkageTotal;
    const estimateSummary = {
      packageBase: 0,
      rooms: roomsTotal,
      addOns: addOnsTotal,
      extensions: extensionsTotal,
      corkage: corkageTotal,
      total: 0,
      minimumPayment: 0,
      remainingBalance: 0,
      roughAdditionsTotal,
      pricingStatus: "staff_review_required",
    };

    // The booking INSERT trigger reserves the venue and writes its assignment atomically.
    const { data: newBooking, error: insertError } = await db
      .from("bookings")
      .insert({
        user_id: user.id,
        venue_id: venue.id,
        start_date: startDate,
        end_date: endDate,
        event_date: eventDate ?? null,
        start_datetime: startDateTime,
        end_datetime: endDateTime,
        event_type: eventType ?? null,
        package_id: null,
        package_type: CUSTOM_BOOKING_TYPE,
        package_price: 0,
        pax: pax ?? null,
        full_name: fullName ?? null,
        email: email ?? null,
        phone: phone ?? null,
        email_notifications_enabled: emailNotificationsEnabled,
        sms_notifications_enabled: smsNotificationsEnabled,
        special_requests: customSpecialRequests,
        total_price: 0,
        status: "pending",
        quotation_status: "pending",
        quotation_finalized_at: null,
        reservation_created_at: now,
        reservation_expires_at: null,
        reservation_expired_at: null,
        created_at: now,
        updated_at: now,
        address: parsed.data.address ?? null,
        caterer: parsed.data.useWoodberryCaterer ? "Woodberry's Caterer" : parsed.data.caterer ?? null,
        use_woodberry_caterer: parsed.data.useWoodberryCaterer ?? false,
        package_inclusions: {
          packageName: CUSTOM_BOOKING_NAME,
          included: [],
          customBooking: true,
          pricingNote: "Displayed item rates are rough estimates only. Final pricing and required payment are determined by Woodberry admin.",
        },
        rooms_count: null,
        selected_rooms: selectedRooms,
        facility_time_ranges: null,
        additionals: {
          customBooking: true,
          customItems,
          customOtherRequest,
          roughAdditionsTotal,
          pricingNote: "Displayed item rates are rough estimates only. Final pricing and required payment are determined by Woodberry admin.",
        },
        add_ons: selectedAddOns,
        extension_selections: selectedExtensions,
        corkage_selections: selectedCorkage,
        estimate_summary: estimateSummary,
        minimum_payment_amount: 0,
        remaining_balance_amount: 0,
        terms_accepted_at: parsed.data.termsAccepted ? now : null,
      })
      .select("id, reservation_expires_at")
      .single();

    if (insertError) return reservationInsertError(insertError);

    try {
      await notifyBookingSubmitted(newBooking.id, db);
    } catch (notificationError) {
      console.error("[CreateBookings] Custom submission notification failed", {
        bookingId: newBooking.id,
        error:
          notificationError instanceof Error
            ? notificationError.message
            : "Submission notification failed",
      });
    }

    return created({
      bookingId: newBooking.id,
      bookingType: CUSTOM_BOOKING_TYPE,
      totalPrice: 0,
      minimumPaymentAmount: 0,
      remainingBalanceAmount: 0,
      paymentAvailable: false,
      reservationExpiresAt: newBooking.reservation_expires_at,
      message:
        `Your custom booking request was submitted. Our team will review your preferred venue, items, and schedule, then contact you with a final quotation. No online payment is required until pricing is confirmed. We will send booking updates by ${notificationPreferenceLabel}.`,
    });
  }

  const fallbackPackage = getWoodberryPackage(packageType);
  const { data: managedPackage, error: packageLookupError } = packageId
    ? await db
        .from("packages")
        .select("id, name, price, inclusions, max_pax, min_pax, included_facilities, rules, booking_options, time_options, is_active, venue_id")
        .eq("id", packageId)
        .maybeSingle()
    : await db
        .from("packages")
        .select("id, name, price, inclusions, max_pax, min_pax, included_facilities, rules, booking_options, time_options, is_active, venue_id")
        .eq("name", fallbackPackage?.name ?? packageType)
        .maybeSingle();

  if (packageLookupError) {
    console.error("[CreateBookings] Package status lookup failed", packageLookupError.message);
    return error("Could not verify package availability. Please try again.", 500);
  }
  if (!managedPackage) {
    return error("This package is not currently available for booking. Please choose another package.", 404);
  }
  if (!managedPackage.is_active) {
    return error("This package is not currently available for booking. Please choose another package.", 400);
  }
  const packageVenues = await getRequiredPackageVenueIds(db, managedPackage.id, managedPackage.venue_id);
  if (packageVenues.error) {
    console.error("[CreateBookings] Package venue lookup failed", packageVenues.error.message);
    return error("Could not verify the venues included with this package. Please try again.", 500);
  }
  if (packageVenues.venueIds.length === 0) {
    return error("This package needs an assigned venue before it can be booked. Please contact Woodberry.", 400);
  }
  const primaryVenueId = managedPackage.venue_id && packageVenues.venueIds.includes(managedPackage.venue_id)
    ? managedPackage.venue_id
    : packageVenues.venueIds[0];
  if (primaryVenueId !== venueId) {
    return error("This package venue could not be verified. Please return to the package page and try again.", 400);
  }

  const { data: assignedVenues, error: venuesError } = await db
    .from("venues")
    .select("id, price_per_night, is_active, name, capacity")
    .in("id", packageVenues.venueIds)
    .eq("is_active", true);

  if (venuesError) return error("We could not prepare the booking calendar for this package. Please return to the packages page and try again.", 500);
  if ((assignedVenues ?? []).length !== packageVenues.venueIds.length) {
    return error("One or more venues included with this package are not currently available. Please contact Woodberry.", 400);
  }
  const venue = assignedVenues?.find((item) => item.id === primaryVenueId);
  if (!venue) return error("We could not prepare the booking calendar for this package. Please return to the packages page and try again.", 404);

  const minPax = Number(managedPackage.min_pax ?? fallbackPackage?.minPax ?? 1);
  const assignedVenueCapacities = (assignedVenues ?? [])
    .map((item) => Number(item.capacity) || 0)
    .filter((capacity) => capacity > 0);
  const maxPax = Number(
    managedPackage.max_pax
      ?? fallbackPackage?.maxPax
      ?? (assignedVenueCapacities.length > 0 ? Math.min(...assignedVenueCapacities) : venue.capacity)
      ?? 999,
  );
  const packageName = managedPackage.name || fallbackPackage?.name || "Woodberry package";
  const packageIncluded = parseInclusions(managedPackage.inclusions, managedPackage.included_facilities);
  const packageBookingOptions = normalizePackageBookingOptions(managedPackage.booking_options);
  const packageRules = managedPackage.rules && typeof managedPackage.rules === "object" && !Array.isArray(managedPackage.rules)
    ? managedPackage.rules
    : null;
  const allowedEventTypes = Array.isArray(packageRules?.event_types)
    ? packageRules.event_types.filter((item): item is string => typeof item === "string")
    : [];
  const lockouts = packageBookingOptions.lockouts;
  const disabledSections = new Set(lockouts.sections);
  const disabledRoomKeys = new Set(lockouts.rooms);
  if (lockouts.roomExtensionHours) disabledRoomKeys.add(ROOM_EXTENSION_OPTION.key);
  const disabledAddOnKeys = new Set(lockouts.addOns);
  const disabledExtensionKeys = new Set(lockouts.extensions);
  const disabledCorkageKeys = new Set(lockouts.corkage);

  if (
    packageBookingOptions.isMultiDay?.locked
    && parsed.data.isMultiDay !== packageBookingOptions.isMultiDay.selected
  ) {
    return error("The selected package has a fixed booking duration mode. Please reload the form and try again.", 400);
  }
  const requestedEventType = typeof body.data === "object" && body.data && "eventType" in body.data
    ? String(body.data.eventType ?? "")
    : "";
  if (allowedEventTypes.length > 0 && !allowedEventTypes.includes(requestedEventType)) {
    return error("The selected package does not support that event type. Please reload the form and try again.", 400);
  }
  if (lockouts.eventTypes.includes(requestedEventType)) {
    return error("The selected package does not support that event type. Please choose another event type.", 400);
  }
  const packageTimeValidationError = validatePackageBookingTimes(
    managedPackage.time_options,
    parsed.data.startDateTime,
    parsed.data.endDateTime,
  );
  if (packageTimeValidationError) return error(packageTimeValidationError, 400);

  if (!pax || pax < minPax || pax > maxPax) {
    return error(
      `${packageName} allows ${minPax}-${maxPax} guests. Please adjust the guest count or choose another package.`,
      400,
    );
  }

  const roomDefaults = [...packageBookingOptions.rooms];
  if (!disabledSections.has("rooms") && packageBookingOptions.roomExtensionHours && !lockouts.roomExtensionHours) {
    roomDefaults.push({
      key: "room-extension",
      quantity: Number(packageBookingOptions.roomExtensionHours.value),
      locked: packageBookingOptions.roomExtensionHours.locked,
      included: packageBookingOptions.roomExtensionHours.included,
    });
  }
  if (disabledSections.has("rooms") && selectedKeys(parsed.data.selectedRooms).size > 0) {
    return error("Rooms are not available with the selected package. Please reload the form and try again.", 400);
  }
  if (hasAnyKey(parsed.data.selectedRooms, disabledRoomKeys)) {
    return error("One or more selected room options are not available with the selected package.", 400);
  }
  if (disabledSections.has("addOns") && selectedKeys(parsed.data.addOns).size > 0) {
    return error("Add-ons are not available with the selected package. Please reload the form and try again.", 400);
  }
  if (hasAnyKey(parsed.data.addOns, disabledAddOnKeys)) {
    return error("One or more selected add-ons are not available with the selected package.", 400);
  }
  if (disabledSections.has("extensions") && selectedKeys(parsed.data.extensionSelections).size > 0) {
    return error("Extra time and capacity additions are not available with the selected package. Please reload the form and try again.", 400);
  }
  if (hasAnyKey(parsed.data.extensionSelections, disabledExtensionKeys)) {
    return error("One or more selected extra-time options are not available with the selected package.", 400);
  }
  if (disabledSections.has("corkage") && selectedKeys(parsed.data.corkageSelections).size > 0) {
    return error("Corkage options are not available with the selected package. Please reload the form and try again.", 400);
  }
  if (hasAnyKey(parsed.data.corkageSelections, disabledCorkageKeys)) {
    return error("One or more selected corkage options are not available with the selected package.", 400);
  }

  const selectedRooms = priceItems(
    mergePackageDefaults(
      parsed.data.selectedRooms,
      disabledSections.has("rooms") ? [] : withoutDisabledDefaults(roomDefaults, disabledRoomKeys),
    ),
    ROOM_OPTIONS_WITH_EXTENSION,
  );
  const selectedAddOns = priceItems(
    mergePackageDefaults(
      parsed.data.addOns,
      disabledSections.has("addOns") ? [] : withoutDisabledDefaults(packageBookingOptions.addOns, disabledAddOnKeys),
    ),
    ADD_ON_OPTIONS,
  );
  const selectedExtensions = priceItems(
    mergePackageDefaults(
      parsed.data.extensionSelections,
      disabledSections.has("extensions") ? [] : withoutDisabledDefaults(packageBookingOptions.extensions, disabledExtensionKeys),
    ),
    EXTENSION_OPTIONS,
  );
  const selectedCorkage = priceItems(
    mergePackageDefaults(
      parsed.data.corkageSelections,
      disabledSections.has("corkage") ? [] : withoutDisabledDefaults(packageBookingOptions.corkage, disabledCorkageKeys),
    ),
    CORKAGE_OPTIONS,
  );
  const roomsTotal = sumItems(selectedRooms);
  const addOnsTotal = sumItems(selectedAddOns);
  const extensionsTotal = sumItems(selectedExtensions);
  const corkageTotal = sumItems(selectedCorkage);
  // Frontend totals are estimates only. Every unit rate and balance stored below
  // is recalculated from server-owned package and optional-extra prices.
  const packagePrice = Number(managedPackage.price) || 0;
  const computedTotal = packagePrice + roomsTotal + addOnsTotal + extensionsTotal + corkageTotal;
  const computedMinimumPayment = computedTotal * 0.5;
  const computedRemainingBalance = computedTotal - computedMinimumPayment;
  const estimateSummary = {
    packageBase: packagePrice,
    rooms: roomsTotal,
    addOns: addOnsTotal,
    extensions: extensionsTotal,
    corkage: corkageTotal,
    total: computedTotal,
    minimumPayment: computedMinimumPayment,
    remainingBalance: computedRemainingBalance,
  };

  // The booking INSERT trigger resolves every package venue and reserves them atomically.
  const { data: newBooking, error: insertError } = await db
    .from("bookings")
    .insert({
      user_id: user.id,
      venue_id: primaryVenueId,
      start_date: startDate,
      end_date: endDate,
      event_date: eventDate ?? null,
      start_datetime: startDateTime,
      end_datetime: endDateTime,
      event_type: eventType ?? null,
      package_id: managedPackage.id,
      package_type: packageType,
      package_price: packagePrice,
      pax: pax ?? null,
      full_name: fullName ?? null,
      email: email ?? null,
      phone: phone ?? null,
      email_notifications_enabled: emailNotificationsEnabled,
      sms_notifications_enabled: smsNotificationsEnabled,
      special_requests: specialRequests ?? null,
      total_price: computedTotal,
      status: "pending",
      quotation_status: "not_required",
      quotation_finalized_at: null,
      reservation_created_at: now,
      reservation_expires_at: reservationExpiresAt,
      reservation_expired_at: null,
      created_at: now,
      updated_at: now,
      address: parsed.data.address ?? null,
      caterer: parsed.data.useWoodberryCaterer ? "Woodberry's Caterer" : parsed.data.caterer ?? null,
      use_woodberry_caterer: parsed.data.useWoodberryCaterer ?? false,
      package_inclusions: {
        packageName,
        included: packageIncluded.length > 0 ? packageIncluded : fallbackPackage?.inclusions ?? [],
      },
      rooms_count: fallbackPackage?.includedRooms ?? null,
      selected_rooms: selectedRooms,
      facility_time_ranges: null,
      additionals: null,
      add_ons: selectedAddOns,
      extension_selections: selectedExtensions,
      corkage_selections: selectedCorkage,
      estimate_summary: estimateSummary,
      minimum_payment_amount: computedMinimumPayment,
      remaining_balance_amount: computedRemainingBalance,
      terms_accepted_at: parsed.data.termsAccepted ? now : null,
    })
    .select("id, reservation_expires_at")
    .single();

  if (insertError) return reservationInsertError(insertError);

  try {
    await notifyBookingSubmitted(newBooking.id, db);
  } catch (notificationError) {
    console.error("[CreateBookings] Submission notification failed", {
      bookingId: newBooking.id,
      error:
        notificationError instanceof Error
          ? notificationError.message
          : "Submission notification failed",
    });
  }

  return created({
    bookingId: newBooking.id,
    bookingType: packageType,
    totalPrice: computedTotal,
    minimumPaymentAmount: computedMinimumPayment,
    remainingBalanceAmount: computedRemainingBalance,
    paymentAvailable: true,
    reservationExpiresAt: newBooking.reservation_expires_at,
    message:
      `Your reservation is temporarily held until ${new Date(newBooking.reservation_expires_at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" })}. Complete the required down payment of ${computedMinimumPayment.toLocaleString("en-PH", { style: "currency", currency: "PHP" })} to secure your booking. You can pay now or from My Bookings before the deadline. We will send booking updates by ${notificationPreferenceLabel}.`,
  });
};
