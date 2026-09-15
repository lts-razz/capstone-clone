// /api/admin/blocked-dates - manage admin blocked venue dates
import type { APIRoute } from "astro";
import { z } from "zod";
import { supabaseAdmin, supabase } from "../../../lib/supabase";
import { adminGuard } from "../../../lib/adminGuard";
import { ok, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import { logBookingAudit } from "../../../services/bookingAudit";
import { findActiveReservationBookingOverlaps } from "../../../services/bookingAvailability";
import type { Database } from "../../../lib/database.types";

export const prerender = false;

const db = supabaseAdmin ?? supabase;
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must use YYYY-MM-DD");
const blockedDateReasonSchema = z
  .string({ required_error: "Blocked-date reason is required" })
  .trim()
  .min(1, "Blocked-date reason is required")
  .max(500, "Blocked-date reason must be 500 characters or fewer");

const createBlockedDateSchema = z
  .object({
    venueId: z.string().uuid("venueId must be a valid UUID"),
    startDate: dateString,
    endDate: dateString,
    reason: blockedDateReasonSchema,
    confirmedSensitiveAction: z.literal(true, {
      errorMap: () => ({ message: "Explicit confirmation is required before blocking dates" }),
    }),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

const updateBlockedDateSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
  venueId: z.string().uuid("venueId must be a valid UUID").optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  reason: blockedDateReasonSchema.optional(),
  isActive: z.boolean().optional(),
  confirmedSensitiveAction: z.literal(true, {
    errorMap: () => ({ message: "Explicit confirmation is required before changing blocked dates" }),
  }),
});

type BlockedDateRow = Database["public"]["Tables"]["blocked_dates"]["Row"];
type BlockedDateUpdate = Database["public"]["Tables"]["blocked_dates"]["Update"];
type BlockedDateWithMigrationFields = BlockedDateRow & {
  updated_at?: unknown;
  is_active?: unknown;
};

function isBlockedDateActive(row: BlockedDateWithMigrationFields): boolean {
  return row.is_active !== false;
}

function mapBlockedDate(row: BlockedDateWithMigrationFields) {
  return {
    id: row.id,
    venueId: row.venue_id,
    startDate: row.start_date,
    endDate: row.end_date,
    reason: row.reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : row.created_at,
    isActive: isBlockedDateActive(row),
  };
}

async function validateBlockedDateDoesNotOverlapReservation(
  venueId: string,
  startDate: string,
  endDate: string,
) {
  const overlaps = await findActiveReservationBookingOverlaps(db, {
    venueId,
    startDate,
    endDate,
  });
  if (overlaps.error) {
    return error("Could not verify existing reservations before changing blocked dates. Please try again.", 500);
  }
  if (overlaps.bookings.length > 0) {
    return error("Cannot block these dates because an existing reservation occupies this venue during the selected period.", 409);
  }
  return null;
}

export const GET: APIRoute = async ({ url, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const includeInactive = url.searchParams.get("includeInactive") === "true";
  const query = db
    .from("blocked_dates")
    .select("*")
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: false });

  const { data, error: dbError } = await query;
  if (dbError) return error(dbError.message, 500);

  const blockedDates = includeInactive
    ? (data ?? [])
    : (data ?? []).filter(isBlockedDateActive);
  return ok({ blockedDates: blockedDates.map(mapBlockedDate) });
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = createBlockedDateSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((item) => item.message).join(", "), 400);
  }

  const reservationConflict = await validateBlockedDateDoesNotOverlapReservation(
    parsed.data.venueId,
    parsed.data.startDate,
    parsed.data.endDate,
  );
  if (reservationConflict) return reservationConflict;

  const { data, error: insertError } = await db
    .from("blocked_dates")
    .insert({
      venue_id: parsed.data.venueId,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
      reason: parsed.data.reason,
      created_by: guard.user.id,
    })
    .select("*")
    .single();

  if (insertError) return error(insertError.message, 500);
  await logBookingAudit({
    actorId: guard.user.id,
    actorType: "admin",
    action: "blocked_date_created",
    reason: data.reason,
    metadata: {
      blockedDateId: data.id,
      venueId: data.venue_id,
      startDate: data.start_date,
      endDate: data.end_date,
      isActive: isBlockedDateActive(data),
    },
  }, db);
  return ok({ message: "Blocked date added", blockedDate: mapBlockedDate(data) });
};

export const PATCH: APIRoute = async ({ request, cookies }) => {
  const guard = await adminGuard(cookies);
  if (guard instanceof Response) return guard;

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = updateBlockedDateSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((item) => item.message).join(", "), 400);
  }

  const { data: current, error: fetchError } = await db
    .from("blocked_dates")
    .select("*")
    .eq("id", parsed.data.id)
    .single();

  if (fetchError || !current) return error("Blocked date not found", 404);

  const nextStartDate = parsed.data.startDate ?? current.start_date;
  const nextEndDate = parsed.data.endDate ?? current.end_date;
  if (nextEndDate < nextStartDate) {
    return error("endDate must be on or after startDate", 400);
  }

  if (parsed.data.isActive !== undefined && !("is_active" in current)) {
    return error(
      "Blocked-date activation changes require the latest add_blocked_dates migration.",
      409,
    );
  }

  const updateData: BlockedDateUpdate & { is_active?: boolean } = {};
  if (parsed.data.venueId !== undefined) updateData.venue_id = parsed.data.venueId;
  if (parsed.data.startDate !== undefined) updateData.start_date = parsed.data.startDate;
  if (parsed.data.endDate !== undefined) updateData.end_date = parsed.data.endDate;
  if (parsed.data.reason !== undefined) updateData.reason = parsed.data.reason;
  if (parsed.data.isActive !== undefined) updateData.is_active = parsed.data.isActive;

  if (Object.keys(updateData).length === 0) {
    return ok({ message: "No changes", blockedDate: mapBlockedDate(current) });
  }

  const currentlyActive = isBlockedDateActive(current);
  const nextActive = parsed.data.isActive ?? currentlyActive;
  const activatesBlockedDate = parsed.data.isActive === true && !currentlyActive;
  const changesBlockedPeriod =
    parsed.data.venueId !== undefined
    || parsed.data.startDate !== undefined
    || parsed.data.endDate !== undefined;

  if (nextActive && (activatesBlockedDate || changesBlockedPeriod)) {
    const reservationConflict = await validateBlockedDateDoesNotOverlapReservation(
      parsed.data.venueId ?? current.venue_id,
      nextStartDate,
      nextEndDate,
    );
    if (reservationConflict) return reservationConflict;
  }

  const { data, error: updateError } = await db
    .from("blocked_dates")
    .update(updateData as BlockedDateUpdate)
    .eq("id", parsed.data.id)
    .select("*")
    .single();

  if (updateError) return error(updateError.message, 500);
  await logBookingAudit({
    actorId: guard.user.id,
    actorType: "admin",
    action: isBlockedDateActive(data)
      ? (isBlockedDateActive(current) ? "blocked_date_updated" : "blocked_date_reactivated")
      : "blocked_date_deactivated",
    reason: data.reason,
    metadata: {
      blockedDateId: data.id,
      previous: {
        venueId: current.venue_id,
        startDate: current.start_date,
        endDate: current.end_date,
        isActive: isBlockedDateActive(current),
      },
      current: {
        venueId: data.venue_id,
        startDate: data.start_date,
        endDate: data.end_date,
        isActive: isBlockedDateActive(data),
      },
    },
  }, db);
  return ok({
    message: isBlockedDateActive(data) ? "Blocked date updated" : "Blocked date deactivated",
    blockedDate: mapBlockedDate(data),
  });
};
