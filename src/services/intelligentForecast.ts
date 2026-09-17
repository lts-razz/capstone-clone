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
  package_id?: string | null;
  package_type: string | null;
  venue_id?: string | null;
  venue_ids?: string[];
}

export interface ForecastPayment {
  booking_id: string;
  total_booking_amount: number;
  amount_paid: number;
  payment_status: "unpaid" | "partial" | "paid" | "refunded";
}

export type ForecastTrendDirection = "increasing" | "stable" | "declining";
export type ForecastConfidenceLabel = "Low" | "Moderate" | "High";

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
  securedPackageValue: number;
  securedCustomValue: number;
  cancelledBookingValue: number;
  retainedCancellationRevenue: number;
}

export interface ForecastWeightedInput {
  month: string;
  weight: number;
  totalBookings: number;
  securedCompletedBookings: number;
  securedCompletedValue: number;
  cancellationRate: number | null;
}

export interface ForecastRange {
  low: number;
  high: number;
}

export interface ForecastModelWeights {
  recentDemand: number;
  linearTrend: number;
  historicalAverage: number;
  seasonality: number;
}

export interface ForecastConfidenceFactor {
  name: string;
  score: number;
  description: string;
}

export interface ForecastBacktestSummary {
  available: boolean;
  evaluationCount: number;
  targetMonths: string[];
  bookingMae: number | null;
  revenueMae: number | null;
  averageActualBookings: number | null;
  averageActualRevenue: number | null;
}

export interface ForecastContext {
  packageNames?: Record<string, string>;
  venueNames?: Record<string, string>;
}

export interface IntelligentSalesForecast {
  available: boolean;
  message: string | null;
  targetMonth: string;
  expectedBookings: number | null;
  bookingRange: ForecastRange | null;
  expectedRevenue: number | null;
  revenueRange: ForecastRange | null;
  expectedPackageBookings: number | null;
  expectedCustomBookings: number | null;
  likelyTopPackage: string | null;
  likelyBusiestVenue: string | null;
  expectedAverageBookingValue: number | null;
  cancellationEstimate: {
    rate: number;
    expectedCancelledBookings: number;
  } | null;
  confidence: {
    score: number;
    label: ForecastConfidenceLabel;
    factors: ForecastConfidenceFactor[];
  };
  backtest: ForecastBacktestSummary;
  insights: string[];
  trend: {
    direction: ForecastTrendDirection;
    bookingSlopePerMonth: number;
    revenueSlopePerMonth: number;
    stableThresholdBookings: number;
  };
  model: {
    components: {
      recentDemand: number;
      linearTrend: number;
      historicalAverage: number;
      seasonality: number | null;
      cancellationRate: number;
    };
    weights: ForecastModelWeights;
  } | null;
  monthsUsed: string[];
  monthlyDataset: ForecastMonthInput[];
  weightedInputs: ForecastWeightedInput[];
  metadata: {
    sourceDateField: "created_at";
    method: "explainable_hybrid_predictive_forecasting_model";
    formula: string;
    weightProfiles: typeof MODEL_WEIGHT_PROFILES;
    recentWindowMonths: typeof RECENT_WINDOW_MONTHS;
    backtestMinimumHistoryMonths: typeof BACKTEST_MIN_HISTORY_MONTHS;
    includedDemandStatuses: BookingStatus[];
    cancelledStatuses: ["cancelled"];
    packageRule: "package_type === custom-booking is custom; all other bookings are package";
    valueSource: "booking_payments.total_booking_amount, falling back to bookings.total_price when no payment record exists";
  };
}

const DEMAND_STATUSES: BookingStatus[] = ["booked", "rescheduled", "completed"];
const STABLE_BOOKING_SLOPE_THRESHOLD = 0.25;
const FORECAST_UNAVAILABLE_MESSAGE = "No historical booking creation data is available for forecasting yet.";
const RECENT_WINDOW_MONTHS = 6;
const SEASONAL_MIN_HISTORY_MONTHS = 12;
const BACKTEST_MIN_HISTORY_MONTHS = 4;

const MODEL_WEIGHT_PROFILES = {
  limitedHistory: {
    maxMonths: 5,
    weights: { recentDemand: 0.65, linearTrend: 0.25, historicalAverage: 0.1, seasonality: 0 },
  },
  developingHistory: {
    minMonths: 6,
    maxMonths: 11,
    weights: { recentDemand: 0.5, linearTrend: 0.25, historicalAverage: 0.25, seasonality: 0 },
  },
  seasonalHistory: {
    minMonths: 12,
    weights: { recentDemand: 0.35, linearTrend: 0.2, historicalAverage: 0.25, seasonality: 0.2 },
  },
} as const;

const PACKAGE_LABELS: Record<string, string> = {
  "lunch-time": "Lunch Time Package",
  "dinner-time": "Dinner Time Package",
  "barkada-staycation": "Barkada Staycation",
  "pamilya-staycation": "Pamilya Staycation",
  "room-rates": "Room Rates",
};

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundMetric = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]): number {
  return values.length ? sum(values) / values.length : 0;
}

function weightedAverage(values: number[], weights: number[]): number {
  const totalWeight = sum(weights);
  if (!totalWeight) return 0;
  return values.reduce((total, value, index) => total + value * weights[index], 0) / totalWeight;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const xMean = (values.length - 1) / 2;
  const yMean = average(values);
  const denominator = values.reduce((total, _value, index) => total + (index - xMean) ** 2, 0);
  if (!denominator) return 0;
  return values.reduce((total, value, index) => total + (index - xMean) * (value - yMean), 0) / denominator;
}

function linearProjection(values: number[]): number {
  if (!values.length) return 0;
  if (values.length < 2) return values[0];
  const slope = linearSlope(values);
  const xMean = (values.length - 1) / 2;
  const yMean = average(values);
  const intercept = yMean - slope * xMean;
  return Math.max(0, intercept + slope * values.length);
}

function trendDirection(slope: number): ForecastTrendDirection {
  if (slope > STABLE_BOOKING_SLOPE_THRESHOLD) return "increasing";
  if (slope < -STABLE_BOOKING_SLOPE_THRESHOLD) return "declining";
  return "stable";
}

function emptyBacktest(): ForecastBacktestSummary {
  return {
    available: false,
    evaluationCount: 0,
    targetMonths: [],
    bookingMae: null,
    revenueMae: null,
    averageActualBookings: null,
    averageActualRevenue: null,
  };
}

function emptyConfidence(): IntelligentSalesForecast["confidence"] {
  return {
    score: 0,
    label: "Low",
    factors: [
      {
        name: "History length",
        score: 0,
        description: "No usable historical booking months are available.",
      },
    ],
  };
}

function emptyForecast(targetMonth: string, monthlyDataset: ForecastMonthInput[] = []): IntelligentSalesForecast {
  return {
    available: false,
    message: FORECAST_UNAVAILABLE_MESSAGE,
    targetMonth,
    expectedBookings: null,
    bookingRange: null,
    expectedRevenue: null,
    revenueRange: null,
    expectedPackageBookings: null,
    expectedCustomBookings: null,
    likelyTopPackage: null,
    likelyBusiestVenue: null,
    expectedAverageBookingValue: null,
    cancellationEstimate: null,
    confidence: emptyConfidence(),
    backtest: emptyBacktest(),
    insights: [],
    trend: {
      direction: "stable",
      bookingSlopePerMonth: 0,
      revenueSlopePerMonth: 0,
      stableThresholdBookings: STABLE_BOOKING_SLOPE_THRESHOLD,
    },
    model: null,
    monthsUsed: [],
    monthlyDataset,
    weightedInputs: [],
    metadata: forecastMetadata(),
  };
}

function forecastMetadata(): IntelligentSalesForecast["metadata"] {
  return {
    sourceDateField: "created_at",
    method: "explainable_hybrid_predictive_forecasting_model",
    formula: "gross forecast = weighted blend of recent total demand, linear trend projection, historical average, and same-month seasonality when available; expected bookings = gross forecast * (1 - weighted cancellation rate); revenue = projected package/custom mix * historical average value by booking type",
    weightProfiles: MODEL_WEIGHT_PROFILES,
    recentWindowMonths: RECENT_WINDOW_MONTHS,
    backtestMinimumHistoryMonths: BACKTEST_MIN_HISTORY_MONTHS,
    includedDemandStatuses: DEMAND_STATUSES,
    cancelledStatuses: ["cancelled"],
    packageRule: "package_type === custom-booking is custom; all other bookings are package",
    valueSource: "booking_payments.total_booking_amount, falling back to bookings.total_price when no payment record exists",
  };
}

function weightProfile(historyLength: number): ForecastModelWeights {
  if (historyLength >= SEASONAL_MIN_HISTORY_MONTHS) return MODEL_WEIGHT_PROFILES.seasonalHistory.weights;
  if (historyLength >= MODEL_WEIGHT_PROFILES.developingHistory.minMonths) return MODEL_WEIGHT_PROFILES.developingHistory.weights;
  return MODEL_WEIGHT_PROFILES.limitedHistory.weights;
}

function normalizeWeights(
  weights: ForecastModelWeights,
  available: Record<keyof ForecastModelWeights, boolean>,
): ForecastModelWeights {
  const active = {
    recentDemand: available.recentDemand ? weights.recentDemand : 0,
    linearTrend: available.linearTrend ? weights.linearTrend : 0,
    historicalAverage: available.historicalAverage ? weights.historicalAverage : 0,
    seasonality: available.seasonality ? weights.seasonality : 0,
  };
  const total = active.recentDemand + active.linearTrend + active.historicalAverage + active.seasonality;
  if (!total) return { recentDemand: 1, linearTrend: 0, historicalAverage: 0, seasonality: 0 };
  return {
    recentDemand: active.recentDemand / total,
    linearTrend: active.linearTrend / total,
    historicalAverage: active.historicalAverage / total,
    seasonality: active.seasonality / total,
  };
}

function sameCalendarMonthValues(
  history: ForecastMonthInput[],
  targetMonth: string,
  selector: (month: ForecastMonthInput) => number,
): number[] {
  const targetMonthNumber = targetMonth.slice(5, 7);
  return history
    .filter((month) => month.month.slice(5, 7) === targetMonthNumber)
    .map(selector);
}

function cancellationRate(month: ForecastMonthInput): number | null {
  return month.totalBookings ? month.cancelledBookings / month.totalBookings : null;
}

function weightedCancellationRate(history: ForecastMonthInput[]): number {
  const recentMonths = history.slice(-RECENT_WINDOW_MONTHS).filter((month) => cancellationRate(month) !== null);
  const source = recentMonths.length ? recentMonths : history.filter((month) => cancellationRate(month) !== null);
  if (!source.length) return 0;
  const weights = source.map((_month, index) => index + 1);
  return clamp(weightedAverage(source.map((month) => cancellationRate(month) ?? 0), weights), 0, 0.9);
}

function weightedTypeShare(history: ForecastMonthInput[]): { packageShare: number | null; customShare: number | null } {
  const source = history.slice(-RECENT_WINDOW_MONTHS).filter((month) => month.securedCompletedBookings > 0);
  const months = source.length ? source : history.filter((month) => month.securedCompletedBookings > 0);
  if (!months.length) return { packageShare: null, customShare: null };
  const weights = months.map((_month, index) => index + 1);
  const packageDemand = weightedAverage(months.map((month) => month.securedPackageBookings), weights);
  const customDemand = weightedAverage(months.map((month) => month.securedCustomBookings), weights);
  const total = packageDemand + customDemand;
  if (!total) return { packageShare: null, customShare: null };
  return { packageShare: packageDemand / total, customShare: customDemand / total };
}

function weightedAverageValue(
  history: ForecastMonthInput[],
  countSelector: (month: ForecastMonthInput) => number,
  valueSelector: (month: ForecastMonthInput) => number,
): number | null {
  const source = history.slice(-RECENT_WINDOW_MONTHS).filter((month) => countSelector(month) > 0);
  const months = source.length ? source : history.filter((month) => countSelector(month) > 0);
  if (!months.length) return null;
  const weights = months.map((_month, index) => index + 1);
  return weightedAverage(months.map((month) => valueSelector(month) / countSelector(month)), weights);
}

function packageDisplayName(booking: ForecastBooking, packageNames: Record<string, string>): string {
  if (booking.package_id) return packageNames[booking.package_id] ?? booking.package_type ?? "Unspecified package";
  return PACKAGE_LABELS[booking.package_type ?? ""] ?? booking.package_type ?? "Unspecified package";
}

function bookingVenueIds(booking: ForecastBooking): string[] {
  return [...new Set([booking.venue_id, ...(booking.venue_ids ?? [])].filter((id): id is string => Boolean(id)))];
}

function weightedTopPackage(
  bookings: Array<ForecastBooking & { status: BookingStatus; createdMonth: string }>,
  recentMonths: ForecastMonthInput[],
  packageNames: Record<string, string>,
): string | null {
  const weightsByMonth = new Map(recentMonths.map((month, index) => [month.month, index + 1]));
  const scores = new Map<string, { label: string; score: number }>();
  for (const booking of bookings) {
    if (!DEMAND_STATUSES.includes(booking.status) || booking.package_type === "custom-booking") continue;
    const weight = weightsByMonth.get(booking.createdMonth);
    if (!weight) continue;
    const key = booking.package_id ?? booking.package_type ?? "unspecified";
    const current = scores.get(key) ?? { label: packageDisplayName(booking, packageNames), score: 0 };
    current.score += weight;
    scores.set(key, current);
  }
  const [top] = [...scores.values()].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return top?.score ? top.label : null;
}

function weightedBusiestVenue(
  bookings: Array<ForecastBooking & { status: BookingStatus; createdMonth: string }>,
  recentMonths: ForecastMonthInput[],
  venueNames: Record<string, string>,
): string | null {
  const weightsByMonth = new Map(recentMonths.map((month, index) => [month.month, index + 1]));
  const scores = new Map<string, { label: string; score: number }>();
  for (const booking of bookings) {
    if (!DEMAND_STATUSES.includes(booking.status)) continue;
    const weight = weightsByMonth.get(booking.createdMonth);
    if (!weight) continue;
    for (const venueId of bookingVenueIds(booking)) {
      const current = scores.get(venueId) ?? { label: venueNames[venueId] ?? "Unknown venue", score: 0 };
      current.score += weight;
      scores.set(venueId, current);
    }
  }
  const [top] = [...scores.values()].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
  return top?.score ? top.label : null;
}

interface ForecastProjection {
  expectedBookingsRaw: number;
  expectedRevenueRaw: number | null;
  expectedPackageBookingsRaw: number | null;
  expectedCustomBookingsRaw: number | null;
  expectedAverageBookingValueRaw: number | null;
  cancellationRate: number;
  expectedCancelledBookingsRaw: number;
  components: NonNullable<IntelligentSalesForecast["model"]>["components"];
  weights: ForecastModelWeights;
  bookingSlope: number;
  revenueSlope: number;
}

function projectFromHistory(history: ForecastMonthInput[], targetMonth: string): ForecastProjection {
  const recentMonths = history.slice(-RECENT_WINDOW_MONTHS);
  const recentWeights = recentMonths.map((_month, index) => index + 1);
  const totalBookingValues = history.map((month) => month.totalBookings);
  const securedBookingValues = history.map((month) => month.securedCompletedBookings);
  const securedRevenueValues = history.map((month) => month.securedCompletedValue);
  const sameMonthTotals = sameCalendarMonthValues(history, targetMonth, (month) => month.totalBookings);
  const hasSeasonality = history.length >= SEASONAL_MIN_HISTORY_MONTHS && sameMonthTotals.length > 0;
  const recentDemand = weightedAverage(recentMonths.map((month) => month.totalBookings), recentWeights);
  const linearTrend = linearProjection(totalBookingValues);
  const historicalAverage = average(totalBookingValues);
  const seasonality = hasSeasonality ? average(sameMonthTotals) : null;
  const weights = normalizeWeights(weightProfile(history.length), {
    recentDemand: recentMonths.length > 0,
    linearTrend: history.length > 1,
    historicalAverage: history.length > 0,
    seasonality: hasSeasonality,
  });
  const grossForecast = Math.max(0,
    recentDemand * weights.recentDemand
    + linearTrend * weights.linearTrend
    + historicalAverage * weights.historicalAverage
    + (seasonality ?? 0) * weights.seasonality,
  );
  const rate = weightedCancellationRate(history);
  const expectedBookingsRaw = Math.max(0, grossForecast * (1 - rate));

  const { packageShare, customShare } = weightedTypeShare(history);
  const expectedPackageBookingsRaw = packageShare === null ? null : expectedBookingsRaw * packageShare;
  const expectedCustomBookingsRaw = customShare === null ? null : expectedBookingsRaw * customShare;
  const averagePackageValue = weightedAverageValue(
    history,
    (month) => month.securedPackageBookings,
    (month) => month.securedPackageValue,
  );
  const averageCustomValue = weightedAverageValue(
    history,
    (month) => month.securedCustomBookings,
    (month) => month.securedCustomValue,
  );
  const canProjectRevenue =
    expectedPackageBookingsRaw !== null
    && expectedCustomBookingsRaw !== null
    && (expectedPackageBookingsRaw <= 0 || averagePackageValue !== null)
    && (expectedCustomBookingsRaw <= 0 || averageCustomValue !== null);
  const expectedRevenueRaw = canProjectRevenue
    ? expectedPackageBookingsRaw * (averagePackageValue ?? 0) + expectedCustomBookingsRaw * (averageCustomValue ?? 0)
    : null;
  const expectedAverageBookingValueRaw = expectedRevenueRaw !== null && expectedBookingsRaw > 0
    ? expectedRevenueRaw / expectedBookingsRaw
    : null;

  return {
    expectedBookingsRaw,
    expectedRevenueRaw,
    expectedPackageBookingsRaw,
    expectedCustomBookingsRaw,
    expectedAverageBookingValueRaw,
    cancellationRate: rate,
    expectedCancelledBookingsRaw: grossForecast * rate,
    components: {
      recentDemand: roundMetric(recentDemand),
      linearTrend: roundMetric(linearTrend),
      historicalAverage: roundMetric(historicalAverage),
      seasonality: seasonality === null ? null : roundMetric(seasonality),
      cancellationRate: roundMetric(rate * 100),
    },
    weights: {
      recentDemand: roundMetric(weights.recentDemand),
      linearTrend: roundMetric(weights.linearTrend),
      historicalAverage: roundMetric(weights.historicalAverage),
      seasonality: roundMetric(weights.seasonality),
    },
    bookingSlope: linearSlope(securedBookingValues),
    revenueSlope: linearSlope(securedRevenueValues),
  };
}

function calculateBacktest(dataset: ForecastMonthInput[]): ForecastBacktestSummary {
  if (dataset.length <= BACKTEST_MIN_HISTORY_MONTHS) return emptyBacktest();
  const evaluations: Array<{
    targetMonth: string;
    bookingError: number;
    revenueError: number | null;
    actualBookings: number;
    actualRevenue: number;
  }> = [];

  for (let index = BACKTEST_MIN_HISTORY_MONTHS; index < dataset.length; index++) {
    const history = dataset.slice(0, index);
    const actual = dataset[index];
    const projection = projectFromHistory(history, actual.month);
    evaluations.push({
      targetMonth: actual.month,
      bookingError: Math.abs(projection.expectedBookingsRaw - actual.securedCompletedBookings),
      revenueError: projection.expectedRevenueRaw === null
        ? null
        : Math.abs(projection.expectedRevenueRaw - actual.securedCompletedValue),
      actualBookings: actual.securedCompletedBookings,
      actualRevenue: actual.securedCompletedValue,
    });
  }

  if (!evaluations.length) return emptyBacktest();
  const revenueErrors = evaluations
    .map((evaluation) => evaluation.revenueError)
    .filter((value): value is number => value !== null);

  return {
    available: true,
    evaluationCount: evaluations.length,
    targetMonths: evaluations.map((evaluation) => evaluation.targetMonth),
    bookingMae: roundMetric(average(evaluations.map((evaluation) => evaluation.bookingError))),
    revenueMae: revenueErrors.length ? roundMoney(average(revenueErrors)) : null,
    averageActualBookings: roundMetric(average(evaluations.map((evaluation) => evaluation.actualBookings))),
    averageActualRevenue: roundMoney(average(evaluations.map((evaluation) => evaluation.actualRevenue))),
  };
}

function bookingRange(expectedBookingsRaw: number, dataset: ForecastMonthInput[], backtest: ForecastBacktestSummary): ForecastRange {
  const historicalVariability = standardDeviation(dataset.map((month) => month.securedCompletedBookings));
  const error = Math.max(historicalVariability, backtest.bookingMae ?? 0);
  const low = Math.max(0, Math.floor(expectedBookingsRaw - error));
  const high = Math.max(low, Math.ceil(expectedBookingsRaw + error));
  return { low, high };
}

function revenueRange(expectedRevenueRaw: number | null, dataset: ForecastMonthInput[], backtest: ForecastBacktestSummary): ForecastRange | null {
  if (expectedRevenueRaw === null) return null;
  const historicalVariability = standardDeviation(dataset.map((month) => month.securedCompletedValue));
  const error = Math.max(historicalVariability, backtest.revenueMae ?? 0);
  return {
    low: roundMoney(Math.max(0, expectedRevenueRaw - error)),
    high: roundMoney(Math.max(0, expectedRevenueRaw + error)),
  };
}

function calculateConfidence(
  dataset: ForecastMonthInput[],
  projection: ForecastProjection,
  backtest: ForecastBacktestSummary,
): IntelligentSalesForecast["confidence"] {
  const securedBookings = dataset.map((month) => month.securedCompletedBookings);
  const meanDemand = average(securedBookings);
  const volatility = meanDemand > 0 ? standardDeviation(securedBookings) / meanDemand : 1;
  const historyScore = roundMetric(clamp((dataset.length / 12) * 35, 5, 35));
  const consistencyScore = roundMetric(clamp((1 - clamp(volatility, 0, 1.5) / 1.5) * 25, 0, 25));
  const targetMonth = monthKey(addMonths(parseMonth(dataset[dataset.length - 1].month), 1));
  const seasonalHistoryCount = sameCalendarMonthValues(dataset, targetMonth, (month) => month.totalBookings).length;
  const seasonalityScore = dataset.length >= 24
    ? 15
    : dataset.length >= SEASONAL_MIN_HISTORY_MONTHS && projection.weights.seasonality > 0
      ? 10
      : 0;
  const relativeBacktestError = backtest.available && backtest.bookingMae !== null && backtest.averageActualBookings
    ? backtest.bookingMae / Math.max(backtest.averageActualBookings, 1)
    : null;
  const backtestScore = relativeBacktestError === null
    ? 5
    : roundMetric(clamp((1 - clamp(relativeBacktestError, 0, 1)) * 25, 0, 25));
  const score = Math.round(clamp(historyScore + consistencyScore + seasonalityScore + backtestScore, 0, 100));
  const label: ForecastConfidenceLabel = score >= 75 ? "High" : score >= 50 ? "Moderate" : "Low";

  return {
    score,
    label,
    factors: [
      {
        name: "History length",
        score: historyScore,
        description: `${dataset.length} month${dataset.length === 1 ? "" : "s"} of usable history.`,
      },
      {
        name: "Demand consistency",
        score: consistencyScore,
        description: `Historical booking volatility is ${roundMetric(volatility * 100)}% of average demand.`,
      },
      {
        name: "Seasonality",
        score: seasonalityScore,
        description: projection.weights.seasonality > 0
          ? `${seasonalHistoryCount} same-calendar-month point${seasonalHistoryCount === 1 ? "" : "s"} can influence the model.`
          : "Seasonality is disabled until at least 12 months of history exist.",
      },
      {
        name: "Backtest error",
        score: backtestScore,
        description: backtest.available && backtest.bookingMae !== null
          ? `Rolling booking MAE is ${backtest.bookingMae}.`
          : "Not enough prior months for rolling backtesting yet.",
      },
    ],
  };
}

function buildInsights(
  projection: ForecastProjection,
  confidence: IntelligentSalesForecast["confidence"],
  likelyTopPackage: string | null,
  likelyBusiestVenue: string | null,
  backtest: ForecastBacktestSummary,
): string[] {
  const insights: string[] = [];
  const direction = trendDirection(projection.bookingSlope);
  if (direction === "stable") {
    insights.push(`Demand is broadly stable, with a ${roundMetric(projection.bookingSlope)} booking/month trend.`);
  } else {
    insights.push(`Demand is ${direction}, with a ${roundMetric(projection.bookingSlope)} booking/month trend.`);
  }
  insights.push(`The recent cancellation estimate is ${roundMetric(projection.cancellationRate * 100)}%, reducing gross projected demand by ${Math.round(projection.expectedCancelledBookingsRaw)} booking${Math.round(projection.expectedCancelledBookingsRaw) === 1 ? "" : "s"}.`);
  if (projection.weights.seasonality > 0 && projection.components.seasonality !== null) {
    insights.push("Seasonality is active because enough same-month history exists for this target month.");
  } else if (confidence.label === "Low") {
    insights.push("Forecast confidence is low because usable history, seasonality, or backtest coverage is still limited.");
  }
  if (likelyTopPackage) {
    insights.push(`${likelyTopPackage} leads the weighted recent package demand.`);
  } else if (likelyBusiestVenue) {
    insights.push(`${likelyBusiestVenue} is the busiest venue in weighted recent booking history.`);
  } else if (backtest.available && backtest.bookingMae !== null) {
    insights.push(`Rolling backtests show an average booking error of ${backtest.bookingMae}.`);
  }
  return insights.slice(0, 4);
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
  context: ForecastContext = {},
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
    securedPackageValue: 0,
    securedCustomValue: 0,
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
      if (isCustom) {
        month.securedCustomBookings++;
        month.securedCustomValue += value;
      } else {
        month.securedPackageBookings++;
        month.securedPackageValue += value;
      }
    }
  }

  const roundedDataset = dataset.map((month) => ({
    ...month,
    totalBookingValue: roundMoney(month.totalBookingValue),
    securedCompletedValue: roundMoney(month.securedCompletedValue),
    securedPackageValue: roundMoney(month.securedPackageValue),
    securedCustomValue: roundMoney(month.securedCustomValue),
    cancelledBookingValue: roundMoney(month.cancelledBookingValue),
    retainedCancellationRevenue: roundMoney(month.retainedCancellationRevenue),
  }));
  const projection = projectFromHistory(roundedDataset, targetMonth);
  const backtest = calculateBacktest(roundedDataset);
  const confidence = calculateConfidence(roundedDataset, projection, backtest);
  const recentMonths = roundedDataset.slice(-RECENT_WINDOW_MONTHS);
  const likelyTopPackage = weightedTopPackage(validBookings, recentMonths, context.packageNames ?? {});
  const likelyBusiestVenue = weightedBusiestVenue(validBookings, recentMonths, context.venueNames ?? {});
  const expectedBookings = Math.round(projection.expectedBookingsRaw);
  const expectedRevenue = projection.expectedRevenueRaw === null ? null : roundMoney(projection.expectedRevenueRaw);
  const expectedPackageBookings = projection.expectedPackageBookingsRaw === null
    ? null
    : Math.round(projection.expectedPackageBookingsRaw);
  const insights = buildInsights(projection, confidence, likelyTopPackage, likelyBusiestVenue, backtest);

  return {
    available: true,
    message: null,
    targetMonth,
    expectedBookings,
    bookingRange: bookingRange(projection.expectedBookingsRaw, roundedDataset, backtest),
    expectedRevenue,
    revenueRange: revenueRange(projection.expectedRevenueRaw, roundedDataset, backtest),
    expectedPackageBookings,
    expectedCustomBookings: projection.expectedCustomBookingsRaw === null || expectedPackageBookings === null
      ? null
      : Math.max(0, expectedBookings - expectedPackageBookings),
    likelyTopPackage,
    likelyBusiestVenue,
    expectedAverageBookingValue: projection.expectedAverageBookingValueRaw === null ? null : roundMoney(projection.expectedAverageBookingValueRaw),
    cancellationEstimate: {
      rate: roundMetric(projection.cancellationRate * 100),
      expectedCancelledBookings: Math.round(projection.expectedCancelledBookingsRaw),
    },
    confidence,
    backtest,
    insights,
    trend: {
      direction: trendDirection(projection.bookingSlope),
      bookingSlopePerMonth: roundMetric(projection.bookingSlope),
      revenueSlopePerMonth: roundMoney(projection.revenueSlope),
      stableThresholdBookings: STABLE_BOOKING_SLOPE_THRESHOLD,
    },
    model: {
      components: projection.components,
      weights: projection.weights,
    },
    monthsUsed: recentMonths.map((month) => month.month),
    monthlyDataset: roundedDataset,
    weightedInputs: recentMonths.map((month, index) => {
      const rate = cancellationRate(month);
      return {
        month: month.month,
        weight: index + 1,
        totalBookings: month.totalBookings,
        securedCompletedBookings: month.securedCompletedBookings,
        securedCompletedValue: month.securedCompletedValue,
        cancellationRate: rate === null ? null : roundMetric(rate * 100),
      };
    }),
    metadata: forecastMetadata(),
  };
}
