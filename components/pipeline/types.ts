export type DealStage =
  | "prospecting"
  | "contacted"
  | "interested"
  | "meeting"
  | "proposal"
  | "won"
  | "lost"

export interface DealContact {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

export interface Deal {
  id: string
  user_id: string
  contact_id: string | null
  title: string
  company: string
  value: number | null
  currency: string
  stage: DealStage
  probability: number
  expected_close: string | null
  lost_reason: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
  contacts: DealContact | null
}

export const STAGE_CONFIG: Record<
  DealStage,
  { label: string; color: string; bg: string; border: string; textColor: string }
> = {
  prospecting: {
    label: "Prospecting",
    color: "#6B7280",
    bg: "bg-gray-100",
    border: "border-gray-300",
    textColor: "text-gray-700",
  },
  contacted: {
    label: "Contacted",
    color: "#3B82F6",
    bg: "bg-blue-50",
    border: "border-blue-300",
    textColor: "text-blue-700",
  },
  interested: {
    label: "Interested",
    color: "#6366F1",
    bg: "bg-indigo-50",
    border: "border-indigo-300",
    textColor: "text-indigo-700",
  },
  meeting: {
    label: "Meeting Scheduled",
    color: "#8B5CF6",
    bg: "bg-purple-50",
    border: "border-purple-300",
    textColor: "text-purple-700",
  },
  proposal: {
    label: "Proposal Sent",
    color: "#F59E0B",
    bg: "bg-amber-50",
    border: "border-amber-300",
    textColor: "text-amber-700",
  },
  won: {
    label: "Won ✓",
    color: "#10B981",
    bg: "bg-green-50",
    border: "border-green-300",
    textColor: "text-green-700",
  },
  lost: {
    label: "Lost ✗",
    color: "#EF4444",
    bg: "bg-red-50",
    border: "border-red-300",
    textColor: "text-red-700",
  },
}

export const STAGE_ORDER: DealStage[] = [
  "prospecting",
  "contacted",
  "interested",
  "meeting",
  "proposal",
  "won",
  "lost",
]

export const LOST_REASONS = [
  "Price",
  "Competitor",
  "Timing",
  "No Budget",
  "No Response",
  "Other",
] as const

export type LostReason = (typeof LOST_REASONS)[number]

export function formatCurrency(
  value: number | null | undefined,
  currency = "USD"
): string {
  if (value == null) return "—"
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${currency} ${value.toLocaleString()}`
  }
}
