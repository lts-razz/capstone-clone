// GET /api/venues/:id — single venue (public) | PUT — update | DELETE — deactivate (admin)
import type { APIRoute } from "astro";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
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

function compactVenueInput(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export const GET: APIRoute = async ({ params }) => {
  const { id } = params;
  if (!id) return error("Missing venue id", 400);

  const { data: venue, error: dbError } = await supabase
    .from("venues")
    .select("*")
    .eq("id", id)
    .single();

  if (dbError || !venue) return error("Venue not found", 404);
  return ok({ venue });
};

export const PUT: APIRoute = async ({ request, cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const { id } = params;
  if (!id) return error("Missing venue id", 400);

  const contentType = request.headers.get("content-type") ?? "";
  let venueInput: unknown;

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (formError) {
      console.error("[VenueUpdate] failed to parse multipart form data", formError);
      return error("Invalid form submission: the multipart form data could not be read.", 400);
    }

    const image = formData.get("image");
    const imageFile = image instanceof File ? image : null;
    const imageError = validateVenueImage(imageFile, false);
    if (imageError) return error(imageError, 400);

    let imageUrl = formValue(formData, "image_url").trim() || undefined;
    if (imageFile && imageFile.size > 0) {
      try {
        const upload = await uploadVenueImage(VENUE_IMAGE_BUCKET, "venues", imageFile);
        imageUrl = upload.publicUrl;
      } catch (uploadError) {
        console.error("[VenueUpdate] image upload failed", uploadError);
        const storageResponse = venueImageStorageErrorResponse(uploadError);
        return error(storageResponse.message, storageResponse.status);
      }
    }

    venueInput = compactVenueInput({
      name: formValue(formData, "name").trim() || undefined,
      description: formValue(formData, "description").trim(),
      location: formValue(formData, "location").trim() || undefined,
      capacity: optionalPositiveNumber(formData, "capacity"),
      price_per_night: optionalPositiveNumber(formData, "price_per_night"),
      image_url: imageUrl,
    });
  } else {
    const body = await parseBody(request);
    if (!body.ok) return body.response;
    venueInput = body.data;
  }

  const parsed = venueSchema.partial().safeParse(venueInput);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }
  if (Object.keys(parsed.data).length === 0) return error("No venue fields provided", 400);

  const { data: venue, error: dbError } = await db
    .from("venues")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);
  return ok({ venue });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const { id } = params;
  if (!id) return error("Missing venue id", 400);

  const { error: dbError } = await db
    .from("venues")
    .update({ is_active: false })
    .eq("id", id);

  if (dbError) return error(dbError.message, 500);
  return ok({ message: "Venue deactivated successfully" });
};
