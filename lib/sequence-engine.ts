import { addDays } from "date-fns"
import type {
  SequenceStep,
  SequenceStats,
  SequenceEnrollment,
  SequenceEnrollmentStep,
  SequenceEvent,
} from "@/lib/types/sequence"

export type StepSchedule = {
  stepId: string
  stepOrder: number
  scheduledFor: Date
}

export type EnrollmentOverrides = Record<
  string,
  Record<string, { subject?: string; body?: string }>
>

export const sortSteps = (steps: SequenceStep[]) =>
  [...steps].sort((a, b) => a.order - b.order)

export const calculateSchedule = (
  steps: SequenceStep[],
  startDate: Date
): StepSchedule[] => {
  const ordered = sortSteps(steps)
  let offsetDays = 0
  return ordered.map((step) => {
    if (step.order > 1) {
      offsetDays += step.delay_days
    }
    return {
      stepId: step.id,
      stepOrder: step.order,
      scheduledFor: addDays(startDate, offsetDays),
    }
  })
}

export const buildEnrollmentSteps = ({
  steps,
  startDate,
  overrides,
  contactId,
}: {
  steps: SequenceStep[]
  startDate: Date
  overrides?: EnrollmentOverrides
  contactId: string
}): Omit<SequenceEnrollmentStep, "id" | "enrollment_id">[] => {
  const schedule = calculateSchedule(steps, startDate)
  const overrideForContact = overrides?.[contactId] ?? {}

  return schedule.map((entry) => {
    const override = overrideForContact[entry.stepId] ?? {}
    return {
      step_id: entry.stepId,
      step_order: entry.stepOrder,
      scheduled_for: entry.scheduledFor.toISOString(),
      status: "pending",
      subject_override: override.subject ?? null,
      body_override: override.body ?? null,
      sent_at: null,
    }
  })
}

export const getNextStepDate = (steps: SequenceEnrollmentStep[]) => {
  const pending = steps
    .filter((step) => step.status === "pending")
    .sort(
      (a, b) =>
        new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()
    )
  return pending[0]?.scheduled_for ?? null
}

export const buildMailtoLink = ({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}) => {
  const params = new URLSearchParams({
    subject,
    body,
  })
  return `mailto:${encodeURIComponent(to)}?${params.toString()}`
}

export const buildGmailLink = ({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}) => {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}

export const buildOutlookLink = ({
  to,
  subject,
  body,
}: {
  to: string
  subject: string
  body: string
}) => {
  const params = new URLSearchParams({
    to,
    subject,
    body,
  })
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString()}`
}

export const computeSequenceStats = ({
  enrollments,
  events,
}: {
  enrollments: SequenceEnrollment[]
  events: SequenceEvent[]
}): SequenceStats => {
  const totalContacts = enrollments.length
  const emailsSent = events.filter((event) => event.event_type === "sent").length
  const opened = events.filter((event) => event.event_type === "opened").length
  const replied = events.filter((event) => event.event_type === "replied").length
  const bounced = events.filter((event) => event.event_type === "bounced").length
  const inProgress = enrollments.filter((e) =>
    ["not_started", "in_progress"].includes(e.status)
  ).length
  const completed = enrollments.filter((e) => e.status === "completed").length
  const completionRate =
    totalContacts > 0 ? Math.round((completed / totalContacts) * 100) : 0

  return {
    totalContacts,
    emailsSent,
    opened,
    replied,
    bounced,
    unsubscribed: 0,
    inProgress,
    completionRate,
  }
}

export const getSequenceStatusLabel = (status: string) => {
  switch (status) {
    case "not_started":
      return "Not started"
    case "in_progress":
      return "In progress"
    case "completed":
      return "Completed"
    case "replied":
      return "Replied"
    case "bounced":
      return "Bounced"
    case "paused":
      return "Paused"
    default:
      return status
  }
}
