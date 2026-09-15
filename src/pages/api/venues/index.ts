// GET /api/venues — list active venues (public) | POST — create venue (admin)
import type { APIRoute } from "astro";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, created, error } from "../../../lib/response";
import { VENUE_IMAGE_BUCKET, validateVenueImage, venueSchema } from "../../../validation/venue";
import { parseBody } from "../../../lib/parseBody";
import {
  uploadVenueImage,
  venueImageStorageErrorResponse,
} from "../../../lib/venueImageStorage";

export const prerender = false;
const db = supabaseAdmin ?? supabase;

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function optionalPositiveNumber(formData: FormData, key: string) {
  const value = formValue(formData, key).trim();
  if (!value) return undefined;
  return Number(value);
}

export const GET: APIRoute = async () => {
  const { data, error: dbError } = await supabase
    .from("venues")
    .select("id, name, description, location, capacity, price_per_night, image_url, is_active")
    .eq("is_active", true)
    .order("name");

  if (dbError) return error(dbError.message, 500);
  return ok({ venues: data ?? [] });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const contentType = request.headers.get("content-type") ?? "";
  let venueInput: unknown;

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError) {
      console.error("[Venues] failed to parse multipart form data", formError);
      return error("Invalid form submission: the multipart form data could not be read.", 400);
    }
    const name = formValue(formData, "name").trim();
    const description = formValue(formData, "description").trim();
    if (!name) return error("name is required", 400);
    if (!description) return error("description is required", 400);

    const image = formData.get("image");
    const imageFile = image instanceof File ? image : null;
    const imageError = validateVenueImage(imageFile, true);
    if (imageError) return error(imageError, 400);

    let imageUrl: string;
    try {
      const upload = await uploadVenueImage(VENUE_IMAGE_BUCKET, "venues", imageFile!);
      imageUrl = upload.publicUrl;
    } catch (uploadError) {
      console.error("[Venues] image upload failed", uploadError);
      const storageResponse = venueImageStorageErrorResponse(uploadError);
      return error(storageResponse.message, storageResponse.status);
    }

    venueInput = {
      name,
      description,
      location: formValue(formData, "location").trim() || "Woodberry Resorts and Events Place",
      capacity: optionalPositiveNumber(formData, "capacity"),
      price_per_night: optionalPositiveNumber(formData, "price_per_night") ?? 1,
      image_url: imageUrl,
    };
  } else {
    const body = await parseBody(request);
    if (!body.ok) return body.response;
    venueInput = body.data;
  }

  const parsed = venueSchema.safeParse(venueInput);
  if (!parsed.success) return error(parsed.error.errors.map((e) => e.message).join(", "), 400);

  const { data: venue, error: dbError } = await db
    .from("venues")
    .insert([{ ...parsed.data, is_active: true }])
    .select()
    .single();

  if (dbError) {
    console.error("[Venues] database insert failed", dbError);
    return error(`Venue image uploaded, but the venue record could not be saved: ${dbError.message}`, 500);
  }
  return created({ venue, message: "Venue added successfully" });
};
