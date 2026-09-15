// PUT /api/packages/:id — update package | DELETE — deactivate (admin)
import type { APIRoute } from "astro";
import { z } from "zod";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { packageSchema } from "../../../validation/package";
import { parseBody } from "../../../lib/parseBody";
import type { Database } from "../../../lib/database.types";
import {
  getPackageVenueIds,
  replacePackageVenueAssignments,
  verifyActiveVenueIds,
} from "../../../services/packageAssignments";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const packageIdSchema = z.string().uuid("Invalid package id");

export const PUT: APIRoute = async ({ request, cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const parsedId = packageIdSchema.safeParse(params.id);
  if (!parsedId.success) return error(parsedId.error.issues[0]?.message ?? "Invalid package id", 400);
  const id = parsedId.data;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = packageSchema.partial().safeParse(body.data);
  if (!parsed.success) {
      return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  if (Object.keys(parsed.data).length === 0) return error("No package fields provided", 400);

  const { data: existingPackage, error: lookupError } = await db
    .from("packages")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) return error(lookupError.message, 500);
  if (!existingPackage) return error("Package not found", 404);

  const hasVenueAssignmentUpdate = "venue_ids" in parsed.data || "venue_id" in parsed.data;
  const {
    venue_ids,
    venue_id,
    price: basePrice,
    ...packageConfiguration
  } = parsed.data;
  let nextVenueIds: string[] | null = null;
  let previousVenueIds: string[] = [];

  if (hasVenueAssignmentUpdate) {
    const requestedVenueIds = venue_ids ?? (venue_id ? [venue_id] : []);
    const verifiedVenues = await verifyActiveVenueIds(db, requestedVenueIds);
    if (verifiedVenues.error) return error(verifiedVenues.error.message, verifiedVenues.status);
    nextVenueIds = verifiedVenues.venueIds;

    const previousAssignments = await getPackageVenueIds(db, id);
    if (previousAssignments.error) return error("Could not load the package venue assignments", 500);
    previousVenueIds = previousAssignments.venueIds;

    const assignmentResult = await replacePackageVenueAssignments(db, id, nextVenueIds);
    if (assignmentResult.error) {
      return error("The selected package venues could not be saved. Please try again.", 500);
    }
  }

  const updateFields = {
    ...packageConfiguration,
    ...("price" in parsed.data ? { price: basePrice } : {}),
    ...(nextVenueIds ? { venue_id: nextVenueIds[0] ?? null } : {}),
  } as Database["public"]["Tables"]["packages"]["Update"];

  const { data: pkg, error: dbError } = await db
    .from("packages")
    .update(updateFields)
    .eq("id", id)
    .select()
    .single();

  if (dbError) {
    if (nextVenueIds) await replacePackageVenueAssignments(db, id, previousVenueIds);
    return error(dbError.message, 500);
  }
  const statusChanged = "is_active" in parsed.data && parsed.data.is_active !== existingPackage.is_active;
  return ok({
    package: { ...pkg, ...(nextVenueIds ? { venue_ids: nextVenueIds } : {}) },
    message: statusChanged
      ? (pkg.is_active ? "Package activated successfully" : "Package deactivated successfully")
      : "Package saved successfully",
  });
};

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const parsedId = packageIdSchema.safeParse(params.id);
  if (!parsedId.success) return error(parsedId.error.issues[0]?.message ?? "Invalid package id", 400);
  const id = parsedId.data;

  const { data: existingPackage, error: lookupError } = await db
    .from("packages")
    .select("id, is_active")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) return error(lookupError.message, 500);
  if (!existingPackage) return error("Package not found", 404);
  if (!existingPackage.is_active) {
    return ok({ message: "Package is already inactive" });
  }

  const { data: pkg, error: dbError } = await db
    .from("packages")
    .update({ is_active: false })
    .eq("id", id)
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);
  return ok({ package: pkg, message: "Package deactivated successfully" });
};
