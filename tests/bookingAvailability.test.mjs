import assert from "node:assert/strict";
import test from "node:test";
import { findAvailabilityOverlaps, getBookingVenueIds, getUnavailableVenueIdsForRange } from "../src/services/bookingAvailability.ts";
import { getRequiredPackageVenueIds } from "../src/services/packageAssignments.ts";

function clientFor(tables) {
  return {
    from(table) {
      let rows = tables[table] ?? [];
      const query = {
        select() { return query; },
        order() { return query; },
        range(start, end) { rows = rows.slice(start, end + 1); return query; },
        eq(column, value) { rows = rows.filter((row) => row[column] === value); return query; },
        neq(column, value) { rows = rows.filter((row) => row[column] !== value); return query; },
        in(column, values) { rows = rows.filter((row) => values.includes(row[column])); return query; },
        lte(column, value) { rows = rows.filter((row) => row[column] <= value); return query; },
        gte(column, value) { rows = rows.filter((row) => row[column] >= value); return query; },
        then(resolve, reject) { return Promise.resolve({ data: rows, error: null }).then(resolve, reject); },
      };
      return query;
    },
  };
}

function booking(id, venueId, status = "booked", start = "2026-10-10", end = start) {
  return { id, venue_id: venueId, status, start_date: start, end_date: end, event_date: null };
}

const range = { startDate: "2026-10-10", endDate: "2026-10-10" };

test("one required venue and all-free multi-venue packages remain available", async () => {
  const client = clientFor({ bookings: [], booking_venue_assignments: [], blocked_dates: [] });
  for (const venueIds of [["pool"], ["pool", "pavilion"], ["pool", "pavilion", "garden"]]) {
    const result = await findAvailabilityOverlaps(client, { venueIds, ...range });
    assert.equal(result.bookings.length, 0);
    assert.equal(result.blockedDates.length, 0);
    assert.equal(result.error, null);
  }
});

test("a conflict in any required venue blocks the entire package", async () => {
  const tables = {
    bookings: [booking("existing", "pool")],
    booking_venue_assignments: [{ booking_id: "existing", venue_id: "pool" }, { booking_id: "existing", venue_id: "pavilion" }],
    blocked_dates: [],
  };
  const client = clientFor(tables);
  for (const venueIds of [["pool", "garden"], ["garden", "pavilion"], ["garden", "pavilion", "lawn"]]) {
    const result = await findAvailabilityOverlaps(client, { venueIds, ...range });
    assert.equal(result.bookings.length, 1);
  }
  const secondary = await getUnavailableVenueIdsForRange(client, { venueIds: ["pavilion"], ...range });
  assert.deepEqual(secondary.venueIds, ["pavilion"]);
});

test("pending, booked, rescheduled and completed hold venues; cancelled does not", async () => {
  for (const status of ["pending", "booked", "rescheduled", "completed", "cancelled"]) {
    const client = clientFor({
      bookings: [booking("existing", "pool", status)],
      booking_venue_assignments: [{ booking_id: "existing", venue_id: "pavilion" }],
      blocked_dates: [],
    });
    const result = await findAvailabilityOverlaps(client, { venueId: "pavilion", ...range });
    assert.equal(result.bookings.length > 0, status !== "cancelled", status);
  }
});

test("existing inclusive date overlap rule covers matching and contained ranges", async () => {
  const cases = [
    ["2026-10-10", "2026-10-10", "2026-10-10", "2026-10-10", true],
    ["2026-10-09", "2026-10-10", "2026-10-10", "2026-10-11", true],
    ["2026-10-10", "2026-10-11", "2026-10-09", "2026-10-10", true],
    ["2026-10-10", "2026-10-10", "2026-10-09", "2026-10-11", true],
    ["2026-10-09", "2026-10-11", "2026-10-10", "2026-10-10", true],
    ["2026-10-11", "2026-10-11", "2026-10-10", "2026-10-10", false],
  ];
  for (const [start, end, requestedStart, requestedEnd, overlaps] of cases) {
    const client = clientFor({ bookings: [booking("existing", "pool", "booked", start, end)], booking_venue_assignments: [], blocked_dates: [] });
    const result = await findAvailabilityOverlaps(client, { venueId: "pool", startDate: requestedStart, endDate: requestedEnd });
    assert.equal(result.bookings.length > 0, overlaps, `${start} to ${end} against ${requestedStart} to ${requestedEnd}`);
  }
});

test("active blocked dates affect secondary venues and inactive blocks do not", async () => {
  const client = clientFor({
    bookings: [], booking_venue_assignments: [],
    blocked_dates: [
      { venue_id: "pavilion", start_date: "2026-10-10", end_date: "2026-10-10", is_active: true },
      { venue_id: "garden", start_date: "2026-10-10", end_date: "2026-10-10", is_active: false },
    ],
  });
  const result = await findAvailabilityOverlaps(client, { venueIds: ["pool", "pavilion", "garden"], ...range });
  assert.deepEqual(result.unavailableVenueIds, ["pavilion"]);
});

test("current deduplicated package venues are used while booking snapshots remain historical", async () => {
  const tables = {
    package_venue_assignments: [
      { package_id: "package", venue_id: "pool" },
      { package_id: "package", venue_id: "pool" },
      { package_id: "package", venue_id: "pavilion" },
    ],
    bookings: [booking("old", "pool")],
    booking_venue_assignments: [{ booking_id: "old", venue_id: "pool" }, { booking_id: "old", venue_id: "pavilion" }],
    blocked_dates: [],
  };
  const client = clientFor(tables);
  assert.deepEqual((await getRequiredPackageVenueIds(client, "package", "pool")).venueIds, ["pool", "pavilion"]);
  tables.package_venue_assignments = [{ package_id: "package", venue_id: "garden" }];
  assert.deepEqual((await getRequiredPackageVenueIds(client, "package", "pool")).venueIds, ["pool", "garden"]);
  assert.deepEqual((await getBookingVenueIds(client, "old", "pool")).venueIds, ["pool", "pavilion"]);
  assert.deepEqual(tables.booking_venue_assignments.map((row) => row.venue_id), ["pool", "pavilion"]);
});

test("a new booking after an earlier free result blocks final validation", async () => {
  const tables = { bookings: [], booking_venue_assignments: [], blocked_dates: [] };
  const client = clientFor(tables);
  assert.equal((await findAvailabilityOverlaps(client, { venueIds: ["pool", "pavilion"], ...range })).bookings.length, 0);
  tables.bookings.push(booking("new", "pool", "pending"));
  tables.booking_venue_assignments.push({ booking_id: "new", venue_id: "pavilion" });
  assert.equal((await findAvailabilityOverlaps(client, { venueIds: ["pool", "pavilion"], ...range })).bookings.length, 2);
});

test("secondary conflicts remain visible beyond the first Supabase result page", async () => {
  const tables = {
    bookings: Array.from({ length: 1000 }, (_, index) => booking(`other-${String(index).padStart(4, "0")}`, "garden")),
    booking_venue_assignments: [{ booking_id: "z-last", venue_id: "pavilion" }],
    blocked_dates: [],
  };
  tables.bookings.push(booking("z-last", "pool"));
  const result = await findAvailabilityOverlaps(clientFor(tables), { venueId: "pavilion", ...range });
  assert.deepEqual(result.bookings.map((row) => row.id), ["z-last"]);
});
