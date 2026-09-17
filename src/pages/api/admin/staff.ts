import type { APIRoute } from "astro";
import { z } from "zod";
import { adminGuard } from "../../../lib/adminGuard";
import { parseBody } from "../../../lib/parseBody";
import { created, error, ok } from "../../../lib/response";
import { supabaseAdmin } from "../../../lib/supabase";

export const prerender = false;

const detailsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  phone: z.string().trim().max(30).optional().default(""),
  position: z.string().trim().min(1, "Position is required").max(100),
});
const createSchema = detailsSchema.extend({
  action: z.literal("create"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});
const updateSchema = detailsSchema.extend({
  action: z.literal("update"),
  staffId: z.string().uuid("Invalid staff account"),
  email: z.string().trim().email("Enter a valid email address"),
});
const statusSchema = z.object({
  action: z.enum(["activate", "deactivate"]),
  staffId: z.string().uuid("Invalid staff account"),
});
const deleteSchema = z.object({
  staffId: z.string().uuid("Invalid staff account"),
  confirmedSensitiveAction: z.literal(true, {
    errorMap: () => ({ message: "Explicit confirmation is required before deleting staff accounts" }),
  }),
});
const requestSchema = z.discriminatedUnion("action", [createSchema, updateSchema, statusSchema]);

async function countUserReferences(table: string, column: string, userId: string) {
  if (!supabaseAdmin) return { count: 0, error: "Staff account management is not configured on this server" };
  const { count, error: countError } = await (supabaseAdmin as any)
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, userId);

  return { count: count ?? 0, error: countError?.message as string | undefined };
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
    if (result.error) return { error: result.error };
    if (result.count > 0) retained.push(`${result.count} ${check.label}${result.count === 1 ? "" : "s"}`);
  }

  return { retained };
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;
  if (!supabaseAdmin) return error("Staff account management is not configured on this server", 503);

  const body = await parseBody(request);
  if (!body.ok) return body.response;
  const parsed = requestSchema.safeParse(body.data);
  if (!parsed.success) return error(parsed.error.issues.map((issue) => issue.message).join(", "), 400);

  if (parsed.data.action === "create") {
    const { email, password, firstName, lastName, phone, position } = parsed.data;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (authError || !authData.user) return error(authError?.message ?? "Could not create staff account", 400);

    const { error: insertError } = await supabaseAdmin.from("employees").insert({
      id: authData.user.id, email, first_name: firstName, last_name: lastName,
      phone: phone || null, position, is_active: true,
    });
    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return error(insertError.message, 500);
    }
    // Auth triggers may provision every new identity as a customer. A staff
    // identity must have only the employee role, including while deactivated.
    await supabaseAdmin.from("customers").delete().eq("id", authData.user.id);
    return created({ message: "Staff account created" });
  }

  const { data: employee } = await supabaseAdmin.from("employees").select("id, email, first_name, last_name")
    .eq("id", parsed.data.staffId).maybeSingle();
  if (!employee) return error("Staff member not found", 404);
  if (parsed.data.action === "deactivate" && parsed.data.staffId === guard.user.id) {
    return error("You cannot deactivate your own staff access while signed in as admin", 400);
  }

  if (parsed.data.action === "update") {
    const authUpdate: Parameters<typeof supabaseAdmin.auth.admin.updateUserById>[1] = {
      email: parsed.data.email,
      email_confirm: true,
      user_metadata: { first_name: parsed.data.firstName, last_name: parsed.data.lastName },
    };
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(parsed.data.staffId, authUpdate);
    if (authError) return error(authError.message, 400);

    const { error: updateError } = await supabaseAdmin.from("employees").update({
      email: parsed.data.email,
      first_name: parsed.data.firstName, last_name: parsed.data.lastName,
      phone: parsed.data.phone || null, position: parsed.data.position,
    }).eq("id", parsed.data.staffId);
    if (updateError) {
      await supabaseAdmin.auth.admin.updateUserById(parsed.data.staffId, {
        email: employee.email ?? undefined,
        email_confirm: true,
        user_metadata: { first_name: employee.first_name, last_name: employee.last_name },
      }).catch(() => null);
      return error(updateError.message, 500);
    }

    const { error: adminProfileUpdateError } = await supabaseAdmin
      .from("admins")
      .update({
        email: parsed.data.email,
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      })
      .eq("id", parsed.data.staffId);
    if (adminProfileUpdateError) {
      await supabaseAdmin.from("employees").update({
        email: employee.email,
        first_name: employee.first_name,
        last_name: employee.last_name,
      }).eq("id", parsed.data.staffId);
      await supabaseAdmin.auth.admin.updateUserById(parsed.data.staffId, {
        email: employee.email ?? undefined,
        email_confirm: true,
        user_metadata: { first_name: employee.first_name, last_name: employee.last_name },
      }).catch(() => null);
      return error(adminProfileUpdateError.message, 500);
    }

    return ok({ message: "Staff details updated" });
  }

  const { error: statusError } = await supabaseAdmin.from("employees")
    .update({ is_active: parsed.data.action === "activate" }).eq("id", parsed.data.staffId);
  if (statusError) return error(statusError.message, 500);
  return ok({ message: parsed.data.action === "activate" ? "Staff account activated" : "Staff account deactivated" });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;
  if (!supabaseAdmin) return error("Staff account management is not configured on this server", 503);

  const body = await parseBody(request);
  if (!body.ok) return body.response;
  const parsed = deleteSchema.safeParse(body.data);
  if (!parsed.success) return error(parsed.error.issues.map((issue) => issue.message).join(", "), 400);

  if (parsed.data.staffId === guard.user.id) {
    return error("You cannot delete the account you are currently signed in with", 400);
  }

  const { data: employee, error: lookupError } = await supabaseAdmin
    .from("employees")
    .select("*")
    .eq("id", parsed.data.staffId)
    .maybeSingle();
  if (lookupError) return error(lookupError.message, 500);
  if (!employee) return error("Staff member not found", 404);

  const history = await preservedHistoryForUser(parsed.data.staffId);
  if (history.error) return error(history.error, 500);
  if ((history.retained ?? []).length > 0) {
    return error(
      `This staff account cannot be deleted because it has preserved history: ${history.retained!.join(", ")}. Deactivate it instead.`,
      409,
    );
  }

  const { error: deleteProfileError } = await supabaseAdmin
    .from("employees")
    .delete()
    .eq("id", parsed.data.staffId);
  if (deleteProfileError) return error(deleteProfileError.message, 500);

  await supabaseAdmin.from("staff_roles").delete().eq("user_id", parsed.data.staffId);
  await supabaseAdmin.from("customers").delete().eq("id", parsed.data.staffId);

  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(parsed.data.staffId, false);
  if (authError) {
    await supabaseAdmin.from("employees").upsert(employee);
    return error(`Staff profile deletion was rolled back because the authentication account could not be removed: ${authError.message}`, 500);
  }

  return ok({ message: "Staff account deleted permanently" });
};
