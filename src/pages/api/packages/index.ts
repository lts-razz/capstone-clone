// GET /api/packages — list active packages (public) | POST — create package (admin)
import type { APIRoute } from "astro";
import { supabase, supabaseAdmin } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, created, error } from "../../../lib/response";
import { packageSchema } from "../../../validation/package";
import { parseBody } from "../../../lib/parseBody";
import type { Database } from "../../../lib/database.types";
import {
  replacePackageVenueAssignments,
  verifyActiveVenueIds,
} from "../../../services/packageAssignments";

export const prerender = false;
const db = supabaseAdmin ?? supabase;

export const GET: APIRoute = async () => {
  const { data, error: dbError } = await supabase
    .from("packages")
    .select("id, name, description, price, inclusions, max_pax, min_pax, duration_label, time_options, included_facilities, rules, booking_options, venue_id, thumbnail_url, is_active")
    .eq("is_active", true)
    .order("price");

  if (dbError) return error(dbError.message, 500);

  const packageIds = (data ?? []).map((pkg) => pkg.id);
  const { data: assignments, error: assignmentError } = packageIds.length > 0
    ? await supabase
        .from("package_venue_assignments")
        .select("package_id, venue_id")
        .in("package_id", packageIds)
    : { data: [], error: null };
  if (assignmentError) return error(assignmentError.message, 500);

  const venueIds = [...new Set((assignments ?? []).map((assignment) => assignment.venue_id))];
  const { data: venues, error: venueError } = venueIds.length > 0
    ? await supabase
        .from("venues")
        .select("id, name, description, capacity, image_url, is_active")
        .in("id", venueIds)
        .eq("is_active", true)
    : { data: [], error: null };
  if (venueError) return error(venueError.message, 500);

  const venueById = new Map((venues ?? []).map((venue) => [venue.id, venue]));
  const venueIdsByPackage = new Map<string, string[]>();
  for (const assignment of assignments ?? []) {
    if (!venueById.has(assignment.venue_id)) continue;
    const ids = venueIdsByPackage.get(assignment.package_id) ?? [];
    ids.push(assignment.venue_id);
    venueIdsByPackage.set(assignment.package_id, ids);
  }

  return ok({
    packages: (data ?? []).map((pkg) => {
      const assignedVenueIds = venueIdsByPackage.get(pkg.id) ?? [];
      return {
        ...pkg,
        venue_ids: assignedVenueIds,
        venues: assignedVenueIds.map((venueId) => venueById.get(venueId)).filter(Boolean),
      };
    }),
  });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = packageSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const {
    venue_ids,
    venue_id,
    price: basePrice,
    ...packageConfiguration
  } = parsed.data;
  const requestedVenueIds = venue_ids ?? (venue_id ? [venue_id] : []);
  const verifiedVenues = await verifyActiveVenueIds(db, requestedVenueIds);
  if (verifiedVenues.error) return error(verifiedVenues.error.message, verifiedVenues.status);

  const insertData = {
    ...packageConfiguration,
    price: basePrice,
    venue_id: verifiedVenues.venueIds[0] ?? null,
  } as Database["public"]["Tables"]["packages"]["Insert"];

  const { data: pkg, error: dbError } = await db
    .from("packages")
    .insert([insertData])
    .select()
    .single();

  if (dbError) return error(dbError.message, 500);

  const assignmentResult = await replacePackageVenueAssignments(db, pkg.id, verifiedVenues.venueIds);
  if (assignmentResult.error) {
    await db.from("packages").delete().eq("id", pkg.id);
    return error("The package could not be saved with its selected venues. Please try again.", 500);
  }

  return created({
    package: { ...pkg, venue_ids: verifiedVenues.venueIds },
  });
};
