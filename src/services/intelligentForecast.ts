import {
  isRecognizedBookingStatus,
  normalizeBookingStatus,
  type BookingStatus,
} from "../lib/bookingStatus";

export interface ForecastBooking {
  id: string;
  status: string | null;
  created_at: string;
  total_price: number | null;
  package_type: string | null;
}

export interface ForecastPayment {
  booking_id: string;
  total_booking_amount: number;
  amount_paid: number;
  payment_status: "unpaid" | "partial" | "paid" | "refunded";
}

export type ForecastTrendDirection = "increasing" | "stable" | "declining";

export interface ForecastMonthInput {
  month: string;
  totalBookings: number;
  securedCompletedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  packageBookings: number;
  customBookings: number;
  securedPackageBookings: number;
  securedCustomBookings: number;
  totalBookingValue: number;
  securedCompletedValue: number;
  cancelledBookingValue: number;
  retainedCancellationRevenue: number;
}

export interface ForecastWeightedInput {
  month: string;
  weight: number;
  securedCompletedBookings: number;
  securedCompletedValue: number;
}

export interface IntelligentSalesForecast {
  available: boolean;
  message: string | null;
  targetMonth: string;
  expectedBookings: number | null;
  expectedRevenue: number | null;
  trend: {
    direction: ForecastTrendDirection;
    bookingSlopePerMonth: number;
    revenueSlopePerMonth: number;
    stableThresholdBookings: number;
  };
  monthsUsed: string[];
  monthlyDataset: ForecastMonthInput[];
  weightedInputs: ForecastWeightedInput[];
  metadata: {
    sourceDateField: "created_at";
    method: "weighted_recent_demand_plus_linear_trend";
    formula: string;
    includedDemandStatuses: BookingStatus[];
    cancelledStatuses: ["cancelled"];
    packageRule: "package_type === custom-booking is custom; all other bookings are package";
    valueSource: "booking_payments.total_booking_amount, falling back to bookings.total_price when no payment record exists";
  };
}

const DEMAND_STATUSES: BookingStatus[] = ["booked", "rescheduled", "completed"];
const STABLE_BOOKING_SLOPE_THRESHOLD = 0.25;
const FORECAST_UNAVAILABLE_MESSAGE = "No historical booking creation data is available for forecasting yet.";

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function assertMonth(value: string, label: string) {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new Error(`${label} must use YYYY-MM format`);
}

function parseMonth(value: string): Date {
  assertMonth(value, "Month");
  return new Date(Date.UTC(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1));
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function eachMonth(startMonth: string, endMonth: string): string[] {
  const months: string[] = [];
  for (let cursor = parseMonth(startMonth); monthKey(cursor) <= endMonth; cursor = addMonths(cursor, 1)) {
    months.push(monthKey(cursor));
  }
  return months;
}

function paymentValue(payment: ForecastPayment | undefined, booking: ForecastBooking): number {
  return Math.max(Number(payment?.total_booking_amount ?? booking.total_price ?? 0), 0);
}

function paidValue(payment: ForecastPayment | undefined): number {
  if (payment?.payment_status === "refunded") return 0;
  return Math.max(Number(payment?.amount_paid ?? 0), 0);
}

function weightedAverage(values: number[], weights: number[]): number {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (!totalWeight) return 0;
  return values.reduce((sum, value, index) => sum + value * weights[index], 0) / totalWeight;
}

function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const xMean = (values.length - 1) / 2;
  const yMean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const denominator = values.reduce((sum, _value, index) => sum + (index - xMean) ** 2, 0);
  if (!denominator) return 0;
  return values.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0) / denominator;
}

function trendDirection(slope: number): ForecastTrendDirection {
  if (slope > STABLE_BOOKING_SLOPE_THRESHOLD) return "increasing";
  if (slope < -STABLE_BOOKING_SLOPE_THRESHOLD) return "declining";
  return "stable";
}

function emptyForecast(targetMonth: string, monthlyDataset: ForecastMonthInput[] = []): IntelligentSalesForecast {
  return {
    available: false,
    message: FORECAST_UNAVAILABLE_MESSAGE,
    targetMonth,
    expectedBookings: null,
    expectedRevenue: null,
    trend: {
      direction: "stable",
      bookingSlopePerMonth: 0,
      revenueSlopePerMonth: 0,
      stableThresholdBookings: STABLE_BOOKING_SLOPE_THRESHOLD,
    },
    monthsUsed: [],
    monthlyDataset,
    weightedInputs: [],
    metadata: forecastMetadata(),
  };
}

function forecastMetadata(): IntelligentSalesForecast["metadata"] {
  return {
    sourceDateField: "created_at",
    method: "weighted_recent_demand_plus_linear_trend",
    formula: "baseline = max(0, weighted_average(latest_up_to_6_months, weights 1..n) + simple_linear_slope_per_month)",
    includedDemandStatuses: DEMAND_STATUSES,
    cancelledStatuses: ["cancelled"],
    packageRule: "package_type === custom-booking is custom; all other bookings are package",
    valueSource: "booking_payments.total_booking_amount, falling back to bookings.total_price when no payment record exists",
  };
}

export function getNextMonthForecastTarget(anchorIso: string): string {
  const anchor = new Date(anchorIso);
  if (Number.isNaN(anchor.getTime())) throw new Error("Invalid report start date");
  const anchorMonth = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  return monthKey(addMonths(anchorMonth, 1));
}

export function getForecastTargetStartIso(targetMonth: string): string {
  return parseMonth(targetMonth).toISOString();
}

export function calculateIntelligentSalesForecast(
  bookings: ForecastBooking[],
  payments: ForecastPayment[],
  targetMonth: string,
): IntelligentSalesForecast {
  assertMonth(targetMonth, "Target month");

  const paymentByBooking = new Map(payments.map((payment) => [payment.booking_id, payment]));
  const targetStart = parseMonth(targetMonth);
  const latestHistoryMonth = monthKey(addMonths(targetStart, -1));
  const validBookings = bookings
    .filter((booking) => isRecognizedBookingStatus(booking.status) && booking.created_at.slice(0, 7) < targetMonth)
    .map((booking) => ({
      ...booking,
      status: normalizeBookingStatus(booking.status),
      createdMonth: booking.created_at.slice(0, 7),
    }))
    .filter((booking) => /^\d{4}-\d{2}$/.test(booking.createdMonth));

  if (!validBookings.length) return emptyForecast(targetMonth);

  const firstHistoryMonth = validBookings
    .map((booking) => booking.createdMonth)
    .sort()[0];
  const dataset = eachMonth(firstHistoryMonth, latestHistoryMonth).map<ForecastMonthInput>((month) => ({
    month,
    totalBookings: 0,
    securedCompletedBookings: 0,
    cancelledBookings: 0,
    pendingBookings: 0,
    packageBookings: 0,
    customBookings: 0,
    securedPackageBookings: 0,
    securedCustomBookings: 0,
    totalBookingValue: 0,
    securedCompletedValue: 0,
    cancelledBookingValue: 0,
    retainedCancellationRevenue: 0,
  }));
  const monthByKey = new Map(dataset.map((month) => [month.month, month]));

  for (const booking of validBookings) {
    const month = monthByKey.get(booking.createdMonth);
    if (!month) continue;
    const value = paymentValue(paymentByBooking.get(booking.id), booking);
    const paid = paidValue(paymentByBooking.get(booking.id));
    const isCustom = booking.package_type === "custom-booking";
    const isDemand = DEMAND_STATUSES.includes(booking.status);

    month.totalBookings++;
    month.totalBookingValue += value;
    if (isCustom) month.customBookings++;
    else month.packageBookings++;

    if (booking.status === "pending") month.pendingBookings++;
    if (booking.status === "cancelled") {
      month.cancelledBookings++;
      month.cancelledBookingValue += value;
      month.retainedCancellationRevenue += paid;
    }

    if (isDemand) {
      month.securedCompletedBookings++;
      month.securedCompletedValue += value;
      if (isCustom) month.securedCustomBookings++;
      else month.securedPackageBookings++;
    }
  }

  const roundedDataset = dataset.map((month) => ({
    ...month,
    totalBookingValue: roundMoney(month.totalBookingValue),
    securedCompletedValue: roundMoney(month.securedCompletedValue),
    cancelledBookingValue: roundMoney(month.cancelledBookingValue),
    retainedCancellationRevenue: roundMoney(month.retainedCancellationRevenue),
  }));
  const recentMonths = roundedDataset.slice(-6);
  const weights = recentMonths.map((_month, index) => index + 1);
  const demandValues = recentMonths.map((month) => month.securedCompletedBookings);
  const revenueValues = recentMonths.map((month) => month.securedCompletedValue);
  const bookingSlope = linearSlope(demandValues);
  const revenueSlope = linearSlope(revenueValues);
  const expectedBookings = Math.max(0, weightedAverage(demandValues, weights) + bookingSlope);
  const expectedRevenue = Math.max(0, weightedAverage(revenueValues, weights) + revenueSlope);

  return {
    available: true,
    message: null,
    targetMonth,
    expectedBookings: Math.round(expectedBookings),
    expectedRevenue: roundMoney(expectedRevenue),
    trend: {
      direction: trendDirection(bookingSlope),
      bookingSlopePerMonth: roundMoney(bookingSlope),
      revenueSlopePerMonth: roundMoney(revenueSlope),
      stableThresholdBookings: STABLE_BOOKING_SLOPE_THRESHOLD,
    },
    monthsUsed: recentMonths.map((month) => month.month),
    monthlyDataset: roundedDataset,
    weightedInputs: recentMonths.map((month, index) => ({
      month: month.month,
      weight: weights[index],
      securedCompletedBookings: month.securedCompletedBookings,
      securedCompletedValue: month.securedCompletedValue,
    })),
    metadata: forecastMetadata(),
  };
}
