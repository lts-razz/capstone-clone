import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../lib/database.types";
import { supabaseAdmin, supabase } from "../lib/supabase";

type DbClient = SupabaseClient<Database>;

export type BookingAuditActorType = "admin" | "staff" | "customer" | "system";

export type BookingAuditInput = {
  bookingId?: string | null;
  actorId?: string | null;
  actorType: BookingAuditActorType;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  metadata?: Json;
};

const db = supabaseAdmin ?? supabase;

export async function logBookingAudit(
  input: BookingAuditInput,
  client: DbClient = db,
): Promise<void> {
  try {
    const { error } = await client.from("booking_audit_log").insert({
      booking_id: input.bookingId ?? null,
      actor_id: input.actorId ?? null,
      actor_role: input.actorType,
      action: input.action,
      old_status: input.fromStatus ?? null,
      new_status: input.toStatus ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    });

    if (error) {
      console.error("[BookingAudit]", error.message);
    }
  } catch (auditError) {
    const message = auditError instanceof Error ? auditError.message : "Unexpected audit log failure";
    console.error("[BookingAudit]", message);
  }
}
