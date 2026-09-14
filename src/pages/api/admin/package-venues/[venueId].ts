import type { APIRoute } from "astro";
import { z } from "zod";
import { adminGuard } from "../../../../lib/adminGuard";
import { error, ok } from "../../../../lib/response";
import { supabase, supabaseAdmin } from "../../../../lib/supabase";
import type { Database } from "../../../../lib/database.types";
import {
  uploadVenueImage,
  venueImageStorageErrorResponse,
} from "../../../../lib/venueImageStorage";
import {
  PACKAGE_VENUE_IMAGE_BUCKET,
  packageVenueUpdateSchema,
  validatePackageVenueImage,
} from "../../../../validation/packageVenue";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const venueIdSchema = z.string().uuid("Invalid package venue id");

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

export const PUT: APIRoute = async ({ cookies, request, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const parsedId = venueIdSchema.safeParse(params.venueId);
  if (!parsedId.success) return error(parsedId.error.issues[0]?.message ?? "Invalid package venue id", 400);
  const venueId = parsedId.data;

  const { data: existingVenue, error: lookupError } = await db
    .from("package_venues")
    .select("id, package_id")
    .eq("id", venueId)
    .maybeSingle();

  if (lookupError) return error(lookupError.message, 500);
  if (!existingVenue) return error("Package venue not found", 404);

  const contentType = request.headers.get("content-type") ?? "";
  let updateData: Database["public"]["Tables"]["package_venues"]["Update"] = {};

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError) {
      console.error("[PackageVenue] failed to parse multipart form data", formError);
      return error("Invalid form submission: the multipart form data could not be read.", 400);
    }
    const parsed = packageVenueUpdateSchema.safeParse({
      name: formValue(formData, "name"),
      description: formValue(formData, "description"),
      capacity: formValue(formData, "capacity"),
    });

    if (!parsed.success) {
      return error(parsed.error.errors.map((issue) => issue.message).join(", "), 400);
    }

    updateData = { ...parsed.data };
    const image = formData.get("image");
    const imageFile = image instanceof File ? image : null;
    const imageError = validatePackageVenueImage(imageFile, false);
    if (imageError) return error(imageError, 400);

    if (imageFile && imageFile.size > 0) {
      try {
        const upload = await uploadVenueImage(
          PACKAGE_VENUE_IMAGE_BUCKET,
          existingVenue.package_id,
          imageFile,
        );
        updateData.image_url = upload.publicUrl;
      } catch (uploadError) {
        console.error("[PackageVenue] image upload failed", uploadError);
        const storageResponse = venueImageStorageErrorResponse(uploadError);
        return error(storageResponse.message, storageResponse.status);
      }
    }
  } else {
    const body = await request.json().catch(() => null);
    const parsed = packageVenueUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return error(parsed.error.errors.map((issue) => issue.message).join(", "), 400);
    }
    updateData = parsed.data;
  }

  if (Object.keys(updateData).length === 0) return error("No package venue fields provided", 400);

  const { data: venue, error: updateError } = await db
    .from("package_venues")
    .update(updateData)
    .eq("id", venueId)
    .select()
    .single();

  if (updateError) {
    console.error("[PackageVenue] database update failed", updateError);
    return error(`Package venue could not be updated: ${updateError.message}`, 500);
  }
  return ok({ venue, message: "Package venue updated successfully" });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const parsedId = venueIdSchema.safeParse(params.venueId);
  if (!parsedId.success) return error(parsedId.error.issues[0]?.message ?? "Invalid package venue id", 400);
  const venueId = parsedId.data;

  const { data: existingVenue, error: lookupError } = await db
    .from("package_venues")
    .select("id, is_active")
    .eq("id", venueId)
    .maybeSingle();

  if (lookupError) return error(lookupError.message, 500);
  if (!existingVenue) return error("Package venue not found", 404);
  if (!existingVenue.is_active) return ok({ message: "Package venue is already inactive" });

  const { data: venue, error: updateError } = await db
    .from("package_venues")
    .update({ is_active: false })
    .eq("id", venueId)
    .select()
    .single();

  if (updateError) return error(updateError.message, 500);
  return ok({ venue, message: "Package venue deactivated successfully" });
};
