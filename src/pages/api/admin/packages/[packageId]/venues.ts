import type { APIRoute } from "astro";
import { z } from "zod";
import { adminGuard } from "../../../../../lib/adminGuard";
import { created, error } from "../../../../../lib/response";
import { supabase, supabaseAdmin } from "../../../../../lib/supabase";
import {
  uploadVenueImage,
  venueImageStorageErrorResponse,
} from "../../../../../lib/venueImageStorage";
import {
  PACKAGE_VENUE_IMAGE_BUCKET,
  packageVenueSchema,
  validatePackageVenueImage,
} from "../../../../../validation/packageVenue";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const packageIdSchema = z.string().uuid("Invalid package id");

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export const POST: APIRoute = async ({ cookies, request, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const parsedId = packageIdSchema.safeParse(params.packageId);
  if (!parsedId.success) return error(parsedId.error.issues[0]?.message ?? "Invalid package id", 400);
  const packageId = parsedId.data;

  const { data: pkg, error: packageError } = await db
    .from("packages")
    .select("id")
    .eq("id", packageId)
    .maybeSingle();

  if (packageError) return error(packageError.message, 500);
  if (!pkg) return error("Package not found", 404);

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return error("Invalid form submission: expected multipart/form-data with an image file.", 400);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (formError) {
    console.error("[PackageVenue] failed to parse multipart form data", formError);
    return error("Invalid form submission: the multipart form data could not be read.", 400);
  }
  const parsed = packageVenueSchema.safeParse({
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    capacity: formValue(formData, "capacity"),
  });

  if (!parsed.success) {
    return error(parsed.error.errors.map((issue) => issue.message).join(", "), 400);
  }

  const image = formData.get("image");
  const imageFile = image instanceof File ? image : null;
  const imageError = validatePackageVenueImage(imageFile, true);
  if (imageError) return error(imageError, 400);

  let imageUrl: string;
  try {
    const upload = await uploadVenueImage(PACKAGE_VENUE_IMAGE_BUCKET, packageId, imageFile!);
    imageUrl = upload.publicUrl;
  } catch (uploadError) {
    console.error("[PackageVenue] image upload failed", uploadError);
    const storageResponse = venueImageStorageErrorResponse(uploadError);
    return error(storageResponse.message, storageResponse.status);
  }

  const { data: venue, error: insertError } = await db
    .from("package_venues")
    .insert({
      package_id: packageId,
      name: parsed.data.name,
      description: parsed.data.description,
      capacity: parsed.data.capacity,
      image_url: imageUrl,
      is_active: true,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[PackageVenue] database insert failed", insertError);
    return error(`Venue image uploaded, but the venue record could not be saved: ${insertError.message}`, 500);
  }
  return created({ venue, message: "Venue added to package successfully" });
};
