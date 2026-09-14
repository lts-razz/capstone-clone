import type { APIRoute } from "astro";
import { z } from "zod";
import { adminGuard } from "../../../../lib/adminGuard";
import { error, ok } from "../../../../lib/response";
import { supabase, supabaseAdmin } from "../../../../lib/supabase";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const packageIdSchema = z.string().uuid("Invalid package id");

export const DELETE: APIRoute = async ({ cookies, params }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const parsedId = packageIdSchema.safeParse(params.id);
  if (!parsedId.success) return error(parsedId.error.issues[0]?.message ?? "Invalid package id", 400);
  const packageId = parsedId.data;

  const { data: pkg, error: packageLookupError } = await db
    .from("packages")
    .select("id, name")
    .eq("id", packageId)
    .maybeSingle();

  if (packageLookupError) return error(packageLookupError.message, 500);
  if (!pkg) return error("Package not found", 404);

  const { data: existingBooking, error: bookingLookupError } = await db
    .from("bookings")
    .select("id")
    .eq("package_id", packageId)
    .limit(1)
    .maybeSingle();

  if (bookingLookupError) return error(bookingLookupError.message, 500);
  if (existingBooking) {
    return error(
      "This package is used by existing bookings and cannot be deleted. Deactivate it instead to hide it from customers.",
      409,
    );
  }

  const { error: deleteError } = await db
    .from("packages")
    .delete()
    .eq("id", packageId);

  if (deleteError) return error(deleteError.message, 500);
  return ok({ message: `${pkg.name} deleted successfully` });
};
