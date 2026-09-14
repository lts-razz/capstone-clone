import { z } from "zod";

export const PACKAGE_VENUE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PACKAGE_VENUE_IMAGE_BUCKET =
  import.meta.env.SUPABASE_PACKAGE_VENUES_BUCKET?.trim() || "package-venues";

export const PACKAGE_VENUE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const packageVenueSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(200),
  description: z.string().trim().min(1, "description is required").max(2000),
  capacity: z.coerce
    .number()
    .int("capacity must be a whole number")
    .positive("capacity must be positive"),
});

export const packageVenueUpdateSchema = packageVenueSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export function validatePackageVenueImage(file: File | null | undefined, required: boolean) {
  if (!file || file.size === 0) {
    return required ? "image is required" : null;
  }

  if (!PACKAGE_VENUE_IMAGE_MIME_TYPES.includes(file.type.toLowerCase() as (typeof PACKAGE_VENUE_IMAGE_MIME_TYPES)[number])) {
    return "Invalid image file. Upload a JPEG, PNG, WebP, or GIF image.";
  }

  if (file.size > PACKAGE_VENUE_IMAGE_MAX_BYTES) {
    return "image must be 5 MB or smaller";
  }

  return null;
}

export type PackageVenueInput = z.infer<typeof packageVenueSchema>;
