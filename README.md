## Project Structure

```
src/
├── lib/
│   ├── supabase.ts         # Supabase clients (public + service role)
│   ├── auth.ts             # Cookie-based session helpers
│   ├── adminGuard.ts       # Admin, staff, and customer route protection
│   ├── parseBody.ts        # Safe JSON body parser
│   ├── response.ts         # Consistent JSON response helpers
│   └── database.types.ts   # TypeScript types (keep in sync with Supabase)
│
├── pages/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── signin.ts           # POST — sign in (form post)
│   │   │   ├── signup.ts           # POST — register
│   │   │   └── signout.ts          # GET  — sign out
│   │   ├── bookings/
│   │   │   ├── CreateBookings.ts   # POST — create a booking
│   │   │   ├── GetUserBookings.ts  # GET  — my bookings
│   │   │   ├── CancelBookings.ts   # POST — cancel own booking
│   │   │   ├── GetAllBookings.ts   # GET  — all bookings (staff/admin)
│   │   │   └── ConfirmBookings.ts  # POST — mark booking as booked (staff/admin)
│   │   ├── reviews/
│   │   │   ├── add.ts              # POST — add a review
│   │   │   ├── get.ts              # GET  — venue reviews (public)
│   │   │   └── user.ts             # GET  — my reviews
│   │   ├── venues/
│   │   │   ├── index.ts            # GET / POST — list or create venues
│   │   │   └── [id].ts             # GET / PUT / DELETE — single venue
│   │   ├── packages/
│   │   │   ├── index.ts            # GET / POST — list or create packages
│   │   │   └── [id].ts             # PUT / DELETE — update or deactivate
│   │   └── admin/
│   │       ├── stats.ts            # GET  — dashboard stats (admin)
│   │       ├── reschedule.ts       # POST — reschedule a booking (staff/admin)
│   │       └── users.ts            # POST — change user role (admin)
│   │
│   ├── admin/
│   │   └── index.astro             # Admin dashboard (protected page)
│   ├── staff/
│   │   └── index.astro             # Staff booking workspace (protected page)
│   ├── dashboard.astro             # Customer dashboard
│   ├── signin.astro
│   ├── signup.astro
│   └── events_and_booking/
│       └── events/
│           └── [venueId].astro     # Venue detail + booking form
│
├── validation/             # Zod schemas — one file per resource
│   ├── booking.ts
│   ├── review.ts
│   ├── user.ts
│   ├── venue.ts
│   └── package.ts
│
├── services/               # Reusable Supabase query helpers
│   ├── auth.ts
│   ├── bookings.ts
│   └── venues.ts
│
└── components/             # Astro + React UI components
```

---

## Getting Started

### 1. Clone the repo and install dependencies

```bash
npm install
```

### 2. Set up environment variables

Open `.env` and add your values — all three are required:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PACKAGE_VENUES_BUCKET=package-venues
BREVO_API_KEY=
BREVO_SENDER_NAME="Woodberry Resorts and Events Place"
BREVO_SENDER_EMAIL="wbrepprototype@gmail.com"
NOTIFICATION_CRON_SECRET=
RESERVATION_CRON_SECRET=
SMS_ENABLED=false
SMS_PROVIDER=termux
TERMUX_SMS_SERVER_URL=http://YOUR_PHONE_LAN_IP:8787/send-sms
TERMUX_SMS_SERVER_TOKEN=replace-with-a-long-random-token
TERMUX_SMS_TIMEOUT_MS=10000
```

`BREVO_API_KEY` is server-only and must never be exposed to client-side code. If it is missing, booking status updates still succeed and email notifications are skipped server-side.

`TERMUX_SMS_SERVER_TOKEN` is also server-only and must never be exposed to client-side code. SMS notifications are sent only from server-side notification services. To use an Android phone as the SMS server, see `tools/termux-sms-server/README.md`, run the Termux server on the phone, set `SMS_ENABLED=true`, and point `TERMUX_SMS_SERVER_URL` to `http://PHONE_LAN_IP:8787/send-sms`.

Apply all SQL files in `supabase/migrations/` in filename order. Existing projects especially need the notification, reservation-validity, blocked-date, employee, booking-payment, and audit-log migrations before those features are enabled.

### Supabase Storage setup for venue images

Venue image uploads are sent server-side with `SUPABASE_SERVICE_ROLE_KEY`; never expose that key to browser code. The app uses `SUPABASE_PACKAGE_VENUES_BUCKET` when it is set and otherwise uses `package-venues`.

The recommended setup is to apply `supabase/migrations/add_package_venues.sql` in the Supabase SQL Editor or through the Supabase CLI. That idempotent migration creates the `package-venues` bucket and configures it as:

- public, so the stored `image_url` can be displayed with a Supabase public URL;
- maximum file size of 5 MB; and
- allowed MIME types `image/jpeg`, `image/png`, `image/webp`, and `image/gif`.

If migrations are applied manually, open **Supabase Dashboard > Storage > New bucket** and create a public bucket named exactly `package-venues`, set the file size limit to `5 MB`, and allow the four MIME types above. Then apply the `storage.objects` policies from `supabase/migrations/add_package_venues.sql`. Keep `SUPABASE_PACKAGE_VENUES_BUCKET=package-venues` in every deployment environment. If a different bucket name is configured, create a matching public bucket and equivalent policies first.

After setup, verify **Storage > package-venues** exists and is public. Uploads are stored under unique paths such as `venues/<uuid>.jpg` or `<package-id>/<uuid>.jpg`; the database stores the generated public URL, not base64 data.

### 3. Start the dev server

```bash
npm run dev
```

The site runs at `http://localhost:4321`.

### Supabase password recovery setup

Complete this checklist in the Supabase Dashboard before testing password recovery:

The `/reset-password` page supports Supabase recovery redirects that contain either hash tokens (`#access_token=...&type=recovery`) or a PKCE-style query code (`?code=...`). The exact `/reset-password` URL for each environment must be allowed in Supabase before recovery emails will redirect correctly.

- [ ] Under **Authentication**, enable and configure Auth email sending. Use custom SMTP for production if needed.
- [ ] Under **Authentication > URL Configuration**, set **Site URL** to the deployed application URL.
- [ ] Add `http://localhost:4321/reset-password` to **Redirect URLs**.
- [ ] Add the deployed application URL ending in `/reset-password` to **Redirect URLs**.
- [ ] If the application uses a custom domain, add that domain ending in `/reset-password` to **Redirect URLs**.
- [ ] Under **Authentication > Email Templates**, review the **Recovery / Reset password** email template.
- [ ] Confirm the Recovery template's reset link uses `{{ .ConfirmationURL }}`. This preserves the `/reset-password` URL passed by the application.
- [ ] Test the complete flow with a real email address.

The browser reset page receives only `SUPABASE_URL` and `SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` remains server-only and must never be exposed in browser code or public environment variables.

#### Password recovery testing checklist

- [ ] The **Forgot password?** link appears on the sign-in page.
- [ ] A forgot-password request shows the neutral success message.
- [ ] An unknown email address shows the same neutral success message.
- [ ] The reset email opens `/reset-password` and its hash-token or `?code=` recovery data is accepted.
- [ ] Mismatched passwords show an error.
- [ ] A valid new password updates successfully.
- [ ] The user can sign in with the new password.
- [ ] The user cannot sign in with the old password.
- [ ] An invalid or expired reset link shows a clear error and a link to request another email.
- [ ] The localhost redirect works.
- [ ] The deployed redirect works.

## API Overview

All endpoints return JSON. Errors always return `{ "error": "message" }`.
Auth is handled by HttpOnly cookies — no token management needed on the frontend.

Booking statuses use only `booked` (Booked), `rescheduled` (Rescheduled), `cancelled` (Cancelled), and `completed` (Completed). Payment statuses are separate and retain their own payment-specific values.

Customers must make bookings at least 1 week in advance. The booking form and backend both enforce this minimum date rule.

| Method | Route                           | Auth   | Description                                       |
| ------ | ------------------------------- | ------ | ------------------------------------------------- |
| POST   | `/api/auth/signin`              | —      | Sign in via form post → redirects to the role dashboard |
| POST   | `/api/auth/signup`              | —      | Register new account                              |
| GET    | `/api/auth/signout`             | —      | Sign out → redirects to `/signin`                 |
| POST   | `/api/bookings/CreateBookings`  | Customer | Create a booking                                |
| GET    | `/api/bookings/GetUserBookings` | Customer | Get my bookings (filter by `?status=`)          |
| POST   | `/api/bookings/CancelBookings`  | Customer / Staff / Admin | Cancel an owned or managed booking       |
| GET    | `/api/bookings/GetAllBookings`  | Staff / Admin | All bookings with pagination                |
| POST   | `/api/bookings/ConfirmBookings` | Staff / Admin | Mark a contract signing booking as booked   |
| POST   | `/api/admin/reschedule`         | Staff / Admin | Reschedule a booking                        |
| POST   | `/api/admin/update-booking-status` | Staff / Admin | Update a booking using allowed transitions |
| POST   | `/api/admin/update-booking-payment` | Staff / Admin | Record payment details for a booking       |
| GET/POST | `/api/user/notification-preferences` | Customer | View or update email/SMS notification preferences |
| POST   | `/api/notifications/send-weekly-reminders` | Admin or cron secret | Send one-week email/SMS reminders once per eligible booking channel |
| POST   | `/api/reservations/expire`     | Admin or cron secret | Remind and auto-cancel expired unpaid reservations |
| GET    | `/api/venues`                   | Public | List all active venues                            |
| GET    | `/api/venues/:id`               | Public | Get single venue                                  |
| POST   | `/api/venues`                   | Admin  | Create a venue                                    |
| PUT    | `/api/venues/:id`               | Admin  | Update a venue                                    |
| DELETE | `/api/venues/:id`               | Admin  | Deactivate a venue                                |
| GET    | `/api/packages`                 | Public | List all active packages                          |
| POST   | `/api/packages`                 | Admin  | Create a package                                  |
| PUT    | `/api/packages/:id`             | Admin  | Update a package                                  |
| DELETE | `/api/packages/:id`             | Admin  | Deactivate a package                              |
| GET    | `/api/reviews/get?venueId=`     | Public | Get reviews for a venue                           |
| GET    | `/api/reviews/user`             | User   | Get my reviews                                    |
| POST   | `/api/reviews/add`              | User   | Add a review                                      |
| GET    | `/api/admin/stats`              | Admin  | Dashboard statistics                              |
| POST   | `/api/admin/users`              | Admin  | Change a user's role                              |
| POST   | `/api/admin/staff`              | Admin  | Create, update, activate, or deactivate staff     |

For full request/response shapes, see **`API_REFERENCE.md`**.

Active staff use `/staff`, a booking-operations workspace shared with the admin booking UI. Staff can view booking audit history and perform permitted booking, schedule, status, and booking-payment actions. Admin management, staff-account management, venue/package administration, reports, blocked dates, and other admin-only controls remain unavailable to staff. Customers cannot view audit history or internal dashboards.

### Weekly Reminder Cron

Call `POST /api/notifications/send-weekly-reminders` once per day from your scheduler. If `NOTIFICATION_CRON_SECRET` is set, pass it as `Authorization: Bearer YOUR_SECRET`, `x-cron-secret`, or `?secret=YOUR_SECRET`; otherwise the endpoint requires an admin session cookie.

One-week event reminders are tracked per channel with `bookings.one_week_email_sent_at` and `bookings.one_week_sms_sent_at`. The supported customer choices are email only, SMS only, or both email and SMS. A failed channel stays null so a later cron run can retry it without resending channels that already succeeded. The legacy `one_week_notice_sent_at` is filled only after all enabled channels are sent.

Booking submission confirmations, contract-signing schedules, status changes, reschedules, cancellations, and reminders use the customer's saved `email_notifications_enabled` and `sms_notifications_enabled` settings. When both are enabled, email and SMS are attempted independently so one provider failure does not prevent the other channel from sending. Notification failures are logged with the booking ID and channel; customer-facing API responses do not include provider error details.

One-week event reminders are separate from the 48-hour reservation payment reminder and the reservation-cancelled notice. Each notification type has its own eligibility and tracking fields.

#### Notification testing checklist

- [ ] Choose email only, submit a booking, and confirm that booking and later reminder notifications send by email only.
- [ ] Choose SMS only, submit a booking, and confirm that booking and later reminder notifications send by SMS only.
- [ ] Choose both and confirm that email and SMS are both attempted, including when one channel is unavailable.
- [ ] Force an email failure during a one-week reminder; confirm `one_week_email_sent_at` stays null and email retries on the next run without resending a successful SMS.
- [ ] Force an SMS failure during a one-week reminder; confirm `one_week_sms_sent_at` stays null and SMS retries on the next run without resending a successful email.
- [ ] Run the one-week reminder endpoint again and confirm channels with existing per-channel timestamps are not resent; confirm `one_week_notice_sent_at` is set only after all enabled channels are sent.
- [ ] Run the expiration job more than once in the final 24 hours and confirm `expiration_reminder_sent_at` prevents a second successful reminder.
- [ ] Run the expiration job more than once after automatic cancellation and confirm `expiration_cancel_notice_sent_at` prevents a second successful cancellation notice.

### Reservation Validity

New bookings begin with `booked` status and, while unpaid, are held for 48 hours. The booking API sets `reservation_created_at` to the creation time and `reservation_expires_at` to exactly 48 hours later, returns the deadline as `reservationExpiresAt`, and the customer dashboard and booking confirmation show that deadline. Reservation validity is determined by payment and reservation fields, not booking status.

Reservation lifecycle timestamps on `bookings` are:

- `reservation_created_at`: when the reservation hold began.
- `reservation_expires_at`: the 48-hour payment deadline.
- `expiration_reminder_sent_at`: set after the expiration reminder is successfully sent.
- `reservation_expired_at`: when an unpaid reservation was automatically expired.
- `expiration_cancel_notice_sent_at`: set after the automatic-cancellation notice is successfully sent.

Call `POST /api/reservations/expire` on a regular schedule (at least daily; more often gives more timely expiration). During each run it:

- sends an expiration reminder to an eligible unpaid reservation in the final 24 hours before its deadline;
- sends that reminder only once after a successful delivery, using `expiration_reminder_sent_at` as the guard;
- changes an expired active unpaid booking to `cancelled`, records the expiration/cancellation timestamps and system cancellation reason, and sends a cancellation notice;
- leaves paid and partially paid bookings active; and
- releases an expired booking's dates because availability checks ignore `cancelled` bookings.

Set the server-only `RESERVATION_CRON_SECRET` to a long random value and send it as `Authorization: Bearer YOUR_SECRET`, `x-cron-secret`, or `?secret=YOUR_SECRET`. If `RESERVATION_CRON_SECRET` is absent, the endpoint falls back to `NOTIFICATION_CRON_SECRET`. If neither is configured, an authenticated admin session is required. Do not expose either token to browser code.

#### Reservation validity testing checklist

- [ ] A new unpaid booking gets `reservation_expires_at = now + 48 hours`.
- [ ] An unpaid expired reservation is automatically changed to `cancelled` with the system expiration timestamps and reason.
- [ ] A cancelled expired reservation releases its dates in `/api/bookings/availability` while active overlaps remain blocked.
- [ ] A `partial` or `paid` booking, and any booking with `amount_paid > 0`, does not expire.
- [ ] The customer dashboard shows the active deadline, expiring-soon warning, and expired-cancellation explanation correctly.
- [ ] Admin booking details and the shared staff booking view show the created time, deadline, remaining time, payment state, and cancellation reason.
- [ ] The expiration reminder sends only once.
- [ ] The expiration cancellation notice sends only once.
- [ ] `/api/reservations/expire` rejects requests without a valid cron secret or authenticated admin session.

---

## Auth Levels

| Label | Meaning                                                          |
| ----- | ---------------------------------------------------------------- |
| —     | No auth needed, public endpoint                                  |
| User  | Must be signed in; the route may apply ownership checks          |
| Customer | Must be signed in and have a matching row in `customers`    |
| Staff | Must be signed in and have an active row in `employees`          |
| Admin | Must be signed in and have a matching row in `admins`            |

For a 401 response, redirect the user to `/signin`.
For a 403 response, the user is signed in but does not have the required role.

---

## Keeping TypeScript Types in Sync

When you change the database schema, regenerate the types:

```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/lib/database.types.ts
```

Commit the regenerated `src/lib/database.types.ts` with the migration so table names, columns, nullability, relationships, and allowed status values stay aligned with Supabase.

