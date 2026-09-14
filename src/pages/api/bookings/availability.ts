// GET /api/bookings/availability — returns booked date ranges for the calendar (public)
import type { APIRoute } from "astro";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { ok, error } from "../../../lib/response";
import { normalizeBookingStatus } from "../../../lib/bookingStatus";
import {
    ADVANCE_BOOKING_DAYS,
    getMinimumBookingDateValue,
    formatDateOnly,
    isOnOrAfterMinimumBookingDate,
} from "../../../lib/bookingDateRules";
import { getAvailabilityRanges, getUnavailableVenueIdsForRange } from "../../../services/bookingAvailability";
import { getRequiredPackageVenueIds, verifyActiveVenueIds } from "../../../services/packageAssignments";
import { getAllVenues } from "../../../services/venues";

export const prerender = false;

const db = supabaseAdmin ?? supabase;

export const GET: APIRoute = async ({ url }) => {
    const requestedYear = parseInt(
        url.searchParams.get("year") ?? String(new Date().getFullYear()),
    );
    const requestedMonth = parseInt(
        url.searchParams.get("month") ?? String(new Date().getMonth() + 1),
    ); // 1-12
    const today = new Date();
    const year = Number.isFinite(requestedYear) ? requestedYear : today.getFullYear();
    const month =
        Number.isFinite(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12
            ? requestedMonth
            : today.getMonth() + 1;
    const venueId = url.searchParams.get("venueId")?.trim() || null;
    const packageId = url.searchParams.get("packageId")?.trim() || null;
    const requestedStartDate = url.searchParams.get("startDate")?.trim() || null;
    const requestedEndDate = url.searchParams.get("endDate")?.trim() || requestedStartDate;
    const includeVenues = url.searchParams.get("includeVenues") === "1";
    let venueIds: string[] | undefined;

    if (includeVenues) {
        if (!requestedStartDate || !requestedEndDate) {
            return error("Choose a booking date before checking venue availability.", 400);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedStartDate) || !/^\d{4}-\d{2}-\d{2}$/.test(requestedEndDate)) {
            return error("Please choose valid booking dates.", 400);
        }
        if (requestedEndDate < requestedStartDate) {
            return error("The end date must be on or after the start date.", 400);
        }
        if (!isOnOrAfterMinimumBookingDate(requestedStartDate)) {
            return error("Bookings must be made at least 1 week in advance.", 400);
        }

        const { data: venues, error: venueError } = await getAllVenues(db);
        if (venueError) return error("Could not load venue availability.", 500);

        const activeVenues = venues ?? [];
        const activeVenueIds = activeVenues.map((venue) => venue.id);
        const unavailable = activeVenueIds.length > 0
            ? await getUnavailableVenueIdsForRange(db, {
                venueIds: activeVenueIds,
                startDate: requestedStartDate,
                endDate: requestedEndDate,
            })
            : { venueIds: [], error: null };

        if (unavailable.error) return error("Could not verify venue availability.", 500);

        const unavailableSet = new Set(unavailable.venueIds);
        return ok({
            venues: activeVenues.map((venue) => ({
                id: venue.id,
                name: venue.name,
                description: venue.description,
                location: venue.location,
                capacity: venue.capacity,
                image_url: venue.image_url,
                isAvailable: !unavailableSet.has(venue.id),
            })),
            unavailableVenueIds: unavailable.venueIds,
            minimumBookingDate: getMinimumBookingDateValue(),
            advanceBookingDays: ADVANCE_BOOKING_DAYS,
            startDate: requestedStartDate,
            endDate: requestedEndDate,
        });
    }

    if (packageId) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packageId)) {
            return error("Invalid package id.", 400);
        }
        const { data: packageRow, error: packageError } = await db
            .from("packages")
            .select("venue_id, is_active")
            .eq("id", packageId)
            .maybeSingle();
        if (packageError) return error("Could not load the package venue.", 500);
        if (!packageRow) return error("Package not found.", 404);
        if (!packageRow.is_active) return error("This package is not currently available for booking.", 400);

        const packageVenues = await getRequiredPackageVenueIds(db, packageId, packageRow.venue_id);
        if (packageVenues.error) return error("Could not load the package venues.", 500);
        if (packageVenues.venueIds.length === 0) {
            return error("This package does not have an assigned venue and cannot be booked.", 400);
        }
        const activeVenues = await verifyActiveVenueIds(db, packageVenues.venueIds);
        if (activeVenues.error) {
            return error(
                activeVenues.status === 500 ? "Could not verify package availability." : "This package is not currently available for booking.",
                activeVenues.status,
            );
        }
        venueIds = packageVenues.venueIds;
    }

    const startOfMonth = formatDateOnly(new Date(year, month - 1, 1));
    const endOfMonth = formatDateOnly(new Date(year, month, 0));

    const availability = await getAvailabilityRanges(db, {
        venueId: packageId ? null : venueId,
        venueIds,
        startDate: startOfMonth,
        endDate: endOfMonth,
    });

    if (availability.error) {
        return error(availability.error.message, 500);
    }

    return ok({
        bookings: availability.bookings.map((booking: { status: string; [key: string]: unknown }) => ({
            ...booking,
            status: normalizeBookingStatus(booking.status),
        })),
        blockedDates: availability.blockedDates,
        minimumBookingDate: getMinimumBookingDateValue(),
        advanceBookingDays: ADVANCE_BOOKING_DAYS,
        year,
        month,
        venueId,
        venueIds: venueIds ?? (venueId ? [venueId] : []),
        packageId,
    });
};
