import type { APIRoute } from "astro";
import { z } from "zod";
import { adminGuard } from "../../../../lib/adminGuard";
import { error, ok } from "../../../../lib/response";
import { supabase, supabaseAdmin } from "../../../../lib/supabase";
import { VENUE_IMAGE_BUCKET } from "../../../../validation/venue";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const venueIdSchema = z.string().uuid("Invalid venue id");

type DatabaseError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

function logDatabaseError(message: string, databaseError: DatabaseError, context: Record<string, unknown>) {
  console.error(message, {
    ...context,
    code: databaseError.code,
    message: databaseError.message,
    details: databaseError.details,
    hint: databaseError.hint,
  });
}

function isMissingPackageVenueRelationship(databaseError: DatabaseError): boolean {
  const code = databaseError.code ?? "";
  const description = [databaseError.message, databaseError.details, databaseError.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (code === "42703" || code === "PGRST204") {
    return description.includes("venue_id");
  }

  if (code === "42P01" || code === "PGRST205") {
    return description.includes("packages");
  }

  return (
    description.includes("venue_id")
    && (description.includes("does not exist") || description.includes("schema cache"))
  ) || (
    description.includes("packages")
    && description.includes("does not exist")
  );
}

function safelyKnownVenueImagePath(imageUrl: string | null): string | null {
  if (!imageUrl) return null;

  try {
    const url = new URL(imageUrl);
    const prefix = `/storage/v1/object/public/${VENUE_IMAGE_BUCKET}/`;
    if (!url.pathname.startsWith(prefix)) return null;

    const path = url.pathname
      .slice(prefix.length)
      .split("/")
      .map((part) => decodeURIComponent(part))
      .join("/");

    return /^venues\/[a-zA-Z0-9-]+\.(?:jpe?g|png|webp|gif)$/i.test(path) ? path : null;
  } catch {
    return null;
  }
}

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const parsedId = venueIdSchema.safeParse(params.id);
  if (!parsedId.success) return error(parsedId.error.issues[0]?.message ?? "Invalid venue id", 400);
  const venueId = parsedId.data;

  const { data: venue, error: venueLookupError } = await db
    .from("venues")
    .select("id, name, image_url, is_active")
    .eq("id", venueId)
    .maybeSingle();

  if (venueLookupError) return error("Could not check the venue before deletion", 500);
  if (!venue) return error("Venue not found", 404);

  const { data: legacyBooking, error: bookingLookupError } = await db
    .from("bookings")
    .select("id")
    .eq("venue_id", venueId)
    .limit(1)
    .maybeSingle();

  if (bookingLookupError) return error("Could not safely check existing venue bookings", 500);
  if (legacyBooking) {
    return error(
      "This venue is used by existing bookings and cannot be deleted. Deactivate it instead to hide it from new bookings.",
      409,
    );
  }

  const { data: assignedBooking, error: assignmentLookupError } = await db
    .from("booking_venue_assignments")
    .select("id")
    .eq("venue_id", venueId)
    .limit(1)
    .maybeSingle();

  if (assignmentLookupError) return error("Could not safely check existing venue booking assignments", 500);
  if (assignedBooking) {
    return error(
      "This venue is used by existing bookings and cannot be deleted. Deactivate it instead to hide it from new bookings.",
      409,
    );
  }

  const { error: assignmentDeleteError } = await db
    .from("package_venue_assignments")
    .delete()
    .eq("venue_id", venueId);

  if (assignmentDeleteError) {
    logDatabaseError("[AdminVenueDelete] package assignment delete failed", assignmentDeleteError, { venueId });
    if (!isMissingPackageVenueRelationship(assignmentDeleteError)) {
      return error("Could not remove package assignments for this venue. The venue was not deleted.", 500);
    }
  }

  const { error: packageDetachError } = await db
    .from("packages")
    .update({ venue_id: null })
    .eq("venue_id", venueId);

  if (packageDetachError) {
    return error("Could not detach this venue from packages. The venue was not deleted.", 500);
  }

  const { error: blockedDateDeleteError } = await db
    .from("blocked_dates")
    .delete()
    .eq("venue_id", venueId);

  if (blockedDateDeleteError) {
    return error("Could not remove blocked-date records for this venue. The venue was not deleted.", 500);
  }

  const { error: deleteError } = await db
    .from("venues")
    .delete()
    .eq("id", venueId);

  if (deleteError) return error("Could not delete the venue. Please try again.", 500);

  let warning: string | undefined;
  const imagePath = safelyKnownVenueImagePath(venue.image_url);
  if (imagePath) {
    if (!supabaseAdmin) {
      warning = [warning, "Its image could not be cleaned up."].filter(Boolean).join(" ");
      console.warn("[AdminVenueDelete] image cleanup skipped because the service-role client is unavailable");
    } else {
      const { error: imageDeleteError } = await supabaseAdmin.storage
        .from(VENUE_IMAGE_BUCKET)
        .remove([imagePath]);

      if (imageDeleteError) {
        warning = [warning, "Its image could not be cleaned up."].filter(Boolean).join(" ");
        console.error("[AdminVenueDelete] image cleanup failed:", imageDeleteError.message);
      }
    }
  }

  return ok({
    message: `${venue.name} deleted successfully`,
    warning,
  });
};
