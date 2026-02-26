"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Calendar,
  CheckCircle2,
  LayoutGrid,
  List,
  Loader2,
  Mail,
  MessageSquare,
  Users,
} from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Card, CardContent } from "@/components/ui/Card"
import { cn } from "@/lib/utils"
import type {
  SequenceEnrollment,
  SequenceEnrollmentStep,
  SequenceStep,
} from "@/lib/types/sequence"

interface SequenceTrackerProps {
  sequenceId: string
}

interface TrackerData {
  steps: SequenceStep[]
  enrollments: SequenceEnrollment[]
  enrollmentSteps: SequenceEnrollmentStep[]
}

const STATUS_COLORS: Record<string, string> = {
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  active: "border-blue-200 bg-blue-50 text-blue-700",
  not_started: "border-slate-200 bg-slate-50 text-slate-600",
  completed: "border-green-200 bg-green-50 text-green-700",
  replied: "border-violet-200 bg-violet-50 text-violet-700",
  bounced: "border-red-200 bg-red-50 text-red-700",
  paused: "border-amber-200 bg-amber-50 text-amber-700",
  unsubscribed: "border-amber-200 bg-amber-50 text-amber-700",
  removed: "border-slate-200 bg-slate-100 text-slate-600",
}

// ── Contact card used in the kanban board ────────────────────────────────────
function ContactCard({
  enrollment,
  enrollmentSteps,
}: {
  enrollment: SequenceEnrollment
  enrollmentSteps: SequenceEnrollmentStep[]
}) {
  const contact = enrollment.contact

  const lastSent = enrollmentSteps
    .filter((s) => s.status === "sent" && s.sent_at)
    .sort(
      (a, b) =>
        new Date(b.sent_at!).getTime() - new Date(a.sent_at!).getTime()
    )[0]

  const nextPending = enrollmentSteps
    .filter((s) => s.status === "pending")
    .sort((a, b) => a.step_order - b.step_order)[0]

  const email = contact?.confirmed_email ?? contact?.inferred_email

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="rounded-lg border bg-card p-3 shadow-sm space-y-2"
    >
      {/* Header: name + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {contact?.full_name ?? "Unknown"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {[contact?.company, contact?.role].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "flex-shrink-0 px-1.5 text-[10px]",
            STATUS_COLORS[enrollment.status] ?? STATUS_COLORS.not_started
          )}
        >
          {enrollment.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Email */}
      {email && (
        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <Mail className="h-3 w-3 flex-shrink-0" />
          {email}
        </p>
      )}

      {/* Indicators row */}
      <div className="flex flex-wrap items-center gap-3">
        {enrollment.status === "replied" && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-violet-600">
            <MessageSquare className="h-3 w-3" />
            Replied
          </span>
        )}
        {lastSent && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            Sent{" "}
            {new Date(lastSent.sent_at!).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
        {nextPending && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(nextPending.scheduled_for).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function SequenceTracker({ sequenceId }: SequenceTrackerProps) {
  const [data, setData] = useState<TrackerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"kanban" | "list">("kanban")

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/sequences/${sequenceId}`)
      if (!res.ok) return
      const payload = await res.json()
      setData({
        steps: (payload.steps ?? []) as SequenceStep[],
        enrollments: (payload.enrollments ?? []) as SequenceEnrollment[],
        enrollmentSteps: (payload.enrollmentSteps ?? []) as SequenceEnrollmentStep[],
      })
    } catch {
      // Keep stale data on transient errors
    } finally {
      setLoading(false)
    }
  }, [sequenceId])

  useEffect(() => {
    void fetchData()
    const interval = setInterval(() => void fetchData(), 30_000)
    return () => clearInterval(interval)
  }, [fetchData])

  // ── Kanban column computation ─────────────────────────────────────────────
  const kanbanColumns = useMemo(() => {
    if (!data) return []
    const { steps, enrollments, enrollmentSteps } = data
    const orderedSteps = [...steps].sort((a, b) => a.order - b.order)

    const getColumnKey = (enrollment: SequenceEnrollment): string => {
      if (
        ["paused", "unsubscribed", "removed", "bounced"].includes(
          enrollment.status
        )
      ) {
        return "paused"
      }
      if (["completed", "replied"].includes(enrollment.status)) {
        return "completed"
      }
      // Place in the column for the next pending step
      const mySteps = enrollmentSteps.filter(
        (s) => s.enrollment_id === enrollment.id
      )
      const nextPending = mySteps
        .filter((s) => s.status === "pending")
        .sort((a, b) => a.step_order - b.step_order)[0]

      if (nextPending) {
        const matched = orderedSteps.find((s) => s.id === nextPending.step_id)
        return matched
          ? `step-${matched.order}`
          : `step-${nextPending.step_order}`
      }
      return "completed"
    }

    const grouped = new Map<string, SequenceEnrollment[]>()
    for (const enrollment of enrollments) {
      const key = getColumnKey(enrollment)
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(enrollment)
    }

    const stepCols = orderedSteps.map((step) => ({
      key: `step-${step.order}`,
      label: `Step ${step.order}`,
      sub:
        step.subject ||
        (step.stepType === "wait"
          ? `Wait ${step.delay_days}d`
          : undefined) ||
        undefined,
      enrollments: grouped.get(`step-${step.order}`) ?? [],
    }))

    return [
      ...stepCols,
      {
        key: "completed",
        label: "Completed",
        sub: undefined,
        enrollments: grouped.get("completed") ?? [],
      },
      {
        key: "paused",
        label: "Paused / Bounced",
        sub: undefined,
        enrollments: grouped.get("paused") ?? [],
      },
    ]
  }, [data])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!data) return null
    const { enrollments } = data
    return {
      total: enrollments.length,
      active: enrollments.filter((e) =>
        ["in_progress", "active", "not_started"].includes(e.status)
      ).length,
      completed: enrollments.filter((e) => e.status === "completed").length,
      replied: enrollments.filter((e) => e.status === "replied").length,
      bounced: enrollments.filter((e) => e.status === "bounced").length,
      paused: enrollments.filter((e) => e.status === "paused").length,
    }
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!data || data.enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Users className="mb-3 h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">
          No contacts enrolled yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Use &ldquo;Enroll Contacts&rdquo; above to add contacts to this
          sequence
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Stats bar + view toggle ──────────────────────────────────── */}
      {stats && (
        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Active", value: stats.active, color: "text-blue-600" },
            {
              label: "Completed",
              value: stats.completed,
              color: "text-green-600",
            },
            {
              label: "Replied",
              value: stats.replied,
              color: "text-violet-600",
            },
            { label: "Bounced", value: stats.bounced, color: "text-red-600" },
            { label: "Paused", value: stats.paused, color: "text-amber-600" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2"
            >
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  stat.color
                )}
              >
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
          ))}

          {/* View toggle */}
          <div className="ml-auto flex items-center gap-1 rounded-lg border bg-card p-1">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                view === "kanban"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                view === "list"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>
        </div>
      )}

      {/* ── Kanban view ──────────────────────────────────────────────── */}
      {view === "kanban" && (
        <div className="grid auto-cols-[220px] grid-flow-col gap-4 overflow-x-auto pb-2">
          {kanbanColumns.map((col) => (
            <div key={col.key} className="min-w-[200px]">
              {/* Column header */}
              <div className="mb-2 flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {col.label}
                  </p>
                  {col.sub && (
                    <p className="max-w-[180px] truncate text-[11px] text-muted-foreground">
                      {col.sub}
                    </p>
                  )}
                </div>
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                  {col.enrollments.length}
                </span>
              </div>

              {/* Cards */}
              <div className="min-h-[100px] space-y-2 rounded-xl border bg-muted/30 p-2">
                <AnimatePresence>
                  {col.enrollments.map((enrollment) => (
                    <ContactCard
                      key={enrollment.id}
                      enrollment={enrollment}
                      enrollmentSteps={data!.enrollmentSteps.filter(
                        (s) => s.enrollment_id === enrollment.id
                      )}
                    />
                  ))}
                </AnimatePresence>
                {col.enrollments.length === 0 && (
                  <p className="py-4 text-center text-[11px] text-muted-foreground">
                    Empty
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── List view ────────────────────────────────────────────────── */}
      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    {["Contact", "Email", "Status", "Next Action", "Enrolled"].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.enrollments.map((enrollment) => {
                    const contact = enrollment.contact
                    const mySteps = data.enrollmentSteps.filter(
                      (s) => s.enrollment_id === enrollment.id
                    )
                    const nextPending = mySteps
                      .filter((s) => s.status === "pending")
                      .sort((a, b) => a.step_order - b.step_order)[0]
                    const email =
                      contact?.confirmed_email ?? contact?.inferred_email

                    const enrolledAt =
                      enrollment.enrolled_at ?? enrollment.created_at

                    return (
                      <tr
                        key={enrollment.id}
                        className="transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <p className="max-w-[180px] truncate font-medium">
                            {contact?.full_name ?? "—"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[contact?.company, contact?.role]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-xs text-muted-foreground">
                          {email ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "px-1.5 text-[10px]",
                              STATUS_COLORS[enrollment.status] ??
                                STATUS_COLORS.not_started
                            )}
                          >
                            {enrollment.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {nextPending
                            ? `Step ${nextPending.step_order} · ${new Date(
                                nextPending.scheduled_for
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {enrolledAt
                            ? new Date(enrolledAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
