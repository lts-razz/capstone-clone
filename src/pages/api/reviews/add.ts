// POST /api/reviews/add - add a review after a booking event is complete (requires auth)
import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";
import { getUser } from "../../../lib/auth";
import { addReviewSchema } from "../../../validation/review";
import { created, error } from "../../../lib/response";
import { parseBody } from "../../../lib/parseBody";
import { canReviewBooking } from "../../../lib/reviewEligibility";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies);
  if (!user) return error("Unauthorized — please sign in", 401);

  const body = await parseBody(request);
  if (!body.ok) return body.response;

  const parsed = addReviewSchema.safeParse(body.data);
  if (!parsed.success) {
    return error(parsed.error.errors.map((e) => e.message).join(", "), 400);
  }

  const { bookingId, rating, comment } = parsed.data;

  // Booking must exist, belong to user, and be complete or past its event end.
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, user_id, status, end_date, end_datetime")
    .eq("id", bookingId)
    .single();

  if (!booking)                       return error("Booking not found", 404);
  if (booking.user_id !== user.id)    return error("You can only review your own bookings", 403);
  if (!canReviewBooking(booking)) {
    return error("You can only review after the event has been completed", 400);
  }

  // One review per booking
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) return error("You have already reviewed this booking", 409);

  // Direct insert — no RPC needed
  const { data: review, error: insertError } = await supabase
    .from("reviews")
    .insert({
      user_id:    user.id,
      booking_id: bookingId,
      rating:     rating,
      comment:    comment ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return error("You have already reviewed this booking", 409);
    }
    console.error("[AddReview]", insertError.message);
    return error(insertError.message, 500);
  }

  return created({ reviewId: review.id, message: "Review added successfully" });
};

