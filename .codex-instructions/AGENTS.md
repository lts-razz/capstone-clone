# Woodberry Resort and Events — Codex Instructions

## Project
Web-based booking management system for Woodberry Resort and Events.

Stack: Astro, TypeScript, React, Tailwind CSS, Supabase/PostgreSQL, PayMongo.

## Work Efficiently
- Read this file once, then follow the task.
- Start with the exact files/symbols named in the prompt.
- Inspect only code required for the requested change.
- Follow imports/references only when necessary to implement correctly.
- Do not perform repo-wide searches, audits, or architecture reviews unless explicitly requested.
- Do not re-audit previously completed fixes unless the current task touches them.
- If the prompt limits work to one file, stay in that file unless a direct dependency makes that impossible.
- For files over ~800 lines, never read the whole file by default. Search for the named function, ID, component, handler, text, or API call and inspect only nearby code.
- For UI-only tasks, do not inspect APIs/database/schema unless required.
- For backend-only tasks, do not inspect unrelated UI.
- If the requested behavior is already correctly implemented, do not rewrite it; report that no change was needed.
- Prefer the smallest correct change.

## Coding Rules
- Make targeted, maintainable changes.
- No unrelated cleanup, redesign, refactor, or speculative fixes.
- Reuse existing helpers/services/components when practical.
- Preserve authentication, authorization, RLS, security, and unrelated working behavior.
- Never expose or hardcode secrets/service-role credentials.
- Server/database logic is authoritative for booking, availability, pricing, payment, refunds, and permissions. Client checks are UX only.
- Schema changes are allowed when genuinely needed; preserve data and security.
- Do not use awkward workarounds solely to avoid a migration.
- Report unrelated issues instead of expanding scope unless they block the task.

## Booking Lifecycle
Authoritative statuses:
- `pending` — active reservation/request; required securing payment not yet verified.
- `booked` — required securing/down payment verified.
- `rescheduled`
- `cancelled`
- `completed`

`pending` and `booked` are not equivalent. Valid active `pending` reservations block availability.

### Preset / Package
Flow:
`Select package → Select schedule → Review + Terms → Temporary reservation → Required payment → Booking secured`

- Create as `pending`.
- Start the 48-hour payment hold immediately.
- Payment is immediately available.
- Change to `booked` only after authoritative payment verification.
- Customer-facing wording should describe this as a reservation, not a booking request.

### Custom
Flow:
`Submit custom request → Woodberry finalizes quotation → 48-hour payment window → Required payment → Booking secured`

- Create as `pending`.
- Before quote finalization: no payment deadline and `reservation_expires_at = NULL`.
- Quote finalization starts the 48-hour payment deadline and makes payment available.
- Quote finalization does not make the booking `booked`.
- Change to `booked` only after authoritative payment verification.
- Customer-facing wording may use “custom booking request”.

### Contract Signing
Separate contract signing is obsolete.
- Do not restore contract-signing statuses, steps, requirements, messages, or notifications.
- Terms & Conditions acceptance remains where applicable.
- Legacy contract-signing columns may remain temporarily for compatibility unless a cleanup task removes them.

## Payments
- Preserve the current required-payment/down-payment policy unless explicitly changed.
- Amounts, eligibility, payment success, and refund eligibility are server-authoritative.
- Never trust client-supplied payment/refund amounts.
- PayMongo success/return UI alone is not proof of payment.
- Avoid duplicate transactions/checkouts using existing protections.
- Intended model:
  - `booking_payments` — booking-level payment/refund summary.
  - `payment_transactions` — transaction history.
- Legacy payment fields/tables may remain temporarily; do not consolidate/remove them unless requested or required by the task.

## Availability / Venues
- Multi-venue packages require all assigned venues to be available.
- `package_venue_assignments` is the intended authoritative package venue set.
- `booking_venue_assignments` is the intended authoritative reserved venue set.
- Legacy singular `venue_id` fields may remain for compatibility.
- Applicable active `pending`, `booked`, and `rescheduled` bookings block conflicts.
- Cancelled/expired bookings must not block availability.
- Booking/rescheduling writes must remain server/database-authoritative and concurrency-safe.
- Multi-venue operations must be all-or-nothing.

## Custom Quotation
Use explicit quotation state when available:
- package → `not_required`
- custom awaiting quotation → `pending`
- custom payable quotation → `finalized`

Do not infer payability only from browser/client state.

## Cancellation / Refund
When applicable, use:
- `booking_payments.refund_status`
- `refund_amount`
- `refund_processed_at`
- `refund_notes`

Determine refund eligibility server-side from the existing Woodberry cancellation policy.
Do not invent a new policy.
Do not implement an automatic gateway refund unless the existing system already safely supports it.

## Booking Form UX
- Signed-in account details should be automatically prefilled when available, while remaining editable.
- Never overwrite values the customer has already typed.
- Package-defined defaults should reduce unnecessary manual inputs.
- If the selected package determines multi-day behavior or schedule behavior, apply that automatically where appropriate.
- Preset/package flow uses reservation terminology.
- Custom flow uses request terminology.
- Keep pricing language simple and customer-facing.
- Do not broadly refactor `bookingForm.astro` while fixing focused issues; extract only when it naturally reduces the touched code.

## UI
Follow the existing Woodberry visual language.
Reuse existing styles/components.
Do not redesign whole pages for focused tasks.
Changed UI must remain usable on mobile, tablet, and desktop.
Do not audit unrelated pages for responsiveness.

## Forms
- Inspect only the affected form section and directly related logic.
- Preserve accessibility and validation.
- Authoritative business validation belongs server-side.
- Avoid unnecessary duplicate entry of authenticated customer information.
- Inspect sibling forms only when shared behavior requires it.

## Database
- Migrations/schema changes are permitted when required.
- Prefer database invariants over fragile application-only workarounds.
- Preserve existing data, RLS, and authorization.
- Keep relevant TypeScript/database types synchronized after schema changes.
- Do not remove legacy payment/venue columns or tables during unrelated tasks.

## Build
Run `npm run build` once after implementation.

If the build fails because of the task, fix that error and rebuild.
If an unrelated pre-existing issue blocks the build, report it instead of changing unrelated code.

For tiny text/style-only edits, follow an explicit prompt instruction to skip the build if one is given.

## Final Response
Keep it minimal. Report only:
- changed files/schema;
- implemented behavior;
- build result;
- blocker/unresolved issue, if any.

Do not provide a long explanation unless explicitly requested.
