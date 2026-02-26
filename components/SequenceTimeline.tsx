"use client"

import { motion } from "framer-motion"
import {
  CheckCircle2,
  Clock,
  Mail,
  Pause,
  Play,
  SkipForward,
} from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { cn } from "@/lib/utils"
import { getSequenceStatusLabel } from "@/lib/sequence-engine"
import type {
  SequenceEnrollmentStep,
  SequenceStep,
} from "@/lib/types/sequence"

interface SequenceTimelineProps {
  steps: SequenceStep[]
  enrollmentSteps: SequenceEnrollmentStep[]
  enrollmentStatus: string
  onAction?: (action: string, enrollmentStepId?: string) => void
}

type StepStyleKey = "pending" | "sent" | "skipped" | "bounced" | "replied"

const NODE_STYLES: Record<
  StepStyleKey,
  { bg: string; text: string; border: string; badge: string }
> = {
  pending: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-300",
    badge: "border-amber-200 bg-amber-50 text-amber-700",
  },
  sent: {
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-300",
    badge: "border-green-200 bg-green-50 text-green-700",
  },
  skipped: {
    bg: "bg-slate-50",
    text: "text-slate-500",
    border: "border-slate-200",
    badge: "border-slate-200 bg-slate-50 text-slate-500",
  },
  bounced: {
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-300",
    badge: "border-red-200 bg-red-50 text-red-700",
  },
  replied: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-300",
    badge: "border-blue-200 bg-blue-50 text-blue-700",
  },
}

const ENROLLMENT_BADGE: Record<string, string> = {
  active: "border-blue-200 bg-blue-50 text-blue-700",
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  completed: "border-green-200 bg-green-50 text-green-700",
  replied: "border-violet-200 bg-violet-50 text-violet-700",
  bounced: "border-red-200 bg-red-50 text-red-700",
  paused: "border-amber-200 bg-amber-50 text-amber-700",
  unsubscribed: "border-amber-200 bg-amber-50 text-amber-700",
  removed: "border-slate-300 bg-slate-100 text-slate-700",
  not_started: "border-slate-200 bg-slate-50 text-slate-600",
}

export function SequenceTimeline({
  steps,
  enrollmentSteps,
  enrollmentStatus,
  onAction,
}: SequenceTimelineProps) {
  const stepMap = new Map(enrollmentSteps.map((es) => [es.step_id, es]))

  // Build cumulative day offsets
  let cumulativeDay = 1
  const stepsWithDay = steps.map((step, i) => {
    const day = i === 0 ? 1 : cumulativeDay
    cumulativeDay += step.delay_days
    return { ...step, day }
  })

  const totalDuration = steps.reduce((sum, s) => sum + s.delay_days, 0)
  const isPausedLike = enrollmentStatus === "paused" || enrollmentStatus === "unsubscribed"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Timeline</CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "text-[11px]",
              ENROLLMENT_BADGE[enrollmentStatus] ?? ENROLLMENT_BADGE.not_started
            )}
          >
            {getSequenceStatusLabel(enrollmentStatus)}
          </Badge>
        </div>

        {/* Enrollment-level actions */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 text-xs"
            onClick={() => onAction?.("mark_replied")}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Got Reply
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => onAction?.("mark_bounced")}
          >
            Mark Bounced
          </Button>
          {isPausedLike ? (
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              style={{ backgroundColor: "#7C3AED", color: "#fff" }}
              onClick={() => onAction?.("resume_enrollment")}
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => onAction?.("pause_enrollment")}
            >
              <Pause className="h-3.5 w-3.5" />
              Pause
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-5">
        <div className="relative">
          {/* Vertical connecting line */}
          <div
            className="absolute left-[15px] top-4 bottom-4 w-px bg-border"
            aria-hidden
          />

          <div className="space-y-0">
            {stepsWithDay.map((step, i) => {
              const es = stepMap.get(step.id)
              const rawStatus = es?.status ?? "pending"
              const styleKey: StepStyleKey =
                rawStatus in NODE_STYLES
                  ? (rawStatus as StepStyleKey)
                  : "pending"
              const status = styleKey
              const styles = NODE_STYLES[styleKey]
              const isLast = i === stepsWithDay.length - 1

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.25 }}
                  className={cn("flex gap-3 relative", !isLast && "pb-6")}
                >
                  {/* Node circle */}
                  <div
                    className={cn(
                      "z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold",
                      styles.bg,
                      styles.text,
                      styles.border
                    )}
                  >
                    {status === "sent" || status === "replied" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      step.order
                    )}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm font-medium">
                          Step {step.order}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className="h-4 px-1.5 text-[10px] font-medium border-violet-200 bg-violet-50 text-violet-700"
                      >
                        Day {step.day}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-4 px-1.5 text-[10px] font-medium capitalize",
                          styles.badge
                        )}
                      >
                        {status}
                      </Badge>
                    </div>

                    <p className="mt-0.5 truncate text-sm font-medium text-foreground">
                      {es?.subject_override ?? step.subject}
                    </p>

                    {es?.scheduled_for && (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(es.scheduled_for).toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric" }
                        )}
                      </p>
                    )}

                    {status === "pending" && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <Button
                          size="sm"
                          className="h-6 px-2 text-xs"
                          style={{ backgroundColor: "#7C3AED", color: "#fff" }}
                          onClick={() => onAction?.("mark_sent", es?.id)}
                        >
                          Mark Sent
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 gap-1 px-2 text-xs"
                          onClick={() => onAction?.("skip_step", es?.id)}
                        >
                          <SkipForward className="h-3 w-3" />
                          Skip
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>

          {/* Total duration footer */}
          {totalDuration > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: stepsWithDay.length * 0.08 + 0.1 }}
              className="flex items-center gap-2 pt-1"
            >
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] text-muted-foreground">
                Spans {totalDuration} day
                {totalDuration !== 1 ? "s" : ""}
              </span>
              <div className="h-px flex-1 bg-border" />
            </motion.div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
