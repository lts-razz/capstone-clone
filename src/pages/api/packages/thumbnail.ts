import type { APIRoute } from "astro";
import { adminGuard } from "../../../lib/adminGuard";
import { error, ok } from "../../../lib/response";
import {
  uploadVenueImage,
  venueImageStorageErrorResponse,
} from "../../../lib/venueImageStorage";
import { VENUE_IMAGE_BUCKET, validateVenueImage } from "../../../validation/venue";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, request }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  if (!(request.headers.get("content-type") ?? "").toLowerCase().includes("multipart/form-data")) {
    return error("Expected a multipart image upload.", 400);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return error("The thumbnail upload could not be read.", 400);
  }

  const image = formData.get("image");
  const imageFile = image instanceof File ? image : null;
  const imageError = validateVenueImage(imageFile, true);
  if (imageError) return error(imageError, 400);

  try {
    const upload = await uploadVenueImage(VENUE_IMAGE_BUCKET, "package-thumbnails", imageFile!);
    return ok({ thumbnailUrl: upload.publicUrl });
  } catch (uploadError) {
    console.error("[PackageThumbnail] upload failed", uploadError);
    const storageResponse = venueImageStorageErrorResponse(uploadError);
    return error(storageResponse.message.replace(/venue image/gi, "package thumbnail"), storageResponse.status);
  }
};
