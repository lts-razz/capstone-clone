# Woodberry Booking Rules

Read this file only for tasks involving booking lifecycle, availability, payments, quotations, cancellations/refunds, or rescheduling.

## Booking Status
Authoritative lifecycle:
- `pending` = active reservation/request; securing payment not yet verified.
- `booked` = required securing/down payment verified.
- `rescheduled` = booking successfully rescheduled.
- `cancelled` = cancelled or expired booking.
- `completed` = completed event.

`pending` and `booked` are not equivalent.
Valid active `pending`, `booked`, and `rescheduled` bookings block availability when applicable.

Separate contract signing is obsolete. Do not restore `contract_signing` workflow, states, messages, requirements, or notifications. Terms & Conditions acceptance remains where applicable.

## Preset / Package Flow
`Select package/schedule → Review + Terms → Temporary reservation → Required payment → Booking secured`

Rules:
- Create as `pending`.
- Start the 48-hour payment hold immediately.
- Payment is immediately available.
- Set `booked` only after authoritative payment verification.
- Use the actual stored `reservation_expires_at`; browser countdowns are display-only.

## Custom Flow
`Submit request → Finalize quotation → 48-hour payment window → Required payment → Booking secured`

Rules:
- Create as `pending`.
- Before quote finalization: no payment deadline and `reservation_expires_at = NULL`.
- Quotation state:
  - package: `not_required`
  - custom awaiting quote: `pending`
  - custom payable quote: `finalized`
- Finalizing the quotation makes it payable and starts the 48-hour deadline; it does not make it `booked`.
- Set `booked` only after authoritative payment verification.

## Payments
Server/database state is authoritative for amounts, eligibility, success, and refunds.
Never trust client-supplied totals, payment status, refund amounts, or eligibility.
PayMongo success/return UI alone is not proof of payment.

Intended financial model:
- `booking_payments` = booking-level payment/refund summary.
- `payment_transactions` = individual transaction history.

Legacy payment fields/tables may remain for compatibility. Do not refactor/remove them unless the task specifically requires it.
Avoid duplicate transactions/checkouts using existing protections.

## Availability / Venues
- Multi-venue packages require all assigned venues to be available.
- `package_venue_assignments` is the intended authoritative package venue set.
- `booking_venue_assignments` is the intended authoritative reserved venue set.
- Legacy singular `venue_id` fields may remain temporarily for compatibility.
- Cancelled/expired bookings must not block availability.
- Booking and rescheduling writes must be server/database-authoritative and concurrency-safe.
- Multi-venue reservation/reschedule operations must be all-or-nothing.

## Cancellation / Refund
Cancellation outcome must be calculated server-side using the existing Woodberry policy and authoritative payment state.
Where applicable, use:
- `booking_payments.refund_status`
- `refund_amount`
- `refund_processed_at`
- `refund_notes`

If automatic gateway refunds are not already safely implemented, do not invent one. Record eligible refunds for staff/admin processing instead.

## Rescheduling
Customer-facing reschedule requests must not directly mutate a secured booking unless the approved workflow explicitly permits it.
Requested schedules must be checked server-side against all required venues.
Approval/apply operations must preserve the same concurrency and availability protections as original booking creation.

## Database / Types
Schema changes are allowed when needed for correctness.
Preserve existing data, RLS, authorization, and security.
Keep affected TypeScript/database types synchronized after schema changes.
