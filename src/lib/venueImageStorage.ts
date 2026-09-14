import { supabaseAdmin } from "./supabase";

export type VenueImageStorageErrorCode =
  | "missing-service-role"
  | "missing-bucket"
  | "storage-permission"
  | "upload-failed"
  | "public-url-failed";

export class VenueImageStorageError extends Error {
  readonly code: VenueImageStorageErrorCode;

  constructor(code: VenueImageStorageErrorCode, message: string) {
    super(message);
    this.name = "VenueImageStorageError";
    this.code = code;
  }
}

const FILE_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function storageErrorDetails(storageError: unknown) {
  if (!storageError || typeof storageError !== "object") {
    return { message: String(storageError ?? "Unknown Supabase Storage error"), statusCode: undefined };
  }

  const value = storageError as { message?: unknown; statusCode?: unknown; status?: unknown };
  const rawStatus = value.statusCode ?? value.status;
  const statusCode = typeof rawStatus === "number" ? rawStatus : Number(rawStatus);

  return {
    message: typeof value.message === "string" ? value.message : "Unknown Supabase Storage error",
    statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
  };
}

function isPermissionFailure(message: string, statusCode?: number) {
  const normalized = message.toLowerCase();
  return (
    statusCode === 401 ||
    statusCode === 403 ||
    normalized.includes("permission") ||
    normalized.includes("not authorized") ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("invalid compact jws") ||
    normalized.includes("api key") ||
    normalized.includes("row-level security") ||
    normalized.includes("policy")
  );
}

function isMissingBucket(message: string, statusCode?: number) {
  const normalized = message.toLowerCase();
  return (
    statusCode === 404 ||
    normalized.includes("bucket not found") ||
    (normalized.includes("bucket") && normalized.includes("does not exist"))
  );
}

function uniqueImagePath(scope: string, file: File) {
  const safeScope = scope.replace(/[^a-zA-Z0-9_-]/g, "-");
  const extension = FILE_EXTENSION_BY_MIME_TYPE[file.type.toLowerCase()] ?? "jpg";
  const uniqueId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${safeScope}/${uniqueId}.${extension}`;
}

export function venueImageStorageErrorResponse(storageError: unknown) {
  if (storageError instanceof VenueImageStorageError) {
    const status = storageError.code === "missing-bucket" ? 503 : 500;
    return { message: storageError.message, status };
  }

  return {
    message: "Venue image upload failed in Supabase Storage. Please try again.",
    status: 500,
  };
}

export async function uploadVenueImage(bucket: string, scope: string, file: File) {
  if (!supabaseAdmin) {
    throw new VenueImageStorageError(
      "missing-service-role",
      "Venue image storage is not configured: SUPABASE_SERVICE_ROLE_KEY is missing.",
    );
  }

  const { data: bucketDetails, error: bucketError } = await supabaseAdmin.storage.getBucket(bucket);
  if (bucketError || !bucketDetails) {
    const details = storageErrorDetails(bucketError);
    if (isPermissionFailure(details.message, details.statusCode)) {
      throw new VenueImageStorageError(
        "storage-permission",
        "Supabase Storage permission failed. Verify SUPABASE_SERVICE_ROLE_KEY and its Storage access.",
      );
    }

    if (isMissingBucket(details.message, details.statusCode)) {
      throw new VenueImageStorageError(
        "missing-bucket",
        `Supabase Storage bucket "${bucket}" is missing. Apply the package venue storage migration or create the bucket before uploading.`,
      );
    }

    throw new VenueImageStorageError(
      "upload-failed",
      `Supabase Storage could not verify bucket "${bucket}": ${details.message}`,
    );
  }

  if (!bucketDetails.public) {
    throw new VenueImageStorageError(
      "public-url-failed",
      `Failed to generate a usable public image URL because Supabase Storage bucket "${bucket}" is not public.`,
    );
  }

  const path = uniqueImagePath(scope, file);
  const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    const details = storageErrorDetails(uploadError);
    if (isPermissionFailure(details.message, details.statusCode)) {
      throw new VenueImageStorageError(
        "storage-permission",
        "Supabase Storage permission failed while uploading the venue image. Verify the service-role key and bucket permissions.",
      );
    }

    throw new VenueImageStorageError(
      "upload-failed",
      `Supabase Storage could not upload the venue image: ${details.message}`,
    );
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  const publicUrl = publicUrlData?.publicUrl?.trim();

  try {
    const parsedUrl = new URL(publicUrl ?? "");
    if (!publicUrl || (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:")) {
      throw new Error("Invalid public URL");
    }
  } catch {
    throw new VenueImageStorageError(
      "public-url-failed",
      "Supabase Storage uploaded the image but failed to generate a valid public URL. Confirm that the bucket is public.",
    );
  }

  return { path, publicUrl };
}
