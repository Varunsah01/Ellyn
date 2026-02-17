export interface MetricData {
  current: number;
  previous: number;
  change: number;
  trend: "up" | "down" | "neutral";
}

export interface TimeSeriesData {
  date: string;
  value: number;
}

/**
 * Calculate metric change.
 * @param {number} currentValue - Current value input.
 * @param {number} previousValue - Previous value input.
 * @returns {MetricData} Computed MetricData.
 * @example
 * calculateMetricChange(0, 0)
 */
export function calculateMetricChange(
  currentValue: number,
  previousValue: number
): MetricData {
  const change =
    previousValue === 0
      ? 100
      : ((currentValue - previousValue) / previousValue) * 100;

  return {
    current: currentValue,
    previous: previousValue,
    change: Math.round(change * 10) / 10,
    trend: change > 0 ? "up" : change < 0 ? "down" : "neutral",
  };
}

/**
 * Calculate percentage.
 * @param {number} part - Part input.
 * @param {number} total - Total input.
 * @returns {number} Computed number.
 * @example
 * calculatePercentage(0, 0)
 */
export function calculatePercentage(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100 * 10) / 10;
}

/**
 * Calculate average.
 * @param {number[]} values - Values input.
 * @returns {number} Computed number.
 * @example
 * calculateAverage(0)
 */
export function calculateAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/**
 * Generate sparkline data.
 * @param {TimeSeriesData[]} data - Data input.
 * @returns {number[]} Computed number[].
 * @example
 * generateSparklineData([])
 */
export function generateSparklineData(
  data: TimeSeriesData[]
): number[] {
  return data.map((d) => d.value);
}

/**
 * Calculate response time.
 * @param {Date} sentDate - Sent date input.
 * @param {Date} replyDate - Reply date input.
 * @returns {number} Computed number.
 * @example
 * calculateResponseTime(new Date(), new Date())
 */
export function calculateResponseTime(
  sentDate: Date,
  replyDate: Date
): number {
  const diff = replyDate.getTime() - sentDate.getTime();
  return Math.round(diff / (1000 * 60 * 60)); // hours
}

/**
 * Categorize response time.
 * @param {number} hours - Hours input.
 * @returns {string} Computed string.
 * @example
 * categorizeResponseTime(0)
 */
export function categorizeResponseTime(hours: number): string {
  if (hours < 1) return "< 1hr";
  if (hours < 4) return "1-4hrs";
  if (hours < 24) return "4-24hrs";
  if (hours < 72) return "1-3 days";
  if (hours < 168) return "3-7 days";
  return "> 7 days";
}

/**
 * Calculate email health score.
 * @param {{
  bounceRate: number;
  spamRate: number;
  responseRate: number;
  openRate: number;
}} metrics - Metrics input.
 * @returns {{
  score: number;
  grade: string;
  recommendations: string[];
}} Computed { score: number; grade: string; recommendations: string[]; }.
 * @example
 * calculateEmailHealthScore(0)
 */
export function calculateEmailHealthScore(metrics: {
  bounceRate: number;
  spamRate: number;
  responseRate: number;
  openRate: number;
}): {
  score: number;
  grade: string;
  recommendations: string[];
} {
  // Calculate score (0-100)
  let score = 100;

  // Deduct for bounce rate (max -30)
  score -= Math.min(metrics.bounceRate * 3, 30);

  // Deduct for spam rate (max -40)
  score -= Math.min(metrics.spamRate * 4, 40);

  // Add for response rate (max +20)
  score += Math.min(metrics.responseRate * 0.5, 20);

  // Add for open rate (max +10)
  score += Math.min(metrics.openRate * 0.2, 10);

  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine grade
  let grade = "F";
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else if (score >= 60) grade = "D";

  // Generate recommendations
  const recommendations: string[] = [];
  if (metrics.bounceRate > 5) {
    recommendations.push("Reduce bounce rate by verifying email addresses");
  }
  if (metrics.spamRate > 1) {
    recommendations.push("Improve email content to avoid spam filters");
  }
  if (metrics.responseRate < 20) {
    recommendations.push("Personalize emails to increase response rate");
  }
  if (metrics.openRate < 40) {
    recommendations.push("Optimize subject lines to improve open rate");
  }

  return { score, grade, recommendations };
}

/**
 * Format number.
 * @param {number} num - Num input.
 * @param {number} decimals - Decimals input.
 * @returns {string} Computed string.
 * @example
 * formatNumber(0, 0)
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(num);
}

/**
 * Format percentage.
 * @param {number} num - Num input.
 * @param {number} decimals - Decimals input.
 * @returns {string} Computed string.
 * @example
 * formatPercentage(0, 0)
 */
export function formatPercentage(num: number, decimals: number = 1): string {
  return `${formatNumber(num, decimals)}%`;
}

/**
 * Format currency.
 * @param {number} num - Num input.
 * @returns {string} Computed string.
 * @example
 * formatCurrency(0)
 */
export function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
}

/**
 * Get days in range.
 * @param {Date} startDate - Start date input.
 * @param {Date} endDate - End date input.
 * @returns {number} Computed number.
 * @example
 * getDaysInRange(new Date(), new Date())
 */
export function getDaysInRange(startDate: Date, endDate: Date): number {
  const diff = endDate.getTime() - startDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Generate date range.
 * @param {number} days - Days input.
 * @returns {{ startDate: Date; endDate: Date }} Computed { startDate: Date; endDate: Date }.
 * @example
 * generateDateRange(0)
 */
export function generateDateRange(
  days: number
): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return { startDate, endDate };
}

/**
 * Get previous period.
 * @param {Date} startDate - Start date input.
 * @param {Date} endDate - End date input.
 * @returns {{ startDate: Date; endDate: Date }} Computed { startDate: Date; endDate: Date }.
 * @example
 * getPreviousPeriod(new Date(), new Date())
 */
export function getPreviousPeriod(
  startDate: Date,
  endDate: Date
): { startDate: Date; endDate: Date } {
  const days = getDaysInRange(startDate, endDate);
  const previousEndDate = new Date(startDate);
  previousEndDate.setDate(previousEndDate.getDate() - 1);
  const previousStartDate = new Date(previousEndDate);
  previousStartDate.setDate(previousStartDate.getDate() - days);
  return { startDate: previousStartDate, endDate: previousEndDate };
}
