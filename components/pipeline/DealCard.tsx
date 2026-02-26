"use client"

import { format, isPast, parseISO } from "date-fns"
import { GripVertical, Calendar, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { formatCurrency, type Deal } from "./types"

function ProbabilityPill({ value }: { value: number }) {
  const color =
    value >= 70
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : value >= 40
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-red-100 text-red-700 border-red-200"
  return (
    <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full border", color)}>
      {value}%
    </span>
  )
}

function LeadHeat({ probability }: { probability: number }) {
  if (probability >= 70) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-medium text-red-500">
        <TrendingUp className="h-3 w-3" />
        Hot
      </span>
    )
  }
  if (probability >= 40) {
    return (
      <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-500">
        <TrendingUp className="h-3 w-3" />
        Warm
      </span>
    )
  }
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-medium text-slate-400">
      <TrendingUp className="h-3 w-3" />
      Cold
    </span>
  )
}

interface DealCardProps {
  deal: Deal
  isDragging?: boolean
  onClick: () => void
}

export function DealCard({ deal, isDragging, onClick }: DealCardProps) {
  const contactName = deal.contacts
    ? `${deal.contacts.first_name} ${deal.contacts.last_name}`.trim()
    : null

  const closeDate = deal.expected_close ? parseISO(deal.expected_close) : null
  const isOverdue =
    closeDate && isPast(closeDate) && deal.stage !== "won" && deal.stage !== "lost"

  return (
    <div
      className={cn(
        "group rounded-lg border bg-card p-3 cursor-pointer select-none transition-all",
        "hover:border-primary/40 hover:shadow-md",
        isDragging
          ? "shadow-xl ring-2 ring-primary/50 scale-[1.03] rotate-0.5 z-50"
          : "shadow-sm"
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight truncate">{deal.company}</p>
          {contactName && (
            <p className="text-xs text-muted-foreground truncate">{contactName}</p>
          )}
        </div>
        <GripVertical className="h-4 w-4 text-muted-foreground/30 flex-shrink-0 mt-0.5 group-hover:text-muted-foreground/60 transition-colors" />
      </div>

      {/* Title */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{deal.title}</p>

      {/* Value row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-semibold text-foreground">
          {formatCurrency(deal.value, deal.currency)}
        </span>
        <ProbabilityPill value={deal.probability} />
      </div>

      {/* Meta row */}
      <div className="flex items-center justify-between">
        <LeadHeat probability={deal.probability} />
        {closeDate && (
          <span
            className={cn(
              "flex items-center gap-1 text-[10px]",
              isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
            )}
          >
            <Calendar className="h-3 w-3 flex-shrink-0" />
            {isOverdue ? "Overdue · " : ""}
            {format(closeDate, "MMM d")}
          </span>
        )}
      </div>

      {/* Tags */}
      {deal.tags && deal.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {deal.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {tag}
            </Badge>
          ))}
          {deal.tags.length > 2 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              +{deal.tags.length - 2}
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
