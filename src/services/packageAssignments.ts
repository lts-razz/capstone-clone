import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

type DbClient = SupabaseClient<Database>;

export async function verifyActiveVenueIds(client: DbClient, venueIds: string[]) {
  const uniqueVenueIds = [...new Set(venueIds)];
  if (uniqueVenueIds.length === 0) return { venueIds: uniqueVenueIds, error: null, status: 200 };

  const { data, error } = await client
    .from("venues")
    .select("id")
    .in("id", uniqueVenueIds)
    .eq("is_active", true);

  if (error) return { venueIds: uniqueVenueIds, error, status: 500 };
  if ((data ?? []).length !== uniqueVenueIds.length) {
    return {
      venueIds: uniqueVenueIds,
      error: new Error("One or more selected venues are inactive or no longer available."),
      status: 400,
    };
  }

  return { venueIds: uniqueVenueIds, error: null, status: 200 };
}

export async function getPackageVenueIds(client: DbClient, packageId: string) {
  const { data, error } = await client
    .from("package_venue_assignments")
    .select("venue_id, created_at")
    .eq("package_id", packageId)
    .order("created_at", { ascending: true });

  return {
    venueIds: [...new Set((data ?? []).map((assignment) => assignment.venue_id))],
    error,
  };
}

export async function getRequiredPackageVenueIds(
  client: DbClient,
  packageId: string,
  primaryVenueId?: string | null,
) {
  const assignments = await getPackageVenueIds(client, packageId);
  return {
    venueIds: [...new Set([primaryVenueId, ...assignments.venueIds].filter((id): id is string => Boolean(id)))],
    error: assignments.error,
  };
}

export async function replacePackageVenueAssignments(
  client: DbClient,
  packageId: string,
  venueIds: string[],
) {
  const targetVenueIds = [...new Set(venueIds)];
  const { venueIds: currentVenueIds, error: lookupError } = await getPackageVenueIds(client, packageId);
  if (lookupError) return { error: lookupError };

  const additions = targetVenueIds.filter((venueId) => !currentVenueIds.includes(venueId));
  const removals = currentVenueIds.filter((venueId) => !targetVenueIds.includes(venueId));

  if (additions.length > 0) {
    const { error: insertError } = await client
      .from("package_venue_assignments")
      .insert(additions.map((venueId) => ({ package_id: packageId, venue_id: venueId })));
    if (insertError) return { error: insertError };
  }

  if (removals.length > 0) {
    const { error: deleteError } = await client
      .from("package_venue_assignments")
      .delete()
      .eq("package_id", packageId)
      .in("venue_id", removals);

    if (deleteError) {
      if (additions.length > 0) {
        await client
          .from("package_venue_assignments")
          .delete()
          .eq("package_id", packageId)
          .in("venue_id", additions);
      }
      return { error: deleteError };
    }
  }

  return { error: null };
}
