import { z } from "zod";

export const VENUE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VENUE_IMAGE_BUCKET =
  import.meta.env.SUPABASE_PACKAGE_VENUES_BUCKET?.trim() || "package-venues";

export const VENUE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/**
 * POST /api/venues  (admin — create)
 * PUT  /api/venues/:id  (admin — update, all fields optional)
 */
export const venueSchema = z.object({
  name:            z.string().min(1, "name is required").max(200),
  description:     z.string().max(2000).optional(),
  location:        z.string().max(300).optional(),
  capacity:        z.number().int().positive("capacity must be positive").optional(),
  price_per_night: z.number().positive("price_per_night must be positive"),
  image_url:       z.string().url("image_url must be a valid URL").optional().or(z.literal("")),
});

export function validateVenueImage(file: File | null | undefined, required: boolean) {
  if (!file || file.size === 0) {
    return required ? "image is required" : null;
  }

  if (!VENUE_IMAGE_MIME_TYPES.includes(file.type.toLowerCase() as (typeof VENUE_IMAGE_MIME_TYPES)[number])) {
    return "Invalid image file. Upload a JPEG, PNG, WebP, or GIF image.";
  }

  if (file.size > VENUE_IMAGE_MAX_BYTES) {
    return "image must be 5 MB or smaller";
  }

  return null;
}

export type VenueInput = z.infer<typeof venueSchema>;
