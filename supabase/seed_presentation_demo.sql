-- Woodberry controlled capstone presentation demo data.
--
-- Run this in a Supabase SQL session after migrations. It is intentionally
-- idempotent: each run removes only the deterministic [DEMO] records below,
-- then recreates them with realistic, non-linear booking history.
--
-- Reset demo data only: rerun this file, or run the DELETE section at the top.
-- No passwords or production credentials are created.

begin;

create extension if not exists "pgcrypto";

-- Reset deterministic demo-only records.
with demo_booking_ids(id) as (
  values
    ('10000000-0000-0000-0000-000000000001'::uuid),
    ('10000000-0000-0000-0000-000000000002'::uuid),
    ('10000000-0000-0000-0000-000000000003'::uuid),
    ('10000000-0000-0000-0000-000000000004'::uuid),
    ('10000000-0000-0000-0000-000000000005'::uuid),
    ('10000000-0000-0000-0000-000000000006'::uuid),
    ('10000000-0000-0000-0000-000000000007'::uuid),
    ('10000000-0000-0000-0000-000000000008'::uuid),
    ('10000000-0000-0000-0000-000000000009'::uuid),
    ('10000000-0000-0000-0000-000000000010'::uuid),
    ('10000000-0000-0000-0000-000000000011'::uuid),
    ('10000000-0000-0000-0000-000000000012'::uuid),
    ('10000000-0000-0000-0000-000000000013'::uuid),
    ('10000000-0000-0000-0000-000000000014'::uuid),
    ('10000000-0000-0000-0000-000000000015'::uuid),
    ('10000000-0000-0000-0000-000000000016'::uuid),
    ('10000000-0000-0000-0000-000000000017'::uuid),
    ('10000000-0000-0000-0000-000000000018'::uuid),
    ('10000000-0000-0000-0000-000000000019'::uuid),
    ('10000000-0000-0000-0000-000000000020'::uuid),
    ('10000000-0000-0000-0000-000000000021'::uuid),
    ('10000000-0000-0000-0000-000000000022'::uuid),
    ('10000000-0000-0000-0000-000000000023'::uuid),
    ('10000000-0000-0000-0000-000000000024'::uuid),
    ('10000000-0000-0000-0000-000000000025'::uuid),
    ('10000000-0000-0000-0000-000000000026'::uuid),
    ('10000000-0000-0000-0000-000000000027'::uuid),
    ('10000000-0000-0000-0000-000000000028'::uuid),
    ('10000000-0000-0000-0000-000000000029'::uuid),
    ('10000000-0000-0000-0000-000000000030'::uuid),
    ('10000000-0000-0000-0000-000000000031'::uuid),
    ('10000000-0000-0000-0000-000000000032'::uuid),
    ('10000000-0000-0000-0000-000000000033'::uuid),
    ('10000000-0000-0000-0000-000000000034'::uuid),
    ('10000000-0000-0000-0000-000000000035'::uuid),
    ('10000000-0000-0000-0000-000000000036'::uuid),
    ('10000000-0000-0000-0000-000000000037'::uuid),
    ('10000000-0000-0000-0000-000000000038'::uuid),
    ('10000000-0000-0000-0000-000000000039'::uuid),
    ('10000000-0000-0000-0000-000000000040'::uuid),
    ('10000000-0000-0000-0000-000000000041'::uuid),
    ('10000000-0000-0000-0000-000000000042'::uuid)
)
delete from public.reviews r using demo_booking_ids d where r.booking_id = d.id;

with demo_booking_ids(id) as (
  select ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 42) as n
)
delete from public.payment_transactions t using demo_booking_ids d where t.booking_id = d.id;

with demo_booking_ids(id) as (
  select ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 42) as n
)
delete from public.payments p using demo_booking_ids d where p.booking_id = d.id;

with demo_booking_ids(id) as (
  select ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 42) as n
)
delete from public.booking_reschedule_requests r using demo_booking_ids d where r.booking_id = d.id;

with demo_booking_ids(id) as (
  select ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 42) as n
)
delete from public.booking_audit_log a using demo_booking_ids d where a.booking_id = d.id;

delete from public.bookings
where id in (
  select ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 42) as n
);

delete from public.blocked_dates
where id in (
  '50000000-0000-0000-0000-000000000001'::uuid,
  '50000000-0000-0000-0000-000000000002'::uuid,
  '50000000-0000-0000-0000-000000000003'::uuid
);

delete from public.package_venue_assignments
where package_id in (
  select ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 6) as n
);

delete from public.package_venues
where package_id in (
  select ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 6) as n
);

delete from public.packages
where id in (
  select ('30000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 6) as n
);

delete from public.venues
where id in (
  select ('20000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 6) as n
);

delete from public.admins
where id in (
  '90000000-0000-0000-0000-000000000001'::uuid,
  '90000000-0000-0000-0000-000000000002'::uuid
);

delete from public.customers
where id in (
  select ('80000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
  from generate_series(1, 8) as n
);

delete from auth.users
where id in (
  '90000000-0000-0000-0000-000000000001'::uuid,
  '90000000-0000-0000-0000-000000000002'::uuid,
  '80000000-0000-0000-0000-000000000001'::uuid,
  '80000000-0000-0000-0000-000000000002'::uuid,
  '80000000-0000-0000-0000-000000000003'::uuid,
  '80000000-0000-0000-0000-000000000004'::uuid,
  '80000000-0000-0000-0000-000000000005'::uuid,
  '80000000-0000-0000-0000-000000000006'::uuid,
  '80000000-0000-0000-0000-000000000007'::uuid,
  '80000000-0000-0000-0000-000000000008'::uuid
);

-- Demo auth identities without passwords. These support FK-backed profiles but
-- are not sign-in credentials.
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.admin@woodberry.example.test', '2026-01-02 08:00:00+00', '{"provider":"email","providers":["email"]}', '{"demo":true,"name":"Demo Admin"}', '2026-01-02 08:00:00+00', now()),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.staff@woodberry.example.test', '2026-01-02 08:15:00+00', '{"provider":"email","providers":["email"]}', '{"demo":true,"name":"Demo Staff"}', '2026-01-02 08:15:00+00', now()),
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.maria.santos@woodberry.example.test', '2025-07-15 08:00:00+00', '{"provider":"email","providers":["email"]}', '{"demo":true,"name":"Maria Santos"}', '2025-07-15 08:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.jose.reyes@woodberry.example.test', '2025-07-16 09:00:00+00', '{"provider":"email","providers":["email"]}', '{"demo":true,"name":"Jose Reyes"}', '2025-07-16 09:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.ana.cruz@woodberry.example.test', '2025-07-17 10:00:00+00', '{"provider":"email","providers":["email"]}', '{"demo":true,"name":"Ana Cruz"}', '2025-07-17 10:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.rafael.lim@woodberry.example.test', '2025-07-18 11:00:00+00', '{"provider":"email","providers":["email"]}', '{"demo":true,"name":"Rafael Lim"}', '2025-07-18 11:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.bianca.tan@woodberry.example.test', '2025-07-19 12:00:00+00', '{"provider":"email","providers":["email"]}', '{"demo":true,"name":"Bianca Tan"}', '2025-07-19 12:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.carlo.dizon@woodberry.example.test', '2025-07-20 13:00:00+00', '{"provider":"email","providers":["email"]}', '{"demo":true,"name":"Carlo Dizon"}', '2025-07-20 13:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.grace.flores@woodberry.example.test', '2025-07-21 14:00:00+00', '{"provider":"email","providers":["email"]}', '{"demo":true,"name":"Grace Flores"}', '2025-07-21 14:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'demo.paolo.garcia@woodberry.example.test', '2025-07-22 15:00:00+00', '{"provider":"email","providers":["email"]}', '{"demo":true,"name":"Paolo Garcia"}', '2025-07-22 15:00:00+00', now())
on conflict (id) do update
set email = excluded.email,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now();

insert into public.admins (id, email, first_name, last_name, role, created_at, updated_at)
values
  ('90000000-0000-0000-0000-000000000001', 'demo.admin@woodberry.example.test', '[DEMO]', 'Presentation Admin', 'admin', '2026-01-02 08:00:00+00', now())
on conflict (id) do update
set email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    role = excluded.role,
    updated_at = now();

insert into public.customers (
  id, email, first_name, last_name, phone, address,
  email_notifications_enabled, sms_notifications_enabled, created_at, updated_at
)
values
  ('80000000-0000-0000-0000-000000000001', 'demo.maria.santos@woodberry.example.test', 'Maria', 'Santos [DEMO]', '+639171110001', 'Quezon City, Metro Manila', true, true, '2025-07-15 08:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000002', 'demo.jose.reyes@woodberry.example.test', 'Jose', 'Reyes [DEMO]', '+639171110002', 'Antipolo, Rizal', true, true, '2025-07-16 09:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000003', 'demo.ana.cruz@woodberry.example.test', 'Ana', 'Cruz [DEMO]', '+639171110003', 'Marikina City', true, false, '2025-07-17 10:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000004', 'demo.rafael.lim@woodberry.example.test', 'Rafael', 'Lim [DEMO]', '+639171110004', 'Pasig City', true, true, '2025-07-18 11:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000005', 'demo.bianca.tan@woodberry.example.test', 'Bianca', 'Tan [DEMO]', '+639171110005', 'San Mateo, Rizal', false, true, '2025-07-19 12:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000006', 'demo.carlo.dizon@woodberry.example.test', 'Carlo', 'Dizon [DEMO]', '+639171110006', 'Mandaluyong City', true, true, '2025-07-20 13:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000007', 'demo.grace.flores@woodberry.example.test', 'Grace', 'Flores [DEMO]', '+639171110007', 'Cainta, Rizal', true, true, '2025-07-21 14:00:00+00', now()),
  ('80000000-0000-0000-0000-000000000008', 'demo.paolo.garcia@woodberry.example.test', 'Paolo', 'Garcia [DEMO]', '+639171110008', 'Makati City', true, true, '2025-07-22 15:00:00+00', now())
on conflict (id) do update
set email = excluded.email,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone = excluded.phone,
    address = excluded.address,
    email_notifications_enabled = excluded.email_notifications_enabled,
    sms_notifications_enabled = excluded.sms_notifications_enabled,
    updated_at = now();

insert into public.venues (
  id, name, description, location, capacity, price_per_night, image_url, is_active, created_at, updated_at
)
values
  ('20000000-0000-0000-0000-000000000001', '[DEMO] Grand Banquet Hall', 'Air-conditioned indoor hall for formal receptions, seminars, and plated dinners.', 'Main Building', 220, 45000, '/woodbery_pics/property_photos/day/banquet_1.jpg', true, '2025-07-20 08:00:00+00', now()),
  ('20000000-0000-0000-0000-000000000002', '[DEMO] Garden Pavilion', 'Open garden-side pavilion suited to birthdays, reunions, and cocktails.', 'Garden Area', 160, 28000, '/woodbery_pics/property_photos/day/tables_1.jpg', true, '2025-07-20 08:05:00+00', now()),
  ('20000000-0000-0000-0000-000000000003', '[DEMO] Poolside Stage', 'Outdoor pool deck and stage for casual celebrations and evening programs.', 'Pool Area', 120, 32000, '/woodbery_pics/property_photos/night/Pool Stage Night.jpg', true, '2025-07-20 08:10:00+00', now()),
  ('20000000-0000-0000-0000-000000000004', '[DEMO] Staycation Room Cluster', 'Cluster of private rooms used for family stays and retreat packages.', 'Rooms Wing', 32, 18000, '/woodbery_pics/property_photos/rooms/Room 1/Room 1 Main Bed.jpg', true, '2025-07-20 08:15:00+00', now()),
  ('20000000-0000-0000-0000-000000000005', '[DEMO] Forest View Pavilion', 'Quiet covered venue for retreats, meetings, and intimate programs.', 'Tree House Area', 90, 24000, '/woodbery_pics/property_photos/day/tree_house.jpg', true, '2025-07-20 08:20:00+00', now()),
  ('20000000-0000-0000-0000-000000000006', '[DEMO] CRUD Sandbox Lawn', 'Unbooked demo venue reserved for create, edit, deactivate, and delete walkthroughs.', 'Admin Demo Area', 60, 12000, '/woodbery_pics/property_photos/day/pool_and_house.jpg', true, '2025-07-20 08:25:00+00', now())
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    location = excluded.location,
    capacity = excluded.capacity,
    price_per_night = excluded.price_per_night,
    image_url = excluded.image_url,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.packages (
  id, name, description, price, inclusions, min_pax, max_pax, duration_label,
  time_options, included_facilities, rules, venue_id, thumbnail_url, booking_options,
  is_active, created_at, updated_at
)
values
  ('30000000-0000-0000-0000-000000000001', '[DEMO] Classic Wedding Celebration', 'Full reception package using the banquet hall and garden photo area.', 125000, 'Venue styling, buffet coordination, basic lights, ingress support', 80, 220, '8 hours', '{"mode":"fixed_range","from_time":"14:00","to_time":"22:00"}', '["Banquet Hall","Garden Pavilion","Basic lights"]', '{"event_types":["wedding","debut"]}', '20000000-0000-0000-0000-000000000001', '/woodbery_pics/events/wedding_celebration/wedding_celeb_main_photo_1.jpg', '{"isMultiDay":null,"eventType":{"value":"wedding","locked":true},"customEventType":null,"rooms":[],"roomExtensionHours":null,"addOns":[{"key":"lights","locked":true,"included":true}],"extensions":[],"corkage":[],"lockouts":{"sections":[],"eventTypes":["corporate"],"rooms":[],"roomExtensionHours":false,"addOns":[],"extensions":[],"corkage":[]}}', true, '2025-07-20 09:00:00+00', now()),
  ('30000000-0000-0000-0000-000000000002', '[DEMO] Poolside Birthday Party', 'Poolside celebration with pavilion dining and evening stage access.', 68000, 'Pool use, pavilion tables, sound system allowance, cleaning fee', 40, 140, '6 hours', '{"mode":"range_duration","from_time":"10:00","to_time":"22:00","hours":6}', '["Poolside Stage","Garden Pavilion"]', '{"event_types":["birthday","family-gathering","reunion"]}', '20000000-0000-0000-0000-000000000003', '/woodbery_pics/events/pink_birthday_party/pink_party_main_photo_1.jpg', '{"isMultiDay":null,"eventType":{"value":"birthday","locked":true},"customEventType":null,"rooms":[],"roomExtensionHours":null,"addOns":[{"key":"videoke","locked":false,"included":true}],"extensions":[{"key":"pavilion-pool","quantity":1,"locked":false,"included":false}],"corkage":[],"lockouts":{"sections":[],"eventTypes":[],"rooms":[],"roomExtensionHours":false,"addOns":[],"extensions":[],"corkage":[]}}', true, '2025-07-20 09:10:00+00', now()),
  ('30000000-0000-0000-0000-000000000003', '[DEMO] Corporate Retreat Staycation', 'Day program plus room cluster for small company planning sessions.', 98000, 'Room cluster, pavilion meeting setup, projector, breakfast coordination', 18, 50, '2 days / 1 night', '{"mode":"duration","hours":30}', '["Staycation Room Cluster","Forest View Pavilion"]', '{"event_types":["corporate","conference","staycation"]}', '20000000-0000-0000-0000-000000000004', '/woodbery_pics/rate_pamphlets/Staycation Packages.jpg', '{"isMultiDay":{"selected":true,"locked":true},"eventType":{"value":"corporate","locked":false},"customEventType":null,"rooms":[{"key":"room-1","locked":true,"included":true},{"key":"room-2","locked":true,"included":true}],"roomExtensionHours":null,"addOns":[{"key":"projector","locked":true,"included":true}],"extensions":[],"corkage":[],"lockouts":{"sections":[],"eventTypes":[],"rooms":["room-5","room-6"],"roomExtensionHours":false,"addOns":[],"extensions":[],"corkage":[]}}', true, '2025-07-20 09:20:00+00', now()),
  ('30000000-0000-0000-0000-000000000004', '[DEMO] Intimate Lunch Package', 'Midday package for reunions, baptisms, and small receptions.', 42000, 'Lunch service window, basic table setup, venue coordination', 25, 90, '4 hours', '{"mode":"fixed_range","from_time":"11:00","to_time":"15:00"}', '["Grand Banquet Hall"]', '{"event_types":["reunion","family-gathering","private-event"]}', '20000000-0000-0000-0000-000000000001', '/woodbery_pics/events/blue_lunch/blue_lunch_hall_1.jpg', '{"isMultiDay":null,"eventType":null,"customEventType":null,"rooms":[],"roomExtensionHours":null,"addOns":[],"extensions":[],"corkage":[],"lockouts":{"sections":[],"eventTypes":[],"rooms":[],"roomExtensionHours":false,"addOns":[],"extensions":[],"corkage":[]}}', true, '2025-07-20 09:30:00+00', now()),
  ('30000000-0000-0000-0000-000000000005', '[DEMO] Debut Evening Package', 'Debut program with indoor stage, buffet lane, and poolside photo access.', 88000, 'Stage, buffet coordination, poolside photo access, basic sound system', 60, 180, '7 hours', '{"mode":"range_duration","from_time":"15:00","to_time":"23:00","hours":7}', '["Grand Banquet Hall","Poolside Stage"]', '{"event_types":["debut","birthday"]}', '20000000-0000-0000-0000-000000000001', '/woodbery_pics/events/debut/debut_main_stage_photo_1.jpg', '{"isMultiDay":null,"eventType":{"value":"debut","locked":true},"customEventType":null,"rooms":[],"roomExtensionHours":null,"addOns":[{"key":"lights","locked":false,"included":true}],"extensions":[],"corkage":[],"lockouts":{"sections":[],"eventTypes":[],"rooms":[],"roomExtensionHours":false,"addOns":[],"extensions":[],"corkage":[]}}', true, '2025-07-20 09:40:00+00', now()),
  ('30000000-0000-0000-0000-000000000006', '[DEMO] CRUD Sandbox Package', 'Unbooked demo package for admin create, edit, deactivate, assignment, and delete walkthroughs.', 15000, 'Sandbox package only; no live reservations reference this row.', 10, 60, '3 hours', '{"mode":"duration","hours":3}', '["CRUD Sandbox Lawn"]', '{"event_types":["private-event"]}', '20000000-0000-0000-0000-000000000006', '/woodbery_pics/property_photos/day/bench.jpg', '{"isMultiDay":null,"eventType":{"value":"private-event","locked":false},"customEventType":null,"rooms":[],"roomExtensionHours":null,"addOns":[],"extensions":[],"corkage":[],"lockouts":{"sections":[],"eventTypes":[],"rooms":[],"roomExtensionHours":false,"addOns":[],"extensions":[],"corkage":[]}}', true, '2025-07-20 09:50:00+00', now())
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    price = excluded.price,
    inclusions = excluded.inclusions,
    min_pax = excluded.min_pax,
    max_pax = excluded.max_pax,
    duration_label = excluded.duration_label,
    time_options = excluded.time_options,
    included_facilities = excluded.included_facilities,
    rules = excluded.rules,
    venue_id = excluded.venue_id,
    thumbnail_url = excluded.thumbnail_url,
    booking_options = excluded.booking_options,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.package_venue_assignments (package_id, venue_id)
values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000004'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006')
on conflict (package_id, venue_id) do nothing;

insert into public.package_venues (package_id, name, description, capacity, image_url, is_active)
values
  ('30000000-0000-0000-0000-000000000001', '[DEMO] Hall reception layout', 'Sample package venue card for hall receptions.', 220, '/woodbery_pics/property_photos/day/filled_banquet_1.jpg', true),
  ('30000000-0000-0000-0000-000000000002', '[DEMO] Poolside dining setup', 'Sample package venue card for poolside birthdays.', 140, '/woodbery_pics/property_photos/day/Swimming_Pool_2.jpg', true),
  ('30000000-0000-0000-0000-000000000003', '[DEMO] Retreat room cluster', 'Sample package venue card for staycation retreats.', 32, '/woodbery_pics/property_photos/rooms/Room 3/Room 3 Main bed.jpg', true)
on conflict do nothing;

-- Booking rows. February 2026 is intentionally absent, yielding a zero month
-- in the forecasting data between the first and latest history months.
insert into public.bookings (
  id, user_id, venue_id, full_name, email, phone,
  email_notifications_enabled, sms_notifications_enabled,
  pax, event_date, start_date, end_date, start_datetime, end_datetime,
  package_id, event_type, special_requests, total_price, status,
  status_updated_at, confirmed_at, cancelled_at, rescheduled_at,
  created_at, updated_at, address, caterer, use_woodberry_caterer,
  package_type, package_price, package_inclusions, rooms_count, selected_rooms,
  facility_time_ranges, additionals, add_ons, extension_selections,
  corkage_selections, estimate_summary, quotation_status, quotation_finalized_at,
  minimum_payment_amount, remaining_balance_amount, terms_accepted_at,
  payment_status, down_payment_amount, amount_paid, balance_due, submission_key,
  reservation_created_at, reservation_expires_at, reservation_expired_at,
  cancellation_reason, cancellation_source
)
values
  ('10000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Maria Santos [DEMO]','demo.maria.santos@woodberry.example.test','+639171110001',true,true,120,'2025-09-27','2025-09-27','2025-09-27','2025-09-27 14:00:00','2025-09-27 22:00:00','30000000-0000-0000-0000-000000000001','Wedding','DEMO_PRESENTATION history: wedding reception',125000,'completed','2025-09-28 02:00:00+00','2025-08-05 08:20:00+00',null,null,'2025-08-05 08:15:00+00','2025-09-28 02:00:00+00','Quezon City','Woodberry Catering',true,'demo-wedding-celebration',125000,'["Venue styling","Buffet coordination"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":53,"demo":true}','not_required',null,62500,0,'2025-08-05 08:15:00+00','paid',62500,125000,0,'DEMO-PRES-0001','2025-08-05 08:15:00+00','2025-08-07 08:15:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','Jose Reyes [DEMO]','demo.jose.reyes@woodberry.example.test','+639171110002',true,true,75,'2025-09-06','2025-09-06','2025-09-06','2025-09-06 15:00:00','2025-09-06 21:00:00','30000000-0000-0000-0000-000000000002','Birthday Party','DEMO_PRESENTATION history: cancelled birthday due weather',68000,'cancelled','2025-08-18 05:00:00+00',null,'2025-08-18 05:00:00+00',null,'2025-08-12 10:30:00+00','2025-08-18 05:00:00+00','Antipolo','Client Caterer',false,'demo-poolside-birthday',68000,'["Pool use","Pavilion tables"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":25,"demo":true}', 'not_required',null,34000,68000,'2025-08-12 10:30:00+00','partial',34000,34000,34000,'DEMO-PRES-0002','2025-08-12 10:30:00+00','2025-08-14 10:30:00+00',null,'Family emergency; refund review requested','customer_manual'),
  ('10000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004','Ana Cruz [DEMO]','demo.ana.cruz@woodberry.example.test','+639171110003',true,false,24,'2025-10-12','2025-10-11','2025-10-12','2025-10-11 12:00:00','2025-10-12 18:00:00','30000000-0000-0000-0000-000000000003','Corporate Event','DEMO_PRESENTATION history: completed retreat',98000,'completed','2025-10-13 02:00:00+00','2025-08-24 09:45:00+00',null,null,'2025-08-24 09:40:00+00','2025-10-13 02:00:00+00','Marikina','Woodberry Catering',true,'demo-corporate-retreat',98000,'["Rooms","Pavilion meeting setup"]',2,'["room-1","room-2"]','[]','[]','[{"key":"projector"}]','[]','[]','{"lead_days":48,"demo":true}','not_required',null,49000,0,'2025-08-24 09:40:00+00','paid',49000,98000,0,'DEMO-PRES-0003','2025-08-24 09:40:00+00','2025-08-26 09:40:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000004','80000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','Rafael Lim [DEMO]','demo.rafael.lim@woodberry.example.test','+639171110004',true,true,88,'2025-10-18','2025-10-18','2025-10-18','2025-10-18 11:00:00','2025-10-18 15:00:00','30000000-0000-0000-0000-000000000004','Family Gathering','DEMO_PRESENTATION history: lunch reunion',42000,'completed','2025-10-18 23:00:00+00','2025-09-02 06:10:00+00',null,null,'2025-09-02 06:00:00+00','2025-10-18 23:00:00+00','Pasig City','Client Caterer',false,'demo-intimate-lunch',42000,'["Lunch service","Table setup"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":46,"demo":true}','not_required',null,21000,0,'2025-09-02 06:00:00+00','paid',21000,42000,0,'DEMO-PRES-0004','2025-09-02 06:00:00+00','2025-09-04 06:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','Bianca Tan [DEMO]','demo.bianca.tan@woodberry.example.test','+639171110005',false,true,155,'2025-10-26','2025-10-26','2025-10-26','2025-10-26 15:00:00','2025-10-26 22:00:00','30000000-0000-0000-0000-000000000005','Debut','DEMO_PRESENTATION history: debut evening',88000,'completed','2025-10-27 02:00:00+00','2025-09-06 03:20:00+00',null,null,'2025-09-06 03:00:00+00','2025-10-27 02:00:00+00','San Mateo','Woodberry Catering',true,'demo-debut-evening',88000,'["Stage","Sound system"]',0,'[]','[]','[]','[{"key":"lights"}]','[]','[]','{"lead_days":50,"demo":true}','not_required',null,44000,0,'2025-09-06 03:00:00+00','paid',44000,88000,0,'DEMO-PRES-0005','2025-09-06 03:00:00+00','2025-09-08 03:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000006','80000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000002','Carlo Dizon [DEMO]','demo.carlo.dizon@woodberry.example.test','+639171110006',true,true,42,'2025-10-03','2025-10-03','2025-10-03','2025-10-03 13:00:00','2025-10-03 19:00:00',null,'Private Event','DEMO_PRESENTATION history: custom garden dinner finalized',57000,'completed','2025-10-04 02:00:00+00','2025-09-10 02:25:00+00',null,null,'2025-09-08 04:00:00+00','2025-10-04 02:00:00+00','Mandaluyong','Client Caterer',false,'custom-booking',null,'[]',0,'[]','[]','[{"item":"Extra floral arch","amount":8000}]','[]','[]','[]','{"lead_days":25,"quote":"finalized","demo":true}','finalized','2025-09-10 02:00:00+00',28500,0,'2025-09-08 04:00:00+00','paid',28500,57000,0,'DEMO-PRES-0006','2025-09-10 02:00:00+00','2025-09-12 02:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000007','80000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000003','Grace Flores [DEMO]','demo.grace.flores@woodberry.example.test','+639171110007',true,true,60,'2025-10-30','2025-10-30','2025-10-30','2025-10-30 16:00:00','2025-10-30 22:00:00','30000000-0000-0000-0000-000000000002','Birthday Party','DEMO_PRESENTATION history: unpaid hold expired and cancelled',68000,'cancelled','2025-09-13 08:00:00+00',null,'2025-09-13 08:00:00+00',null,'2025-09-11 08:00:00+00','2025-09-13 08:00:00+00','Cainta','Client Caterer',false,'demo-poolside-birthday',68000,'["Pool use","Pavilion tables"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":49,"demo":true}','not_required',null,34000,68000,'2025-09-11 08:00:00+00','unpaid',34000,0,68000,'DEMO-PRES-0007','2025-09-11 08:00:00+00','2025-09-13 08:00:00+00','2025-09-13 08:00:00+00','Payment window expired','system'),
  ('10000000-0000-0000-0000-000000000008','80000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000001','Paolo Garcia [DEMO]','demo.paolo.garcia@woodberry.example.test','+639171110008',true,true,35,'2025-11-15','2025-11-15','2025-11-15','2025-11-15 11:00:00','2025-11-15 15:00:00','30000000-0000-0000-0000-000000000004','Reunion','DEMO_PRESENTATION history: lunch reunion',42000,'completed','2025-11-16 01:00:00+00','2025-09-21 07:10:00+00',null,null,'2025-09-21 07:00:00+00','2025-11-16 01:00:00+00','Makati','Woodberry Catering',true,'demo-intimate-lunch',42000,'["Lunch service","Table setup"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":55,"demo":true}','not_required',null,21000,0,'2025-09-21 07:00:00+00','paid',21000,42000,0,'DEMO-PRES-0008','2025-09-21 07:00:00+00','2025-09-23 07:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000009','80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Maria Santos [DEMO]','demo.maria.santos@woodberry.example.test','+639171110001',true,true,48,'2025-10-20','2025-10-20','2025-10-20','2025-10-20 10:00:00','2025-10-20 16:00:00',null,'Private Event','DEMO_PRESENTATION history: custom quotation cancelled before finalization',0,'cancelled','2025-09-25 04:00:00+00',null,'2025-09-25 04:00:00+00',null,'2025-09-24 02:00:00+00','2025-09-25 04:00:00+00','Quezon City','Client Caterer',false,'custom-booking',null,'[]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":26,"quote":"pending","demo":true}','pending',null,0,0,'2025-09-24 02:00:00+00','unpaid',0,0,0,'DEMO-PRES-0009','2025-09-24 02:00:00+00',null,null,'Client changed scope before quote finalization','customer_manual'),
  ('10000000-0000-0000-0000-000000000010','80000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000004','Jose Reyes [DEMO]','demo.jose.reyes@woodberry.example.test','+639171110002',true,true,20,'2025-12-13','2025-12-12','2025-12-13','2025-12-12 12:00:00','2025-12-13 18:00:00','30000000-0000-0000-0000-000000000003','Staycation','DEMO_PRESENTATION history: retreat',98000,'completed','2025-12-14 03:00:00+00','2025-10-04 09:10:00+00',null,null,'2025-10-04 09:00:00+00','2025-12-14 03:00:00+00','Antipolo','Woodberry Catering',true,'demo-corporate-retreat',98000,'["Rooms","Pavilion meeting setup"]',2,'["room-1","room-2"]','[]','[]','[{"key":"projector"}]','[]','[]','{"lead_days":69,"demo":true}','not_required',null,49000,0,'2025-10-04 09:00:00+00','paid',49000,98000,0,'DEMO-PRES-0010','2025-10-04 09:00:00+00','2025-10-06 09:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000011','80000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','Ana Cruz [DEMO]','demo.ana.cruz@woodberry.example.test','+639171110003',true,false,130,'2025-12-20','2025-12-20','2025-12-20','2025-12-20 14:00:00','2025-12-20 22:00:00','30000000-0000-0000-0000-000000000001','Wedding','DEMO_PRESENTATION history: wedding partial balance due',125000,'completed','2025-12-21 02:00:00+00','2025-10-16 11:20:00+00',null,null,'2025-10-16 11:15:00+00','2025-12-21 02:00:00+00','Marikina','Woodberry Catering',true,'demo-wedding-celebration',125000,'["Venue styling","Buffet coordination"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":65,"demo":true}','not_required',null,62500,45000,'2025-10-16 11:15:00+00','partial',62500,80000,45000,'DEMO-PRES-0011','2025-10-16 11:15:00+00','2025-10-18 11:15:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000012','80000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000003','Rafael Lim [DEMO]','demo.rafael.lim@woodberry.example.test','+639171110004',true,true,95,'2025-11-29','2025-11-29','2025-11-29','2025-11-29 15:00:00','2025-11-29 21:00:00','30000000-0000-0000-0000-000000000002','Birthday Party','DEMO_PRESENTATION history: poolside party',68000,'completed','2025-11-30 01:00:00+00','2025-11-03 04:05:00+00',null,null,'2025-11-03 04:00:00+00','2025-11-30 01:00:00+00','Pasig City','Client Caterer',false,'demo-poolside-birthday',68000,'["Pool use","Pavilion tables"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":26,"demo":true}','not_required',null,34000,0,'2025-11-03 04:00:00+00','paid',34000,68000,0,'DEMO-PRES-0012','2025-11-03 04:00:00+00','2025-11-05 04:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000013','80000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','Bianca Tan [DEMO]','demo.bianca.tan@woodberry.example.test','+639171110005',false,true,70,'2025-12-06','2025-12-06','2025-12-06','2025-12-06 15:00:00','2025-12-06 22:00:00','30000000-0000-0000-0000-000000000005','Debut','DEMO_PRESENTATION history: debut',88000,'completed','2025-12-07 02:00:00+00','2025-11-09 06:00:00+00',null,null,'2025-11-09 05:50:00+00','2025-12-07 02:00:00+00','San Mateo','Woodberry Catering',true,'demo-debut-evening',88000,'["Stage","Sound system"]',0,'[]','[]','[]','[{"key":"lights"}]','[]','[]','{"lead_days":27,"demo":true}','not_required',null,44000,0,'2025-11-09 05:50:00+00','paid',44000,88000,0,'DEMO-PRES-0013','2025-11-09 05:50:00+00','2025-11-11 05:50:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000014','80000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000005','Carlo Dizon [DEMO]','demo.carlo.dizon@woodberry.example.test','+639171110006',true,true,55,'2025-12-18','2025-12-18','2025-12-18','2025-12-18 10:00:00','2025-12-18 17:00:00',null,'Conference','DEMO_PRESENTATION history: custom finalized seminar',73500,'completed','2025-12-19 01:00:00+00','2025-11-14 07:30:00+00',null,null,'2025-11-12 03:30:00+00','2025-12-19 01:00:00+00','Mandaluyong','Woodberry Catering',true,'custom-booking',null,'[]',0,'[]','[]','[{"item":"Workshop kit","amount":6500}]','[{"key":"projector"}]','[]','[]','{"lead_days":36,"quote":"finalized","demo":true}','finalized','2025-11-14 07:00:00+00',36750,0,'2025-11-12 03:30:00+00','paid',36750,73500,0,'DEMO-PRES-0014','2025-11-14 07:00:00+00','2025-11-16 07:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000015','80000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000001','Grace Flores [DEMO]','demo.grace.flores@woodberry.example.test','+639171110007',true,true,45,'2025-12-28','2025-12-28','2025-12-28','2025-12-28 11:00:00','2025-12-28 15:00:00','30000000-0000-0000-0000-000000000004','Family Gathering','DEMO_PRESENTATION history: holiday lunch',42000,'completed','2025-12-29 01:00:00+00','2025-11-22 02:30:00+00',null,null,'2025-11-22 02:15:00+00','2025-12-29 01:00:00+00','Cainta','Client Caterer',false,'demo-intimate-lunch',42000,'["Lunch service","Table setup"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":36,"demo":true}','not_required',null,21000,0,'2025-11-22 02:15:00+00','paid',21000,42000,0,'DEMO-PRES-0015','2025-11-22 02:15:00+00','2025-11-24 02:15:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000016','80000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000003','Paolo Garcia [DEMO]','demo.paolo.garcia@woodberry.example.test','+639171110008',true,true,110,'2025-12-31','2025-12-31','2025-12-31','2025-12-31 15:00:00','2025-12-31 21:00:00','30000000-0000-0000-0000-000000000002','Reunion','DEMO_PRESENTATION history: year-end party',68000,'completed','2026-01-01 01:00:00+00','2025-11-28 08:20:00+00',null,null,'2025-11-28 08:00:00+00','2026-01-01 01:00:00+00','Makati','Woodberry Catering',true,'demo-poolside-birthday',68000,'["Pool use","Pavilion tables"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":33,"demo":true}','not_required',null,34000,0,'2025-11-28 08:00:00+00','paid',34000,68000,0,'DEMO-PRES-0016','2025-11-28 08:00:00+00','2025-11-30 08:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000017','80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Maria Santos [DEMO]','demo.maria.santos@woodberry.example.test','+639171110001',true,true,180,'2026-02-14','2026-02-14','2026-02-14','2026-02-14 14:00:00','2026-02-14 22:00:00','30000000-0000-0000-0000-000000000001','Wedding','DEMO_PRESENTATION history: high-season wedding',125000,'completed','2026-02-15 01:00:00+00','2025-12-02 05:00:00+00',null,null,'2025-12-02 04:50:00+00','2026-02-15 01:00:00+00','Quezon City','Woodberry Catering',true,'demo-wedding-celebration',125000,'["Venue styling","Buffet coordination"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":74,"demo":true}','not_required',null,62500,0,'2025-12-02 04:50:00+00','paid',62500,125000,0,'DEMO-PRES-0017','2025-12-02 04:50:00+00','2025-12-04 04:50:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000018','80000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','Jose Reyes [DEMO]','demo.jose.reyes@woodberry.example.test','+639171110002',true,true,80,'2026-01-24','2026-01-24','2026-01-24','2026-01-24 14:00:00','2026-01-24 20:00:00','30000000-0000-0000-0000-000000000002','Birthday Party','DEMO_PRESENTATION history: birthday',68000,'completed','2026-01-25 01:00:00+00','2025-12-06 05:00:00+00',null,null,'2025-12-06 04:30:00+00','2026-01-25 01:00:00+00','Antipolo','Client Caterer',false,'demo-poolside-birthday',68000,'["Pool use","Pavilion tables"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":49,"demo":true}','not_required',null,34000,0,'2025-12-06 04:30:00+00','paid',34000,68000,0,'DEMO-PRES-0018','2025-12-06 04:30:00+00','2025-12-08 04:30:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000019','80000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000005','Ana Cruz [DEMO]','demo.ana.cruz@woodberry.example.test','+639171110003',true,false,35,'2026-01-30','2026-01-30','2026-01-30','2026-01-30 10:00:00','2026-01-30 16:00:00',null,'Private Event','DEMO_PRESENTATION history: custom private dinner',62000,'completed','2026-01-31 01:00:00+00','2025-12-10 05:20:00+00',null,null,'2025-12-08 05:00:00+00','2026-01-31 01:00:00+00','Marikina','Woodberry Catering',true,'custom-booking',null,'[]',0,'[]','[]','[{"item":"Garden florals","amount":7000}]','[]','[]','[]','{"lead_days":53,"quote":"finalized","demo":true}','finalized','2025-12-10 05:00:00+00',31000,0,'2025-12-08 05:00:00+00','paid',31000,62000,0,'DEMO-PRES-0019','2025-12-10 05:00:00+00','2025-12-12 05:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000020','80000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','Rafael Lim [DEMO]','demo.rafael.lim@woodberry.example.test','+639171110004',true,true,60,'2026-02-01','2026-02-01','2026-02-01','2026-02-01 11:00:00','2026-02-01 15:00:00','30000000-0000-0000-0000-000000000004','Family Gathering','DEMO_PRESENTATION history: cancelled lunch with forfeited deposit',42000,'cancelled','2025-12-15 07:00:00+00',null,'2025-12-15 07:00:00+00',null,'2025-12-14 03:00:00+00','2025-12-15 07:00:00+00','Pasig City','Client Caterer',false,'demo-intimate-lunch',42000,'["Lunch service","Table setup"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":49,"demo":true}','not_required',null,21000,21000,'2025-12-14 03:00:00+00','partial',21000,21000,21000,'DEMO-PRES-0020','2025-12-14 03:00:00+00','2025-12-16 03:00:00+00',null,'Cancelled after supplier conflict','admin_manual'),
  ('10000000-0000-0000-0000-000000000021','80000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000004','Bianca Tan [DEMO]','demo.bianca.tan@woodberry.example.test','+639171110005',false,true,22,'2026-02-21','2026-02-20','2026-02-21','2026-02-20 12:00:00','2026-02-21 18:00:00','30000000-0000-0000-0000-000000000003','Corporate Event','DEMO_PRESENTATION history: retreat completed',98000,'completed','2026-02-22 02:00:00+00','2025-12-18 09:00:00+00',null,null,'2025-12-18 08:45:00+00','2026-02-22 02:00:00+00','San Mateo','Woodberry Catering',true,'demo-corporate-retreat',98000,'["Rooms","Pavilion meeting setup"]',2,'["room-1","room-2"]','[]','[]','[{"key":"projector"}]','[]','[]','{"lead_days":64,"demo":true}','not_required',null,49000,0,'2025-12-18 08:45:00+00','paid',49000,98000,0,'DEMO-PRES-0021','2025-12-18 08:45:00+00','2025-12-20 08:45:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000022','80000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000001','Carlo Dizon [DEMO]','demo.carlo.dizon@woodberry.example.test','+639171110006',true,true,140,'2026-03-07','2026-03-07','2026-03-07','2026-03-07 15:00:00','2026-03-07 22:00:00','30000000-0000-0000-0000-000000000005','Debut','DEMO_PRESENTATION history: debut completed',88000,'completed','2026-03-08 02:00:00+00','2025-12-22 02:00:00+00',null,null,'2025-12-22 01:50:00+00','2026-03-08 02:00:00+00','Mandaluyong','Woodberry Catering',true,'demo-debut-evening',88000,'["Stage","Sound system"]',0,'[]','[]','[]','[{"key":"lights"}]','[]','[]','{"lead_days":75,"demo":true}','not_required',null,44000,0,'2025-12-22 01:50:00+00','paid',44000,88000,0,'DEMO-PRES-0022','2025-12-22 01:50:00+00','2025-12-24 01:50:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000023','80000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000002','Grace Flores [DEMO]','demo.grace.flores@woodberry.example.test','+639171110007',true,true,38,'2026-02-28','2026-02-28','2026-02-28','2026-02-28 10:00:00','2026-02-28 16:00:00',null,'Private Event','DEMO_PRESENTATION low-month custom completed',51000,'completed','2026-03-01 01:00:00+00','2026-01-11 04:00:00+00',null,null,'2026-01-08 04:00:00+00','2026-03-01 01:00:00+00','Cainta','Client Caterer',false,'custom-booking',null,'[]',0,'[]','[]','[{"item":"String lights","amount":4500}]','[]','[]','[]','{"lead_days":51,"quote":"finalized","demo":true}','finalized','2026-01-11 04:00:00+00',25500,0,'2026-01-08 04:00:00+00','paid',25500,51000,0,'DEMO-PRES-0023','2026-01-11 04:00:00+00','2026-01-13 04:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000024','80000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000001','Paolo Garcia [DEMO]','demo.paolo.garcia@woodberry.example.test','+639171110008',true,true,90,'2026-04-05','2026-04-05','2026-04-05','2026-04-05 11:00:00','2026-04-05 15:00:00','30000000-0000-0000-0000-000000000004','Reunion','DEMO_PRESENTATION history after zero-month gap',42000,'completed','2026-04-06 01:00:00+00','2026-03-03 06:10:00+00',null,null,'2026-03-03 06:00:00+00','2026-04-06 01:00:00+00','Makati','Woodberry Catering',true,'demo-intimate-lunch',42000,'["Lunch service","Table setup"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":33,"demo":true}','not_required',null,21000,0,'2026-03-03 06:00:00+00','paid',21000,42000,0,'DEMO-PRES-0024','2026-03-03 06:00:00+00','2026-03-05 06:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000025','80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','Maria Santos [DEMO]','demo.maria.santos@woodberry.example.test','+639171110001',true,true,70,'2026-04-12','2026-04-12','2026-04-12','2026-04-12 14:00:00','2026-04-12 20:00:00','30000000-0000-0000-0000-000000000002','Birthday Party','DEMO_PRESENTATION history: birthday completed',68000,'completed','2026-04-13 01:00:00+00','2026-03-08 04:40:00+00',null,null,'2026-03-08 04:30:00+00','2026-04-13 01:00:00+00','Quezon City','Client Caterer',false,'demo-poolside-birthday',68000,'["Pool use","Pavilion tables"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":35,"demo":true}','not_required',null,34000,0,'2026-03-08 04:30:00+00','paid',34000,68000,0,'DEMO-PRES-0025','2026-03-08 04:30:00+00','2026-03-10 04:30:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000026','80000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Jose Reyes [DEMO]','demo.jose.reyes@woodberry.example.test','+639171110002',true,true,52,'2026-04-18','2026-04-18','2026-04-18','2026-04-18 10:00:00','2026-04-18 16:00:00',null,'Private Event','DEMO_PRESENTATION history: custom pending quote cancelled',0,'cancelled','2026-03-10 05:00:00+00',null,'2026-03-10 05:00:00+00',null,'2026-03-09 03:00:00+00','2026-03-10 05:00:00+00','Antipolo','Client Caterer',false,'custom-booking',null,'[]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":40,"quote":"pending","demo":true}','pending',null,0,0,'2026-03-09 03:00:00+00','unpaid',0,0,0,'DEMO-PRES-0026','2026-03-09 03:00:00+00',null,null,'Quote no longer needed','customer_manual'),
  ('10000000-0000-0000-0000-000000000027','80000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004','Ana Cruz [DEMO]','demo.ana.cruz@woodberry.example.test','+639171110003',true,false,28,'2026-05-01','2026-04-30','2026-05-01','2026-04-30 12:00:00','2026-05-01 18:00:00','30000000-0000-0000-0000-000000000003','Corporate Event','DEMO_PRESENTATION history: retreat completed',98000,'completed','2026-05-02 01:00:00+00','2026-03-21 09:10:00+00',null,null,'2026-03-21 09:00:00+00','2026-05-02 01:00:00+00','Marikina','Woodberry Catering',true,'demo-corporate-retreat',98000,'["Rooms","Pavilion meeting setup"]',2,'["room-1","room-2"]','[]','[]','[{"key":"projector"}]','[]','[]','{"lead_days":40,"demo":true}','not_required',null,49000,0,'2026-03-21 09:00:00+00','paid',49000,98000,0,'DEMO-PRES-0027','2026-03-21 09:00:00+00','2026-03-23 09:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000028','80000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','Rafael Lim [DEMO]','demo.rafael.lim@woodberry.example.test','+639171110004',true,true,165,'2026-05-16','2026-05-16','2026-05-16','2026-05-16 14:00:00','2026-05-16 22:00:00','30000000-0000-0000-0000-000000000001','Wedding','DEMO_PRESENTATION history: wedding completed',125000,'completed','2026-05-17 01:00:00+00','2026-04-04 08:00:00+00',null,null,'2026-04-04 07:45:00+00','2026-05-17 01:00:00+00','Pasig City','Woodberry Catering',true,'demo-wedding-celebration',125000,'["Venue styling","Buffet coordination"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":42,"demo":true}','not_required',null,62500,0,'2026-04-04 07:45:00+00','paid',62500,125000,0,'DEMO-PRES-0028','2026-04-04 07:45:00+00','2026-04-06 07:45:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000029','80000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000003','Bianca Tan [DEMO]','demo.bianca.tan@woodberry.example.test','+639171110005',false,true,95,'2026-05-24','2026-05-24','2026-05-24','2026-05-24 15:00:00','2026-05-24 21:00:00','30000000-0000-0000-0000-000000000002','Birthday Party','DEMO_PRESENTATION history: birthday completed',68000,'completed','2026-05-25 01:00:00+00','2026-04-11 04:00:00+00',null,null,'2026-04-11 03:40:00+00','2026-05-25 01:00:00+00','San Mateo','Client Caterer',false,'demo-poolside-birthday',68000,'["Pool use","Pavilion tables"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":43,"demo":true}','not_required',null,34000,0,'2026-04-11 03:40:00+00','paid',34000,68000,0,'DEMO-PRES-0029','2026-04-11 03:40:00+00','2026-04-13 03:40:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000030','80000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000005','Carlo Dizon [DEMO]','demo.carlo.dizon@woodberry.example.test','+639171110006',true,true,40,'2026-06-06','2026-06-06','2026-06-06','2026-06-06 10:00:00','2026-06-06 16:00:00',null,'Private Event','DEMO_PRESENTATION history: custom completed',66000,'completed','2026-06-07 01:00:00+00','2026-04-19 06:00:00+00',null,null,'2026-04-16 06:00:00+00','2026-06-07 01:00:00+00','Mandaluyong','Woodberry Catering',true,'custom-booking',null,'[]',0,'[]','[]','[{"item":"Team-building facilitator","amount":9000}]','[]','[]','[]','{"lead_days":51,"quote":"finalized","demo":true}','finalized','2026-04-19 06:00:00+00',33000,0,'2026-04-16 06:00:00+00','paid',33000,66000,0,'DEMO-PRES-0030','2026-04-19 06:00:00+00','2026-04-21 06:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000031','80000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000001','Grace Flores [DEMO]','demo.grace.flores@woodberry.example.test','+639171110007',true,true,110,'2026-06-13','2026-06-13','2026-06-13','2026-06-13 15:00:00','2026-06-13 22:00:00','30000000-0000-0000-0000-000000000005','Debut','DEMO_PRESENTATION history: debut partial paid',88000,'completed','2026-06-14 01:00:00+00','2026-05-02 02:20:00+00',null,null,'2026-05-02 02:10:00+00','2026-06-14 01:00:00+00','Cainta','Woodberry Catering',true,'demo-debut-evening',88000,'["Stage","Sound system"]',0,'[]','[]','[]','[{"key":"lights"}]','[]','[]','{"lead_days":42,"demo":true}','not_required',null,44000,22000,'2026-05-02 02:10:00+00','partial',44000,66000,22000,'DEMO-PRES-0031','2026-05-02 02:10:00+00','2026-05-04 02:10:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000032','80000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000001','Paolo Garcia [DEMO]','demo.paolo.garcia@woodberry.example.test','+639171110008',true,true,58,'2026-06-21','2026-06-21','2026-06-21','2026-06-21 11:00:00','2026-06-21 15:00:00','30000000-0000-0000-0000-000000000004','Reunion','DEMO_PRESENTATION history: lunch completed',42000,'completed','2026-06-22 01:00:00+00','2026-05-09 05:05:00+00',null,null,'2026-05-09 05:00:00+00','2026-06-22 01:00:00+00','Makati','Client Caterer',false,'demo-intimate-lunch',42000,'["Lunch service","Table setup"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":43,"demo":true}','not_required',null,21000,0,'2026-05-09 05:00:00+00','paid',21000,42000,0,'DEMO-PRES-0032','2026-05-09 05:00:00+00','2026-05-11 05:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000033','80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004','Maria Santos [DEMO]','demo.maria.santos@woodberry.example.test','+639171110001',true,true,26,'2026-07-04','2026-07-03','2026-07-04','2026-07-03 12:00:00','2026-07-04 18:00:00','30000000-0000-0000-0000-000000000003','Corporate Event','DEMO_PRESENTATION high month retreat',98000,'completed','2026-07-05 01:00:00+00','2026-05-12 08:00:00+00',null,null,'2026-05-12 07:55:00+00','2026-07-05 01:00:00+00','Quezon City','Woodberry Catering',true,'demo-corporate-retreat',98000,'["Rooms","Pavilion meeting setup"]',2,'["room-1","room-2"]','[]','[]','[{"key":"projector"}]','[]','[]','{"lead_days":52,"demo":true}','not_required',null,49000,0,'2026-05-12 07:55:00+00','paid',49000,98000,0,'DEMO-PRES-0033','2026-05-12 07:55:00+00','2026-05-14 07:55:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000034','80000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Jose Reyes [DEMO]','demo.jose.reyes@woodberry.example.test','+639171110002',true,true,145,'2026-07-18','2026-07-18','2026-07-18','2026-07-18 14:00:00','2026-07-18 22:00:00','30000000-0000-0000-0000-000000000001','Wedding','DEMO_PRESENTATION high month wedding',125000,'completed','2026-07-19 01:00:00+00','2026-05-18 10:30:00+00',null,null,'2026-05-18 10:20:00+00','2026-07-19 01:00:00+00','Antipolo','Woodberry Catering',true,'demo-wedding-celebration',125000,'["Venue styling","Buffet coordination"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":61,"demo":true}','not_required',null,62500,0,'2026-05-18 10:20:00+00','paid',62500,125000,0,'DEMO-PRES-0034','2026-05-18 10:20:00+00','2026-05-20 10:20:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000035','80000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000003','Ana Cruz [DEMO]','demo.ana.cruz@woodberry.example.test','+639171110003',true,false,85,'2026-07-25','2026-07-25','2026-07-25','2026-07-25 14:00:00','2026-07-25 20:00:00','30000000-0000-0000-0000-000000000002','Birthday Party','DEMO_PRESENTATION high month birthday cancelled',68000,'cancelled','2026-05-22 04:00:00+00',null,'2026-05-22 04:00:00+00',null,'2026-05-21 03:40:00+00','2026-05-22 04:00:00+00','Marikina','Client Caterer',false,'demo-poolside-birthday',68000,'["Pool use","Pavilion tables"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":65,"demo":true}','not_required',null,34000,34000,'2026-05-21 03:40:00+00','partial',34000,34000,34000,'DEMO-PRES-0035','2026-05-21 03:40:00+00','2026-05-23 03:40:00+00',null,'Guest list could not be confirmed','customer_manual'),
  ('10000000-0000-0000-0000-000000000036','80000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','Rafael Lim [DEMO]','demo.rafael.lim@woodberry.example.test','+639171110004',true,true,44,'2026-08-02','2026-08-02','2026-08-02','2026-08-02 10:00:00','2026-08-02 16:00:00',null,'Private Event','DEMO_PRESENTATION high month custom completed',59000,'completed','2026-08-03 01:00:00+00','2026-05-26 06:40:00+00',null,null,'2026-05-24 06:30:00+00','2026-08-03 01:00:00+00','Pasig City','Client Caterer',false,'custom-booking',null,'[]',0,'[]','[]','[{"item":"Garden ceremony setup","amount":12000}]','[]','[]','[]','{"lead_days":70,"quote":"finalized","demo":true}','finalized','2026-05-26 06:30:00+00',29500,0,'2026-05-24 06:30:00+00','paid',29500,59000,0,'DEMO-PRES-0036','2026-05-26 06:30:00+00','2026-05-28 06:30:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000037','80000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000003','Bianca Tan [DEMO]','demo.bianca.tan@woodberry.example.test','+639171110005',false,true,78,'2026-10-24','2026-10-24','2026-10-24','2026-10-24 14:00:00','2026-10-24 20:00:00','30000000-0000-0000-0000-000000000002','Birthday Party','DEMO_PRESENTATION pending unpaid package reservation; use for payment demo',68000,'pending','2026-09-17 08:00:00+00',null,null,null,'2026-09-17 08:00:00+00','2026-09-17 08:00:00+00','San Mateo','Client Caterer',false,'demo-poolside-birthday',68000,'["Pool use","Pavilion tables"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":37,"demo":true}','not_required',null,34000,68000,'2026-09-17 08:00:00+00','unpaid',34000,0,68000,'DEMO-PRES-0037','2026-09-17 08:00:00+00','2026-09-19 08:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000038','80000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000001','Carlo Dizon [DEMO]','demo.carlo.dizon@woodberry.example.test','+639171110006',true,true,150,'2026-11-08','2026-11-08','2026-11-08','2026-11-08 14:00:00','2026-11-08 22:00:00','30000000-0000-0000-0000-000000000001','Wedding','DEMO_PRESENTATION active booked conflict example: try the same date/package',125000,'booked','2026-09-05 09:15:00+00','2026-09-05 09:15:00+00',null,null,'2026-09-03 09:00:00+00','2026-09-05 09:15:00+00','Mandaluyong','Woodberry Catering',true,'demo-wedding-celebration',125000,'["Venue styling","Buffet coordination"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":66,"demo":true}','not_required',null,62500,62500,'2026-09-03 09:00:00+00','partial',62500,62500,62500,'DEMO-PRES-0038','2026-09-03 09:00:00+00','2026-09-05 09:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000039','80000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000002','Grace Flores [DEMO]','demo.grace.flores@woodberry.example.test','+639171110007',true,true,50,'2026-11-21','2026-11-21','2026-11-21','2026-11-21 10:00:00','2026-11-21 16:00:00',null,'Private Event','DEMO_PRESENTATION custom quote finalized but unpaid; use for custom payment window demo',76000,'pending','2026-09-17 06:10:00+00',null,null,null,'2026-09-16 05:00:00+00','2026-09-17 06:10:00+00','Cainta','Client Caterer',false,'custom-booking',null,'[]',0,'[]','[]','[{"item":"Themed entrance styling","amount":14000}]','[]','[]','[]','{"lead_days":66,"quote":"finalized","demo":true}','finalized','2026-09-17 06:00:00+00',38000,76000,'2026-09-16 05:00:00+00','unpaid',38000,0,76000,'DEMO-PRES-0039','2026-09-17 06:00:00+00','2026-09-19 06:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000040','80000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000005','Paolo Garcia [DEMO]','demo.paolo.garcia@woodberry.example.test','+639171110008',true,true,65,'2026-12-05','2026-12-05','2026-12-05','2026-12-05 10:00:00','2026-12-05 17:00:00',null,'Conference','DEMO_PRESENTATION active booked custom with pending reschedule request',84500,'booked','2026-09-07 07:10:00+00','2026-09-07 07:10:00+00',null,null,'2026-09-05 07:00:00+00','2026-09-07 07:10:00+00','Makati','Woodberry Catering',true,'custom-booking',null,'[]',0,'[]','[]','[{"item":"AV support package","amount":11500}]','[{"key":"projector"},{"key":"big-tv"}]','[]','[]','{"lead_days":91,"quote":"finalized","demo":true}','finalized','2026-09-06 07:00:00+00',42250,42250,'2026-09-05 07:00:00+00','partial',42250,42250,42250,'DEMO-PRES-0040','2026-09-06 07:00:00+00','2026-09-08 07:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000041','80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Maria Santos [DEMO]','demo.maria.santos@woodberry.example.test','+639171110001',true,true,95,'2026-12-12','2026-12-12','2026-12-12','2026-12-12 11:00:00','2026-12-12 15:00:00','30000000-0000-0000-0000-000000000004','Family Gathering','DEMO_PRESENTATION approved reschedule example; current status rescheduled',42000,'rescheduled','2026-09-09 08:30:00+00','2026-08-24 08:10:00+00',null,'2026-09-09 08:30:00+00','2026-08-22 08:00:00+00','2026-09-09 08:30:00+00','Quezon City','Client Caterer',false,'demo-intimate-lunch',42000,'["Lunch service","Table setup"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":112,"demo":true}','not_required',null,21000,21000,'2026-08-22 08:00:00+00','partial',21000,21000,21000,'DEMO-PRES-0041','2026-08-22 08:00:00+00','2026-08-24 08:00:00+00',null,null,null),
  ('10000000-0000-0000-0000-000000000042','80000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003','Jose Reyes [DEMO]','demo.jose.reyes@woodberry.example.test','+639171110002',true,true,100,'2027-01-18','2027-01-18','2027-01-18','2027-01-18 14:00:00','2027-01-18 20:00:00','30000000-0000-0000-0000-000000000002','Birthday Party','DEMO_PRESENTATION cancelled future package with refund pending',68000,'cancelled','2026-09-14 05:00:00+00','2026-09-02 04:30:00+00','2026-09-14 05:00:00+00',null,'2026-09-01 04:00:00+00','2026-09-14 05:00:00+00','Antipolo','Client Caterer',false,'demo-poolside-birthday',68000,'["Pool use","Pavilion tables"]',0,'[]','[]','[]','[]','[]','[]','{"lead_days":139,"demo":true}','not_required',null,34000,34000,'2026-09-01 04:00:00+00','partial',34000,34000,34000,'DEMO-PRES-0042','2026-09-01 04:00:00+00','2026-09-03 04:00:00+00',null,'Cancelled more than three weeks before event; refund pending','customer_manual');

-- Payment/refund summaries. The booking insert trigger creates rows first;
-- this upsert makes payment state presentation-ready.
insert into public.booking_payments (
  booking_id, total_booking_amount, minimum_payment_amount, amount_paid,
  remaining_balance, payment_status, payment_method, payment_notes,
  payment_recorded_at, refund_status, refund_amount, refund_processed_at,
  refund_notes, recorded_by, updated_at
)
select
  b.id,
  coalesce(b.total_price, 0),
  coalesce(b.minimum_payment_amount, coalesce(b.total_price, 0) * 0.5),
  b.amount_paid,
  greatest(coalesce(b.total_price, 0) - b.amount_paid, 0),
  b.payment_status,
  case when b.amount_paid > 0 then 'PayMongo demo transaction' else null end,
  'DEMO_PRESENTATION generated payment summary',
  case when b.amount_paid > 0 then coalesce(b.confirmed_at, b.created_at + interval '2 hours') else null end,
  case
    when b.id = '10000000-0000-0000-0000-000000000002' then 'pending'
    when b.id = '10000000-0000-0000-0000-000000000020' then 'not_eligible'
    when b.id = '10000000-0000-0000-0000-000000000035' then 'not_eligible'
    when b.id = '10000000-0000-0000-0000-000000000042' then 'pending'
    else 'not_required'
  end,
  case
    when b.id = '10000000-0000-0000-0000-000000000002' then 17000
    when b.id = '10000000-0000-0000-0000-000000000042' then 17000
    else 0
  end,
  null,
  case
    when b.id in ('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000042') then 'DEMO_PRESENTATION refund-pending example under Woodberry cancellation policy.'
    when b.id in ('10000000-0000-0000-0000-000000000020','10000000-0000-0000-0000-000000000035') then 'DEMO_PRESENTATION not eligible; deposit forfeited.'
    else null
  end,
  case when b.amount_paid > 0 then '90000000-0000-0000-0000-000000000001'::uuid else null end,
  now()
from public.bookings b
where b.submission_key like 'DEMO-PRES-%'
on conflict (booking_id) do update
set total_booking_amount = excluded.total_booking_amount,
    minimum_payment_amount = excluded.minimum_payment_amount,
    amount_paid = excluded.amount_paid,
    remaining_balance = excluded.remaining_balance,
    payment_status = excluded.payment_status,
    payment_method = excluded.payment_method,
    payment_notes = excluded.payment_notes,
    payment_recorded_at = excluded.payment_recorded_at,
    refund_status = excluded.refund_status,
    refund_amount = excluded.refund_amount,
    refund_processed_at = excluded.refund_processed_at,
    refund_notes = excluded.refund_notes,
    recorded_by = excluded.recorded_by,
    updated_at = now();

insert into public.payment_transactions (
  id, booking_id, user_id, payment_type, amount, currency, gateway,
  gateway_checkout_id, gateway_payment_id, checkout_url, reference_number,
  payment_method, status, failure_reason, paid_at, created_at, updated_at
)
values
  ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','down_payment',62500,'PHP','paymongo','demo_checkout_0001','demo_payment_0001',null,'DEMO-PAY-0001','gcash','paid',null,'2025-08-05 08:25:00+00','2025-08-05 08:20:00+00',now()),
  ('60000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000037','80000000-0000-0000-0000-000000000005','down_payment',34000,'PHP','paymongo','demo_checkout_pending_0037',null,'https://checkout.paymongo.example.test/demo-0037','DEMO-PAY-0037',null,'pending',null,null,'2026-09-17 08:05:00+00',now()),
  ('60000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000038','80000000-0000-0000-0000-000000000006','down_payment',62500,'PHP','paymongo','demo_checkout_0038','demo_payment_0038',null,'DEMO-PAY-0038','card','paid',null,'2026-09-05 09:12:00+00','2026-09-05 09:05:00+00',now()),
  ('60000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000039','80000000-0000-0000-0000-000000000007','down_payment',38000,'PHP','paymongo','demo_checkout_pending_0039',null,'https://checkout.paymongo.example.test/demo-0039','DEMO-PAY-0039',null,'pending',null,null,'2026-09-17 06:15:00+00',now()),
  ('60000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000040','80000000-0000-0000-0000-000000000008','down_payment',42250,'PHP','paymongo','demo_checkout_0040','demo_payment_0040',null,'DEMO-PAY-0040','paymaya','paid',null,'2026-09-07 07:08:00+00','2026-09-07 07:02:00+00',now()),
  ('60000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000042','80000000-0000-0000-0000-000000000002','down_payment',34000,'PHP','paymongo','demo_checkout_0042','demo_payment_0042',null,'DEMO-PAY-0042','gcash','paid',null,'2026-09-02 04:20:00+00','2026-09-02 04:10:00+00',now())
on conflict (id) do update
set status = excluded.status,
    checkout_url = excluded.checkout_url,
    gateway_checkout_id = excluded.gateway_checkout_id,
    gateway_payment_id = excluded.gateway_payment_id,
    payment_method = excluded.payment_method,
    paid_at = excluded.paid_at,
    updated_at = now();

insert into public.booking_reschedule_requests (
  id, booking_id, user_id, requested_start_date, requested_end_date,
  requested_event_date, requested_start_datetime, requested_end_datetime,
  customer_note, status, reviewed_by, reviewed_role, reviewed_at,
  review_note, created_at, updated_at
)
values
  ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000041','80000000-0000-0000-0000-000000000001','2026-12-12','2026-12-12','2026-12-12','2026-12-12 11:00:00','2026-12-12 15:00:00','DEMO_PRESENTATION approved request: family moved the reunion one week later.','approved','90000000-0000-0000-0000-000000000001','admin','2026-09-09 08:30:00+00','Approved; requested date was available.','2026-09-08 07:30:00+00',now()),
  ('70000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000038','80000000-0000-0000-0000-000000000006','2026-11-15','2026-11-15','2026-11-15','2026-11-15 14:00:00','2026-11-15 22:00:00','DEMO_PRESENTATION rejected request: preferred date conflicts with maintenance block.','rejected','90000000-0000-0000-0000-000000000001','admin','2026-09-13 09:00:00+00','Rejected because the banquet hall has a demo maintenance block.','2026-09-12 08:00:00+00',now()),
  ('70000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000040','80000000-0000-0000-0000-000000000008','2026-12-19','2026-12-19','2026-12-19','2026-12-19 10:00:00','2026-12-19 17:00:00','DEMO_PRESENTATION pending request: client asked to move the conference one week later.','pending',null,null,null,null,'2026-09-15 07:00:00+00',now())
on conflict (id) do update
set requested_start_date = excluded.requested_start_date,
    requested_end_date = excluded.requested_end_date,
    requested_event_date = excluded.requested_event_date,
    requested_start_datetime = excluded.requested_start_datetime,
    requested_end_datetime = excluded.requested_end_datetime,
    customer_note = excluded.customer_note,
    status = excluded.status,
    reviewed_by = excluded.reviewed_by,
    reviewed_role = excluded.reviewed_role,
    reviewed_at = excluded.reviewed_at,
    review_note = excluded.review_note,
    updated_at = now();

insert into public.reviews (id, user_id, booking_id, rating, comment, created_at, updated_at)
values
  ('40000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',5,'DEMO_PRESENTATION review: The reception was smooth and the staff handled the timeline well.','2025-09-29 04:00:00+00',now()),
  ('40000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003',4,'DEMO_PRESENTATION review: Good retreat setup and responsive coordination.','2025-10-14 04:00:00+00',now()),
  ('40000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000029',5,'DEMO_PRESENTATION review: Poolside birthday package was worth it.','2026-05-27 04:00:00+00',now())
on conflict (id) do update
set rating = excluded.rating,
    comment = excluded.comment,
    updated_at = now();

insert into public.blocked_dates (
  id, venue_id, start_date, end_date, reason, created_by, created_at, updated_at, is_active
)
values
  ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','2026-10-30','2026-10-31','DEMO_PRESENTATION garden landscaping block', '90000000-0000-0000-0000-000000000001','2026-09-10 02:00:00+00',now(),true),
  ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','2026-11-15','2026-11-15','DEMO_PRESENTATION banquet hall maintenance block', '90000000-0000-0000-0000-000000000001','2026-09-10 02:05:00+00',now(),true),
  ('50000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000006','2026-12-01','2026-12-01','DEMO_PRESENTATION inactive old block for management demo', '90000000-0000-0000-0000-000000000001','2026-09-10 02:10:00+00',now(),false)
on conflict (id) do update
set venue_id = excluded.venue_id,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    reason = excluded.reason,
    created_by = excluded.created_by,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.booking_audit_log (
  booking_id, actor_id, actor_role, action, old_status, new_status, reason, metadata, created_at
)
values
  ('10000000-0000-0000-0000-000000000038','90000000-0000-0000-0000-000000000001','admin','payment_verified','pending','booked','DEMO_PRESENTATION payment verification example','{"demo":true,"scenario":"package reservation and payment"}','2026-09-05 09:15:00+00'),
  ('10000000-0000-0000-0000-000000000041','90000000-0000-0000-0000-000000000001','admin','reschedule_request_approved','booked','rescheduled','DEMO_PRESENTATION approved reschedule request','{"demo":true,"rescheduleRequestId":"70000000-0000-0000-0000-000000000001"}','2026-09-09 08:30:00+00'),
  ('10000000-0000-0000-0000-000000000042','80000000-0000-0000-0000-000000000002','customer','booking_cancelled','booked','cancelled','DEMO_PRESENTATION refund pending cancellation','{"demo":true,"refundStatus":"pending","refundAmount":17000}','2026-09-14 05:00:00+00');

-- Presentation validation result set.
with demo_bookings as (
  select b.*, p.payment_status as recorded_payment_status, p.refund_status
  from public.bookings b
  left join public.booking_payments p on p.booking_id = b.id
  where b.submission_key like 'DEMO-PRES-%'
),
monthly_history as (
  select to_char(months.month_start, 'YYYY-MM') as month,
         count(demo_bookings.id) as bookings_created
  from generate_series(date '2025-08-01', date '2026-09-01', interval '1 month') months(month_start)
  left join demo_bookings
    on date_trunc('month', demo_bookings.created_at)::date = months.month_start
  group by months.month_start
)
select 'package reservation and payment' as scenario, count(*) as records
from demo_bookings
where package_id is not null and status in ('pending','booked') and recorded_payment_status in ('unpaid','partial')
union all
select 'custom quotation waiting/finalized', count(*)
from demo_bookings
where package_type = 'custom-booking' and quotation_status in ('pending','finalized')
union all
select 'availability/conflict handling', count(*)
from demo_bookings
where status in ('pending','booked','rescheduled') and start_date >= date '2026-10-01'
union all
select 'cancellation/refund outcome', count(*)
from demo_bookings
where status = 'cancelled' and refund_status in ('pending','not_eligible')
union all
select 'reschedule admin decisions', count(*)
from public.booking_reschedule_requests
where id in (
  '70000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000003'
)
union all
select 'completion and review', count(*)
from demo_bookings
where status = 'completed'
union all
select 'package/venue/admin CRUD demo rows', count(*)
from public.packages
where id = '30000000-0000-0000-0000-000000000006'
union all
select 'blocked-date management', count(*)
from public.blocked_dates
where id in (
  '50000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000002',
  '50000000-0000-0000-0000-000000000003'
)
union all
select 'forecast months available', count(*)
from monthly_history
union all
select 'zero/very-low forecast months', count(*)
from monthly_history
where bookings_created <= 1;

commit;
