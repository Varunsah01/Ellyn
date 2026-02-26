"use client"

import { Flame, Sun, Snowflake } from "lucide-react"
import { cn } from "@/lib/utils"
import type { LeadScore } from "@/lib/lead-scoring"

interface LeadScoreCellProps {
  score: LeadScore
  /** job_seeker shows "Engagement" labels instead of hot/warm/cold */
  isJobSeeker?: boolean
}

const GRADE_CONFIG = {
  hot: {
    icon: Flame,
    bg: "bg-red-100",
    text: "text-red-600",
    label: "Hot",
    engagementLabel: "Active",
  },
  warm: {
    icon: Sun,
    bg: "bg-amber-100",
    text: "text-amber-600",
    label: "Warm",
    engagementLabel: "Interested",
  },
  cold: {
    icon: Snowflake,
    bg: "bg-blue-100",
    text: "text-blue-500",
    label: "Cold",
    engagementLabel: "No Response",
  },
} as const

export function LeadScoreCell({ score, isJobSeeker = false }: LeadScoreCellProps) {
  const cfg = GRADE_CONFIG[score.grade]
  const Icon = cfg.icon
  const label = isJobSeeker ? cfg.engagementLabel : cfg.label

  return (
    <div className="group relative inline-flex items-center gap-1.5">
      <div className={cn("flex items-center gap-1 rounded-full px-2 py-0.5", cfg.bg)}>
        <Icon className={cn("h-3 w-3", cfg.text)} />
        <span className={cn("text-xs font-semibold tabular-nums", cfg.text)}>
          {score.score}
        </span>
      </div>
      <span className={cn("text-[10px] font-medium hidden sm:inline", cfg.text)}>
        {label}
      </span>

      {/* Tooltip */}
      {score.signals.length > 0 && (
        <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 hidden group-hover:block w-52">
          <div className="rounded-lg border bg-popover shadow-lg px-3 py-2 text-xs space-y-1">
            <p className="font-semibold text-popover-foreground mb-1.5">
              {isJobSeeker ? "Engagement signals" : "Lead signals"}
            </p>
            {score.signals.map((s, i) => (
              <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-1 w-1 rounded-full bg-primary flex-shrink-0" />
                {s}
              </div>
            ))}
          </div>
          {/* Arrow */}
          <div className="w-2 h-2 bg-popover border-b border-r rotate-45 ml-3 -mt-1 border-t-0 border-l-0" />
        </div>
      )}
    </div>
  )
}
