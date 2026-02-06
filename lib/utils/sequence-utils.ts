import { Sequence, SequenceStats } from "@/lib/types/sequence";

export function calculateOpenRate(stats: SequenceStats): number {
  if (stats.emailsSent === 0) return 0;
  return Math.round((stats.opened / stats.emailsSent) * 100);
}

export function calculateReplyRate(stats: SequenceStats): number {
  if (stats.emailsSent === 0) return 0;
  return Math.round((stats.replied / stats.emailsSent) * 100);
}

export function calculateBounceRate(stats: SequenceStats): number {
  if (stats.emailsSent === 0) return 0;
  return Math.round((stats.bounced / stats.emailsSent) * 100);
}

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

export function calculateEstimatedDuration(sequence: Sequence): number {
  if (!sequence.steps || sequence.steps.length === 0) return 0;

  return sequence.steps.reduce((total, step) => total + step.delay_days, 0);
}

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

export function generateSequenceId(): string {
  return `seq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateStepId(): string {
  return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
