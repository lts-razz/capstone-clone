import {
  isRecognizedBookingStatus,
  normalizeBookingStatus,
  type BookingStatus,
} from "../lib/bookingStatus";
import {
  calculateIntelligentSalesForecast,
  type ForecastBooking,
  type ForecastPayment,
  type IntelligentSalesForecast,
} from "./intelligentForecast";

export type SalesReportPeriod = "weekly" | "monthly";

export interface SalesReportBooking {
  id: string;
  status: string | null;
  created_at: string;
  event_date: string | null;
  start_date: string;
  total_price: number | null;
  package_id: string | null;
  package_type: string | null;
  venue_id?: string | null;
  venue_ids?: string[];
}

export interface SalesReportPayment {
  booking_id: string;
  total_booking_amount: number;
  amount_paid: number;
  payment_status: "unpaid" | "partial" | "paid" | "refunded";
}

export interface SalesReportPackageMetric {
  packageId: string | null;
  packageName: string;
  bookingCount: number;
  revenue: number;
}

export interface SalesReportVenueMetric {
  venueId: string | null;
  venueName: string;
  bookingCount: number;
}

export interface SalesReport {
  period: { type: SalesReportPeriod; start: string; endExclusive: string };
  totalBookings: number;
  pendingReservations: number;
  bookedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  rescheduledBookings: number;
  packageBookings: number;
  customBookings: number;
  upcomingBookings: number;
  grossRevenue: number;
  paidRevenue: number;
  unpaidBalance: number;
  paymentStatusCounts: Record<"unpaid" | "partial" | "paid" | "refunded", number>;
  cancellationCount: number;
  cancellationRate: number;
  cancelledBookingValue: number;
  retainedCancellationRevenue: number;
  revenueByPackage: SalesReportPackageMetric[];
  bookingCountByPackage: SalesReportPackageMetric[];
  venueUsage: SalesReportVenueMetric[];
  averageBookingValue: number;
  busiestBookingDates: Array<{ date: string; bookingCount: number }>;
  mostSelectedPackages: SalesReportPackageMetric[];
}

export type SalesForecast = IntelligentSalesForecast;

const PACKAGE_LABELS: Record<string, string> = {
  "lunch-time": "Lunch Time Package",
  "dinner-time": "Dinner Time Package",
  "barkada-staycation": "Barkada Staycation",
  "pamilya-staycation": "Pamilya Staycation",
  "room-rates": "Room Rates",
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateSalesForecast(
  bookings: ForecastBooking[],
  payments: ForecastPayment[],
  targetMonth: string,
): SalesForecast {
  return calculateIntelligentSalesForecast(bookings, payments, targetMonth);
}

function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Date must use YYYY-MM-DD format");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (date.toISOString().slice(0, 10) !== value) throw new Error("Date is invalid");
  return date;
}

/** Returns a half-open UTC range, avoiding end-of-day millisecond edge cases. */
export function getSalesReportRange(period: SalesReportPeriod, anchor: string) {
  if (period === "monthly") {
    if (!/^\d{4}-\d{2}$/.test(anchor)) throw new Error("Month must use YYYY-MM format");
    const start = parseDateOnly(`${anchor}-01`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    return { type: period, start: start.toISOString(), endExclusive: end.toISOString() };
  }

  const selected = parseDateOnly(anchor);
  const monday = new Date(selected);
  monday.setUTCDate(selected.getUTCDate() - ((selected.getUTCDay() + 6) % 7));
  const end = new Date(monday);
  end.setUTCDate(monday.getUTCDate() + 7);
  return { type: period, start: monday.toISOString(), endExclusive: end.toISOString() };
}

export function calculateSalesReport(
  bookings: SalesReportBooking[],
  payments: SalesReportPayment[],
  period: SalesReport["period"],
  packageNames: Record<string, string> = {},
  venueNames: Record<string, string> = {},
): SalesReport {
  const paymentByBooking = new Map(payments.map((payment) => [payment.booking_id, payment]));
  const validBookings: Array<SalesReportBooking & { status: BookingStatus }> = bookings
    .filter((booking) => isRecognizedBookingStatus(booking.status))
    .map((booking) => ({ ...booking, status: normalizeBookingStatus(booking.status) }));
  const statusCounts: Record<BookingStatus, number> = {
    pending: 0, booked: 0, rescheduled: 0, cancelled: 0, completed: 0,
  };
  const paymentStatusCounts: Record<"unpaid" | "partial" | "paid" | "refunded", number> = {
    unpaid: 0, partial: 0, paid: 0, refunded: 0,
  };
  const packages = new Map<string, SalesReportPackageMetric>();
  const venues = new Map<string, SalesReportVenueMetric>();
  const dates = new Map<string, number>();
  const today = new Date().toISOString().slice(0, 10);
  let packageBookings = 0;
  let customBookings = 0;
  let upcomingBookings = 0;
  let grossRevenue = 0;
  let paidRevenue = 0;
  let unpaidBalance = 0;
  let revenueBookingCount = 0;
  let cancelledBookingValue = 0;
  let retainedCancellationRevenue = 0;

  for (const booking of validBookings) {
    const status = booking.status;
    statusCounts[status]++;
    const payment = paymentByBooking.get(booking.id);
    const paymentStatus = payment?.payment_status ?? "unpaid";
    paymentStatusCounts[paymentStatus]++;
    if (booking.package_type === "custom-booking") {
      customBookings++;
    } else {
      packageBookings++;
    }
    const eventDate = (booking.event_date ?? booking.start_date).slice(0, 10);
    if ((status === "pending" || status === "booked" || status === "rescheduled") && eventDate >= today) {
      upcomingBookings++;
    }
    const paid = payment?.payment_status === "refunded" ? 0 : Math.max(Number(payment?.amount_paid ?? 0), 0);
    const total = Math.max(Number(payment?.total_booking_amount ?? booking.total_price ?? 0), 0);
    const isExpectedRevenue = status === "booked" || status === "completed";
    const retainedCancellation = status === "cancelled" ? paid : 0;
    const recognizedGross = isExpectedRevenue ? total : retainedCancellation;

    grossRevenue += recognizedGross;
    paidRevenue += paid;
    unpaidBalance += isExpectedRevenue ? Math.max(total - paid, 0) : 0;
    if (recognizedGross > 0) revenueBookingCount++;
    if (status === "cancelled") {
      cancelledBookingValue += total;
      retainedCancellationRevenue += retainedCancellation;
    }

    const packageKey = booking.package_id ?? booking.package_type ?? "unspecified";
    const packageName = booking.package_id
      ? (packageNames[booking.package_id] ?? booking.package_type ?? "Unspecified package")
      : (PACKAGE_LABELS[booking.package_type ?? ""] ?? booking.package_type ?? "Unspecified package");
    const packageMetric = packages.get(packageKey) ?? {
      packageId: booking.package_id,
      packageName,
      bookingCount: 0,
      revenue: 0,
    };
    if (status !== "pending" && status !== "cancelled") packageMetric.bookingCount++;
    packageMetric.revenue += recognizedGross;
    packages.set(packageKey, packageMetric);

    if (status !== "cancelled" && status !== "pending") {
      dates.set(eventDate, (dates.get(eventDate) ?? 0) + 1);
      const bookingVenueIds = booking.venue_ids?.length
        ? booking.venue_ids
        : booking.venue_id
          ? [booking.venue_id]
          : [null];
      for (const venueId of bookingVenueIds) {
        const venueKey = venueId ?? "unspecified";
        const venueMetric = venues.get(venueKey) ?? {
          venueId,
          venueName: venueId ? (venueNames[venueId] ?? "Unknown venue") : "Unspecified venue",
          bookingCount: 0,
        };
        venueMetric.bookingCount++;
        venues.set(venueKey, venueMetric);
      }
    }
  }

  const packageMetrics = [...packages.values()]
    .filter((item) => item.bookingCount > 0 || item.revenue > 0)
    .map((item) => ({ ...item, revenue: roundMoney(item.revenue) }));
  const byCount = [...packageMetrics].sort((a, b) => b.bookingCount - a.bookingCount || a.packageName.localeCompare(b.packageName));

  return {
    period,
    totalBookings: validBookings.length,
    pendingReservations: statusCounts.pending,
    bookedBookings: statusCounts.booked,
    completedBookings: statusCounts.completed,
    cancelledBookings: statusCounts.cancelled,
    rescheduledBookings: statusCounts.rescheduled,
    packageBookings,
    customBookings,
    upcomingBookings,
    grossRevenue: roundMoney(grossRevenue),
    paidRevenue: roundMoney(paidRevenue),
    unpaidBalance: roundMoney(unpaidBalance),
    paymentStatusCounts,
    cancellationCount: statusCounts.cancelled,
    cancellationRate: validBookings.length ? roundMoney((statusCounts.cancelled / validBookings.length) * 100) : 0,
    cancelledBookingValue: roundMoney(cancelledBookingValue),
    retainedCancellationRevenue: roundMoney(retainedCancellationRevenue),
    revenueByPackage: [...packageMetrics].sort((a, b) => b.revenue - a.revenue || a.packageName.localeCompare(b.packageName)),
    bookingCountByPackage: byCount,
    venueUsage: [...venues.values()].sort((a, b) => b.bookingCount - a.bookingCount || a.venueName.localeCompare(b.venueName)),
    averageBookingValue: revenueBookingCount ? roundMoney(grossRevenue / revenueBookingCount) : 0,
    busiestBookingDates: [...dates.entries()]
      .map(([date, bookingCount]) => ({ date, bookingCount }))
      .sort((a, b) => b.bookingCount - a.bookingCount || a.date.localeCompare(b.date)),
    mostSelectedPackages: byCount.filter((item) => item.bookingCount === (byCount[0]?.bookingCount ?? 0)),
  };
}
