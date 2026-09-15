# Woodberry Resort and Events — Codex Instructions

## Scope
This repository is the Woodberry Resort and Events booking system.

Stack: Astro, TypeScript, React, Tailwind CSS, Supabase/PostgreSQL, PayMongo.

## Working Method
- Read this file first.
- Start only with files/symbols named in the task.
- Inspect the smallest relevant code section and follow references only when necessary.
- For files over ~800 lines, do not read the whole file by default. Search for the relevant function, component, element, API call, or text and inspect nearby code only.
- Do not perform repo-wide audits/searches unless the task genuinely requires them.
- Do not read `README.md`, `API_REFERENCE.md`, or unrelated documentation unless explicitly needed.
- For booking, payment, availability, quotation, cancellation, refund, or rescheduling logic, also read `.codex-instructions/BOOKING_RULES.md`.

## Editing Rules
- Make the smallest correct, maintainable change.
- No unrelated refactors, cleanup, redesigns, or speculative fixes.
- Reuse existing helpers/services/components where practical.
- Preserve authentication, authorization, RLS, security, and working behavior unless the task changes them.
- Never expose or hardcode secrets/service-role credentials.
- Schema changes are allowed when they are the cleanest correct solution; preserve data and security.
- If an unrelated issue is found, report it instead of expanding scope unless it blocks the task.
- Current repository state is authoritative.

## Efficiency
- Do not reread unrelated files or completed fixes.
- Do not inspect admin/staff/customer variants unless the task affects them.
- Do not investigate schema for UI-only changes.
- Prefer targeted `rg`/symbol searches over broad scans.
- Keep terminal output small; do not print entire large files, full repo diffs, or noisy logs.
- After editing, inspect only the diff for files changed by the task.
- If the requested behavior is already correctly implemented, make no unnecessary changes and report that.

## UI
Reuse the existing Woodberry visual language and components. Keep changed UI responsive and accessible. Do not redesign whole pages for focused tasks.

## Build
For logic, API, schema, type, or integration changes, run `npm run build` once after implementation.
For tiny copy/style-only changes with no logic/type impact, build may be skipped if the task permits it.
Fix only task-caused errors. Report unrelated pre-existing blockers.

## Final Response
Keep it minimal:
- changed files/schema;
- implemented behavior;
- build result;
- blocker/unresolved issue, if any.
