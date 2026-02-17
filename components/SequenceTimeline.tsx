"use client"

import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { SequenceEnrollmentStep, SequenceStep } from "@/lib/types/sequence"
import { getSequenceStatusLabel } from "@/lib/sequence-engine"
import { cn } from "@/lib/utils"
import { CheckCircle2, Pause, Play, SkipForward } from "lucide-react"

interface SequenceTimelineProps {
  steps: SequenceStep[]
  enrollmentSteps: SequenceEnrollmentStep[]
  enrollmentStatus: string
  onAction?: (action: string, enrollmentStepId?: string) => void
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  sent: "bg-green-500/10 text-green-600 border-green-500/20",
  skipped: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  bounced: "bg-red-500/10 text-red-600 border-red-500/20",
  replied: "bg-blue-500/10 text-blue-600 border-blue-500/20",
}

/**
 * Render the SequenceTimeline component.
 * @param {SequenceTimelineProps} props - Component props.
 * @returns {unknown} JSX output for SequenceTimeline.
 * @example
 * <SequenceTimeline />
 */
export function SequenceTimeline({
  steps,
  enrollmentSteps,
  enrollmentStatus,
  onAction,
}: SequenceTimelineProps) {
  const stepsById = new Map(enrollmentSteps.map((step) => [step.step_id, step]))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Sequence Timeline</CardTitle>
          <Badge variant="outline">{getSequenceStatusLabel(enrollmentStatus)}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onAction?.("mark_replied")}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Mark Replied
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAction?.("mark_bounced")}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Mark Bounced
          </Button>
          {enrollmentStatus === "paused" ? (
            <Button size="sm" onClick={() => onAction?.("resume_enrollment")}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={() => onAction?.("pause_enrollment")}>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step) => {
          const enrollmentStep = stepsById.get(step.id)
          const status = enrollmentStep?.status ?? "pending"
          return (
            <div key={step.id} className="flex items-start gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center border text-sm font-semibold",
                    statusStyles[status] ?? "border-muted text-muted-foreground"
                  )}
                >
                  {step.order}
                </div>
                <div className="flex-1 w-px bg-border mt-2" />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">Step {step.order}</p>
                    <p className="text-xs text-muted-foreground">
                      Delay: {step.delay_days} days
                    </p>
                  </div>
                  <Badge variant="outline" className={statusStyles[status] ?? ""}>
                    {status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {enrollmentStep?.subject_override || step.subject}
                </p>
                {enrollmentStep?.scheduled_for && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Scheduled: {new Date(enrollmentStep.scheduled_for).toLocaleDateString()}
                  </p>
                )}
                {status === "pending" && (
                  <div className="flex items-center gap-2 mt-3">
                    <Button size="sm" onClick={() => onAction?.("mark_sent", enrollmentStep?.id)}>
                      Mark Sent
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAction?.("skip_step", enrollmentStep?.id)}
                    >
                      <SkipForward className="mr-2 h-4 w-4" />
                      Skip
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
