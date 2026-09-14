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

  const { data: existingBooking, error: bookingLookupError } = await db
    .from("bookings")
    .select("id")
    .eq("venue_id", venueId)
    .limit(1)
    .maybeSingle();

  if (bookingLookupError) return error("Could not safely check existing venue bookings", 500);

  const { data: referencedPackages, error: packageLookupError } = await db
    .from("packages")
    .select("id")
    .eq("venue_id", venueId);

  let packageRelationshipWarning: string | undefined;
  let detachedPackageIds: string[] = [];

  if (packageLookupError) {
    logDatabaseError("[AdminVenueDelete] package assignment lookup failed", packageLookupError, { venueId });

    if (isMissingPackageVenueRelationship(packageLookupError)) {
      packageRelationshipWarning =
        "Package assignments could not be checked because the package-to-venue relationship is not available.";
    } else {
      return error("Could not check package assignments for this venue. The venue was not deleted. Please try again.", 500);
    }
  } else {
    const referencedPackageIds = (referencedPackages ?? []).map((pkg) => pkg.id);

    if (referencedPackageIds.length > 0) {
      const { data: detachedPackages, error: detachError } = await db
        .from("packages")
        .update({ venue_id: null })
        .in("id", referencedPackageIds)
        .select("id");

      if (detachError) {
        logDatabaseError("[AdminVenueDelete] package detach failed", detachError, {
          venueId,
          packageIds: referencedPackageIds,
        });
        return error(
          "This venue is assigned to one or more packages, but those assignments could not be removed. The venue was not deleted. Please try again.",
          500,
        );
      }

      detachedPackageIds = (detachedPackages ?? []).map((pkg) => pkg.id);
      if (detachedPackageIds.length !== referencedPackageIds.length) {
        console.error("[AdminVenueDelete] package detach returned an unexpected number of packages", {
          venueId,
          expectedPackageIds: referencedPackageIds,
          detachedPackageIds,
        });
        if (detachedPackageIds.length > 0) {
          const { error: rollbackError } = await db
            .from("packages")
            .update({ venue_id: venueId })
            .in("id", detachedPackageIds);
          if (rollbackError) {
            logDatabaseError("[AdminVenueDelete] incomplete package detach rollback failed", rollbackError, {
              venueId,
              packageIds: detachedPackageIds,
            });
          }
        }
        return error(
          "Some package assignments could not be removed safely. The venue was not deleted. Please try again.",
          500,
        );
      }
    }
  }

  const { error: deactivateError } = await db
    .from("venues")
    .update({ is_active: false })
    .eq("id", venueId);

  if (deactivateError) {
    if (detachedPackageIds.length > 0) {
      const { error: rollbackError } = await db
        .from("packages")
        .update({ venue_id: venueId })
        .in("id", detachedPackageIds);
      if (rollbackError) {
        console.error("[AdminVenueDelete] package detach rollback failed:", rollbackError.message);
      }
    }
    return error("Could not delete the venue. Please try again.", 500);
  }

  let warning = packageRelationshipWarning;
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
      } else {
        const { error: clearImageError } = await db
          .from("venues")
          .update({ image_url: null })
          .eq("id", venueId);
        if (clearImageError) {
          console.error("[AdminVenueDelete] could not clear the archived image URL:", clearImageError.message);
        }
      }
    }
  }

  const detachedPackageCount = detachedPackageIds.length;
  const packageSummary = packageRelationshipWarning
    ? ""
    : detachedPackageCount === 0
      ? " No package assignments needed updating."
      : detachedPackageCount === 1
        ? " 1 package was updated."
        : ` ${detachedPackageCount} packages were updated.`;
  const bookingSummary = existingBooking
    ? " Existing bookings keep the archived venue details."
    : "";

  return ok({
    message: `${venue.name} removed successfully.${packageSummary}${bookingSummary}`,
    warning,
    detachedPackageCount,
    archivedForBookings: Boolean(existingBooking),
  });
};
