// POST /api/admin/users - manage admin and staff roles
import type { APIRoute } from "astro";
import { z } from "zod";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const VALID_ACTIONS = ["promote", "demote", "promote_staff", "demote_staff"] as const;
const accountDetailsSchema = z.object({
  userId: z.string().uuid("Invalid account"),
  role: z.enum(["admin", "customer"]),
  email: z.string().trim().email("Enter a valid email address"),
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: z.string().trim().max(30).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
});
const accountDeleteSchema = z.object({
  userId: z.string().uuid("Invalid account"),
  role: z.enum(["admin", "customer"]),
  confirmedSensitiveAction: z.literal(true, {
    errorMap: () => ({ message: "Explicit confirmation is required before deleting accounts" }),
  }),
});

async function countUserReferences(table: string, column: string, userId: string) {
  const { count, error: countError } = await (db as any)
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, userId);

  return { count: count ?? 0, error: countError as { message?: string } | null };
}

async function preservedHistoryForUser(userId: string) {
  const checks = [
    { label: "booking", table: "bookings", column: "user_id" },
    { label: "reschedule request", table: "booking_reschedule_requests", column: "user_id" },
    { label: "payment", table: "payments", column: "user_id" },
    { label: "payment transaction", table: "payment_transactions", column: "user_id" },
    { label: "review", table: "reviews", column: "user_id" },
  ];
  const retained: string[] = [];

  for (const check of checks) {
    const result = await countUserReferences(check.table, check.column, userId);
    if (result.error) return { error: result.error.message ?? "Could not verify account history" };
    if (result.count > 0) retained.push(`${result.count} ${check.label}${result.count === 1 ? "" : "s"}`);
  }

  return { retained };
}

async function deleteAuthAccount(userId: string) {
  if (!supabaseAdmin) return { error: "Account deletion is not configured on this server" };
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId, false);
  return { error: authError?.message };
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody<{ userId?: string; action?: string }>(request);
  if (!body.ok) return body.response;

  const { userId, action } = body.data;
  if (!userId) return error("userId is required", 400);
  if (!action || !VALID_ACTIONS.includes(action as (typeof VALID_ACTIONS)[number])) {
    return error(`action must be one of: ${VALID_ACTIONS.join(", ")}`, 400);
  }

  if (action === "promote") {
    const { data: customer } = await db
      .from("customers")
      .select("id, email, first_name, last_name")
      .eq("id", userId)
      .single();

    if (!customer) return error("Customer not found", 404);

    const { error: insertErr } = await db.from("admins").insert({
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
    });
    if (insertErr) return error(insertErr.message, 500);

    await db.from("employees").update({ is_active: false }).eq("id", userId);
    await db.from("customers").delete().eq("id", userId);
    return ok({ message: "User promoted to admin" });
  }

  if (action === "promote_staff") {
    const { data: customer } = await db
      .from("customers")
      .select("id, email, first_name, last_name, phone")
      .eq("id", userId)
      .single();

    if (!customer) return error("Customer not found", 404);

    const { error: insertErr } = await db.from("employees").upsert({
      id: customer.id,
      email: customer.email,
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: customer.phone,
      position: "Staff",
      is_active: true,
    });
    if (insertErr) return error(insertErr.message, 500);

    await db.from("customers").delete().eq("id", userId);
    return ok({ message: "User promoted to staff" });
  }

  if (action === "demote_staff") {
    const { data: employee } = await db
      .from("employees")
      .select("id, email, first_name, last_name, phone")
      .eq("id", userId)
      .single();

    if (!employee) return error("Staff member not found", 404);

    const { error: insertErr } = await db.from("customers").upsert({
      id: employee.id,
      email: employee.email,
      first_name: employee.first_name,
      last_name: employee.last_name,
      phone: employee.phone,
    });
    if (insertErr) return error(insertErr.message, 500);

    await db.from("employees").update({ is_active: false }).eq("id", userId);
    return ok({ message: "Staff member demoted to customer" });
  }

  const { data: admin } = await db
    .from("admins")
    .select("id, email, first_name, last_name")
    .eq("id", userId)
    .single();

  if (!admin) return error("Admin not found", 404);

  if (userId === guard.user.id) {
    return error("You cannot demote yourself", 400);
  }

  const { error: insertErr } = await db.from("customers").upsert({
    id: admin.id,
    email: admin.email,
    first_name: admin.first_name,
    last_name: admin.last_name,
  });
  if (insertErr) return error(insertErr.message, 500);

  await db.from("admins").delete().eq("id", userId);
  return ok({ message: "Admin demoted to customer" });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;
  if (!supabaseAdmin) return error("Account management is not configured on this server", 503);

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = accountDetailsSchema.safeParse(body.data);
  if (!parsed.success) return error(parsed.error.issues.map((issue) => issue.message).join(", "), 400);

  const { userId, role, email, firstName, lastName, phone, address } = parsed.data;
  const table = role === "admin" ? "admins" : "customers";
  const { data: existing } = await supabaseAdmin
    .from(table)
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();

  if (!existing) return error(role === "admin" ? "Admin not found" : "Customer not found", 404);

  const authUpdate: Parameters<typeof supabaseAdmin.auth.admin.updateUserById>[1] = {
    email,
    email_confirm: true,
    user_metadata: { first_name: firstName, last_name: lastName },
  };
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);
  if (authError) return error(authError.message, 400);

  const updateData = role === "admin"
    ? { email, first_name: firstName, last_name: lastName }
    : { email, first_name: firstName, last_name: lastName, phone: phone || null, address: address || null };
  const { error: updateError } = await supabaseAdmin
    .from(table)
    .update(updateData)
    .eq("id", userId);

  if (updateError) return error(updateError.message, 500);
  return ok({ message: role === "admin" ? "Admin account updated" : "Customer account updated" });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;
  if (!supabaseAdmin) return error("Account deletion is not configured on this server", 503);

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = accountDeleteSchema.safeParse(body.data);
  if (!parsed.success) return error(parsed.error.issues.map((issue) => issue.message).join(", "), 400);

  const { userId, role } = parsed.data;
  if (userId === guard.user.id) return error("You cannot delete the account you are currently signed in with", 400);

  const table = role === "admin" ? "admins" : "customers";
  const { data: profile } = await supabaseAdmin
    .from(table)
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return error(role === "admin" ? "Admin not found" : "Customer not found", 404);

  if (role === "admin") {
    const { count, error: countError } = await supabaseAdmin
      .from("admins")
      .select("id", { count: "exact", head: true })
      .neq("id", userId);
    if (countError) return error("Could not verify remaining admins before deletion", 500);
    if ((count ?? 0) < 1) return error("This admin cannot be deleted because it would leave the system with no admin account", 409);
  }

  const history = await preservedHistoryForUser(userId);
  if (history.error) return error(history.error, 500);
  if ((history.retained ?? []).length > 0) {
    return error(
      `This account cannot be deleted because it has preserved history: ${history.retained!.join(", ")}. Keep the account or deactivate/change its role instead.`,
      409,
    );
  }

  await supabaseAdmin.from("staff_roles").delete().eq("user_id", userId);
  await supabaseAdmin.from("employees").delete().eq("id", userId);
  await supabaseAdmin.from("customers").delete().eq("id", userId);
  await supabaseAdmin.from("admins").delete().eq("id", userId);

  const authDelete = await deleteAuthAccount(userId);
  if (authDelete.error) {
    await supabaseAdmin.from(table).upsert(profile as any);
    return error(`Profile deletion was rolled back because the authentication account could not be removed: ${authDelete.error}`, 500);
  }

  return ok({ message: "Account deleted permanently" });
};
