import { Sequence, SequenceStats } from "@/lib/types/sequence";

/**
 * Calculate open rate.
 * @param {SequenceStats} stats - Stats input.
 * @returns {number} Computed number.
 * @example
 * calculateOpenRate({})
 */
export function calculateOpenRate(stats: SequenceStats): number {
  if (stats.emailsSent === 0) return 0;
  return Math.round((stats.opened / stats.emailsSent) * 100);
}

/**
 * Calculate reply rate.
 * @param {SequenceStats} stats - Stats input.
 * @returns {number} Computed number.
 * @example
 * calculateReplyRate({})
 */
export function calculateReplyRate(stats: SequenceStats): number {
  if (stats.emailsSent === 0) return 0;
  return Math.round((stats.replied / stats.emailsSent) * 100);
}

/**
 * Calculate bounce rate.
 * @param {SequenceStats} stats - Stats input.
 * @returns {number} Computed number.
 * @example
 * calculateBounceRate({})
 */
export function calculateBounceRate(stats: SequenceStats): number {
  if (stats.emailsSent === 0) return 0;
  return Math.round((stats.bounced / stats.emailsSent) * 100);
}

/**
 * Get status color.
 * @param {Sequence["status"]} status - Status input.
 * @returns {{
  bg: string;
  text: string;
  border: string;
}} Computed { bg: string; text: string; border: string; }.
 * @example
 * getStatusColor({})
 */
export function getStatusColor(
  status: Sequence["status"]
): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case "active":
      return {
        bg: "bg-blue-500/10",
        text: "text-blue-500",
        border: "border-blue-500/20",
      };
    case "paused":
      return {
        bg: "bg-yellow-500/10",
        text: "text-yellow-500",
        border: "border-yellow-500/20",
      };
    case "completed":
      return {
        bg: "bg-green-500/10",
        text: "text-green-500",
        border: "border-green-500/20",
      };
    case "draft":
      return {
        bg: "bg-gray-500/10",
        text: "text-gray-500",
        border: "border-gray-500/20",
      };
    default:
      return {
        bg: "bg-gray-500/10",
        text: "text-gray-500",
        border: "border-gray-500/20",
      };
  }
}

/**
 * Get status label.
 * @param {Sequence["status"]} status - Status input.
 * @returns {string} Computed string.
 * @example
 * getStatusLabel({})
 */
export function getStatusLabel(status: Sequence["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "completed":
      return "Completed";
    case "draft":
      return "Draft";
    default:
      return "Unknown";
  }
}

/**
 * Calculate estimated duration.
 * @param {Sequence} sequence - Sequence input.
 * @returns {number} Computed number.
 * @example
 * calculateEstimatedDuration({})
 */
export function calculateEstimatedDuration(sequence: Sequence): number {
  if (!sequence.steps || sequence.steps.length === 0) return 0;

  return sequence.steps.reduce((total, step) => total + step.delay_days, 0);
}

/**
 * Format duration.
 * @param {number} days - Days input.
 * @returns {string} Computed string.
 * @example
 * formatDuration(0)
 */
export function formatDuration(days: number): string {
  if (days === 0) return "Same day";
  if (days === 1) return "1 day";
  if (days < 7) return `${days} days`;

  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  if (remainingDays === 0) {
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }

  return `${weeks} week${weeks > 1 ? "s" : ""} ${remainingDays} day${remainingDays > 1 ? "s" : ""}`;
}

/**
 * Generate sequence id.
 * @returns {string} Computed string.
 * @example
 * generateSequenceId()
 */
export function generateSequenceId(): string {
  return `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate step id.
 * @returns {string} Computed string.
 * @example
 * generateStepId()
 */
export function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
