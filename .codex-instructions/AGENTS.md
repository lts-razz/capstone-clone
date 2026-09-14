# Woodberry Resort and Events --- Codex Instructions

## Project

Web-based booking management system for Woodberry Resort and Events.

Stack: Astro, TypeScript, React, Tailwind CSS, Supabase/PostgreSQL,
PayMongo.

## Before Editing

1.  Read this file first.
2.  Start with files/symbols named in the task.
3.  Inspect only code needed for the requested change; follow references
    only when necessary.
4.  For files over \~800 lines, do not read the whole file by default.
    Search for the relevant function, component, element, API call, or
    symbol and inspect only nearby code.
5.  Do not perform repo-wide searches/audits unless genuinely required.
6.  Current repository state is authoritative.

## Coding Rules

-   Make targeted, maintainable changes only.
-   No unrelated refactors, cleanup, redesigns, or speculative fixes.
-   Reuse existing helpers/services/components where practical.
-   Preserve auth, authorization, RLS, security, and working behavior
    unless the task changes them.
-   Never expose/hardcode secrets or service-role credentials.
-   Server/database logic is authoritative for booking, availability,
    pricing, payment, refunds, and permissions. Client checks are UX
    only.
-   Schema changes are allowed when necessary for clean/correct
    implementation; migrate existing data safely.
-   Do not work around a poor schema merely to avoid a migration.
-   Report unrelated issues instead of expanding scope unless they block
    the task.

## Authoritative Booking Lifecycle

### Status

-   `pending` = active but required securing payment has not been
    verified.
-   `booked` = required securing/down payment verified.
-   `rescheduled` = rescheduled booking.
-   `cancelled` = cancelled/expired booking.
-   `completed` = completed event.
-   `pending` and `booked` are not equivalent.
-   Valid active `pending` reservations block availability.

### Preset/package

`Select package/schedule → Review + Terms → Temporary reservation → Required payment → Booking secured`

-   Create as `pending`.
-   Start 48-hour payment hold immediately.
-   Payment is immediately available.
-   Change to `booked` only after authoritative payment verification.

### Custom

`Submit request → Finalize quotation → 48-hour payment window → Required payment → Booking secured`

-   Create as `pending`.
-   Before quote finalization: no payment deadline and
    `reservation_expires_at = NULL`.
-   Finalization makes it payable and starts the 48-hour deadline; it
    does not make it `booked`.
-   Change to `booked` only after authoritative payment verification.

### Contract signing

Separate contract signing is obsolete. - Do not restore contract-signing
workflow, states, requirements, messages, or notifications. - Terms &
Conditions acceptance remains where applicable.

## Payments

-   Preserve current down-payment policy unless explicitly changed.
-   Amounts, eligibility, payment success, and refund eligibility are
    server-authoritative.
-   Never trust client-supplied payment/refund amounts.
-   PayMongo return/success UI alone is not payment proof.
-   Avoid duplicate transactions/checkouts using existing protections.
-   Intended model: `booking_payments` = booking-level payment/refund
    summary; `payment_transactions` = transaction history.
-   Legacy payment fields/tables may remain for compatibility; do not
    refactor/remove them unless required by the task.

## Availability / Venues

-   Multi-venue packages require all assigned venues to be available.
-   `package_venue_assignments` is the intended authoritative package
    venue set.
-   `booking_venue_assignments` is the intended authoritative reserved
    venue set.
-   Legacy single `venue_id` fields may remain for compatibility.
-   Active applicable `pending`, `booked`, and `rescheduled` bookings
    block conflicts.
-   Cancelled/expired bookings must not continue blocking availability.
-   Booking/rescheduling writes must remain
    server/database-authoritative and concurrency-safe.
-   Multi-venue operations must be all-or-nothing.

## Custom Quotation

Use explicit quotation state when available: - package →
`not_required` - custom awaiting quote → `pending` - custom payable
quote → `finalized`

## Cancellation / Refund

When applicable, use `booking_payments.refund_status`, `refund_amount`,
`refund_processed_at`, and `refund_notes` as booking-level refund state.
Do not promise or perform automatic gateway refunds unless existing
implementation safely supports them.

## UI

Follow the existing Woodberry visual language: warm resort/nature
aesthetic, green accents, soft neutral backgrounds, rounded
controls/cards, subtle shadows, clean responsive layouts. Reuse existing
styles/components. Do not redesign whole pages for focused tasks.
Changed UI must remain usable on mobile, tablet, and desktop. Do not
audit unrelated pages.

## Forms

-   Inspect only the affected form and directly related API/service
    first.
-   Preserve accessibility and validation.
-   Authoritative business validation belongs server-side.
-   Inspect sibling forms only when shared behavior actually requires
    synchronization.

## Supabase / Database

-   Migrations/schema changes are permitted when required.
-   Prefer database invariants over fragile application workarounds.
-   Preserve existing data, RLS, and authorization.
-   Keep relevant TypeScript/database types synchronized after schema
    changes.

## Codex Efficiency

-   Do not reread unrelated files.
-   Do not open large files fully when targeted search is sufficient.
-   Do not re-audit completed fixes unless touched by the task.
-   Do not inspect admin/staff/customer versions unless the task affects
    them.
-   Do not investigate schema for UI-only changes.
-   Do not perform speculative architecture analysis.
-   Prefer the smallest correct implementation.
-   Avoid repeated builds/searches.
-   If the task is already satisfied, make no unnecessary changes and
    report that.

## Build

After implementation, run `npm run build` once. Fix only errors caused
by the task. Rebuild only after fixing such an error. If an unrelated
pre-existing issue blocks the build, report it rather than changing
unrelated code.

## Final Response

Report only: - changed files/schema; - what was implemented; - build
result; - blocker/unresolved issue, if any.

Do not provide a long implementation explanation unless explicitly
requested.
