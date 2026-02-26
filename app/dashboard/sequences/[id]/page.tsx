"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  ChevronRight,
  GitBranch,
  Pause,
  Pencil,
  Play,
  Trash2,
  Users,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Skeleton } from "@/components/ui/Skeleton"
import { SequenceTimeline } from "@/components/SequenceTimeline"
import { EnrollContactsModal } from "@/components/sequences/EnrollContactsModal"
import { showToast } from "@/lib/toast"
import { computeSequenceStats, getSequenceStatusLabel } from "@/lib/sequence-engine"
import { cn } from "@/lib/utils"
import type {
  Sequence,
  SequenceEnrollment,
  SequenceEnrollmentStep,
  SequenceEvent,
  SequenceStep,
} from "@/lib/types/sequence"

interface SequenceDetailResponse {
  sequence: Sequence
  steps: SequenceStep[]
  enrollments: SequenceEnrollment[]
  enrollmentSteps: SequenceEnrollmentStep[]
  events: SequenceEvent[]
}

const ENROLLMENT_STATUS_BADGE: Record<string, string> = {
  in_progress: "border-blue-200 bg-blue-50 text-blue-700",
  completed: "border-green-200 bg-green-50 text-green-700",
  replied: "border-violet-200 bg-violet-50 text-violet-700",
  bounced: "border-red-200 bg-red-50 text-red-700",
  paused: "border-amber-200 bg-amber-50 text-amber-700",
  not_started: "border-slate-200 bg-slate-50 text-slate-600",
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: number | string
  sub?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function DetailSkeleton() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    </DashboardShell>
  )
}

export default function SequenceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sequenceId = params.id as string

  const [data, setData] = useState<SequenceDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [togglingStatus, setTogglingStatus] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/sequences/${sequenceId}`)
      if (!res.ok) {
        const payload = await res.json()
        throw new Error((payload as { error?: string }).error ?? "Failed to load sequence")
      }
      const payload = (await res.json()) as SequenceDetailResponse
      setData(payload)
      setSelectedEnrollmentId((prev) => {
        // Keep selection if still valid
        if (prev && payload.enrollments.some((e) => e.id === prev)) return prev
        return payload.enrollments[0]?.id ?? null
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sequence")
    } finally {
      setLoading(false)
    }
  }, [sequenceId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const stats = useMemo(() => {
    if (!data) return null
    return computeSequenceStats({
      enrollments: data.enrollments,
      events: data.events,
    })
  }, [data])

  const enrollmentCounts = useMemo(() => {
    if (!data) return { total: 0, completed: 0, inProgress: 0, replied: 0 }
    return {
      total: data.enrollments.length,
      completed: data.enrollments.filter((e) => e.status === "completed").length,
      inProgress: data.enrollments.filter((e) => e.status === "in_progress").length,
      replied: data.enrollments.filter((e) => e.status === "replied").length,
    }
  }, [data])

  const selectedEnrollment = useMemo(
    () => data?.enrollments.find((e) => e.id === selectedEnrollmentId) ?? null,
    [data, selectedEnrollmentId]
  )

  const selectedEnrollmentSteps = useMemo(
    () =>
      data?.enrollmentSteps.filter((s) => s.enrollment_id === selectedEnrollmentId) ?? [],
    [data, selectedEnrollmentId]
  )

  const stepPerformance = useMemo(() => {
    if (!data) return []
    const sentByStep = new Map<string, number>()
    const repliedByStep = new Map<string, number>()
    data.events.forEach((event) => {
      if (!event.step_id) return
      if (event.event_type === "sent")
        sentByStep.set(event.step_id, (sentByStep.get(event.step_id) ?? 0) + 1)
      if (event.event_type === "replied")
        repliedByStep.set(event.step_id, (repliedByStep.get(event.step_id) ?? 0) + 1)
    })
    return data.steps.map((step) => {
      const sent = sentByStep.get(step.id) ?? 0
      const replied = repliedByStep.get(step.id) ?? 0
      return {
        id: step.id,
        order: step.order,
        subject: step.subject,
        sent,
        replyRate: sent ? Math.round((replied / sent) * 100) : 0,
      }
    })
  }, [data])

  const handleToggleStatus = async () => {
    if (!data) return
    const newStatus =
      data.sequence.status === "paused" ? "active" : "paused"
    setTogglingStatus(true)
    try {
      const res = await fetch(`/api/v1/sequences/${sequenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update")
      await refresh()
      showToast.success(newStatus === "paused" ? "Sequence paused" : "Sequence resumed")
    } catch {
      showToast.error("Failed to update sequence")
    } finally {
      setTogglingStatus(false)
    }
  }

  const handleEnrollmentAction = async (action: string, enrollmentStepId?: string) => {
    try {
      const res = await fetch(`/api/v1/sequences/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          enrollmentId: selectedEnrollment?.id,
          enrollmentStepId,
        }),
      })
      if (!res.ok) throw new Error("Action failed")
      await refresh()
    } catch {
      showToast.error("Action failed")
    }
  }

  const handleRemoveEnrollment = async (enrollmentId: string) => {
    if (!window.confirm("Remove this contact from the sequence?")) return
    setRemovingId(enrollmentId)
    try {
      const res = await fetch(`/api/v1/sequences/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_enrollment", enrollmentId }),
      })
      if (!res.ok) throw new Error("Remove failed")
      showToast.success("Contact removed from sequence")
      // If we removed the selected one, clear it
      if (selectedEnrollmentId === enrollmentId) setSelectedEnrollmentId(null)
      await refresh()
    } catch {
      showToast.error("Failed to remove contact")
    } finally {
      setRemovingId(null)
    }
  }

  if (loading) return <DetailSkeleton />

  if (error || !data) {
    return (
      <DashboardShell
        breadcrumbs={[{ label: "Sequences", href: "/dashboard/sequences" }]}
      >
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error ?? "Sequence not found"}
        </div>
      </DashboardShell>
    )
  }

  const seq = data.sequence
  const isPaused = seq.status === "paused"

  return (
    <DashboardShell
      breadcrumbs={[
        { label: "Sequences", href: "/dashboard/sequences" },
        { label: seq.name },
      ]}
    >
      <div className="space-y-6">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1
                className="truncate text-2xl font-semibold text-[#2D2B55]"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                {seq.name}
              </h1>
              <Badge
                variant="outline"
                className={cn(
                  "flex-shrink-0 text-[11px]",
                  seq.status === "active"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : seq.status === "paused"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-slate-50 text-slate-600"
                )}
              >
                {seq.status}
              </Badge>
            </div>
            {seq.description && (
              <p className="mt-1 text-sm text-muted-foreground">{seq.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <EnrollContactsModal
              sequenceId={sequenceId}
              trigger={
                <Button variant="outline" size="sm">
                  <Users className="mr-1.5 h-4 w-4" />
                  Enroll Contacts
                </Button>
              }
              onSuccess={() => void refresh()}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/dashboard/sequences/${sequenceId}/edit`)}
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
            <Button
              size="sm"
              variant={isPaused ? "default" : "outline"}
              style={isPaused ? { backgroundColor: "#7C3AED", color: "#fff" } : undefined}
              disabled={togglingStatus}
              onClick={() => void handleToggleStatus()}
            >
              {isPaused ? (
                <>
                  <Play className="mr-1.5 h-4 w-4" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="mr-1.5 h-4 w-4" />
                  Pause
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── Stats row ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total Enrolled" value={enrollmentCounts.total} />
          <StatCard
            label="In Progress"
            value={enrollmentCounts.inProgress}
            sub={
              enrollmentCounts.total > 0
                ? `${Math.round((enrollmentCounts.inProgress / enrollmentCounts.total) * 100)}%`
                : undefined
            }
          />
          <StatCard label="Completed" value={enrollmentCounts.completed} />
          <StatCard
            label="Replied"
            value={enrollmentCounts.replied}
            sub={
              stats && stats.emailsSent > 0
                ? `${Math.round((stats.replied / stats.emailsSent) * 100)}% reply rate`
                : undefined
            }
          />
        </div>

        {/* ── Enrollments table + Timeline ───────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* Enrollments table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Enrollments</CardTitle>
                {enrollmentCounts.total > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {enrollmentCounts.total} contact
                    {enrollmentCounts.total !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {data.enrollments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <GitBranch className="mb-3 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No contacts enrolled yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click &ldquo;Enroll Contacts&rdquo; to get started
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  <AnimatePresence initial={false}>
                    {data.enrollments.map((enrollment) => {
                      const contact = enrollment.contact
                      const isSelected = enrollment.id === selectedEnrollmentId
                      const isRemoving = removingId === enrollment.id

                      // Find the current pending step number
                      const enrollSteps = data.enrollmentSteps.filter(
                        (s) => s.enrollment_id === enrollment.id
                      )
                      const nextPendingStep = enrollSteps
                        .filter((s) => s.status === "pending")
                        .sort((a, b) => a.step_order - b.step_order)[0]

                      return (
                        <motion.div
                          key={enrollment.id}
                          layout
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className={cn(
                            "group flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors",
                            isSelected
                              ? "bg-violet-50"
                              : "hover:bg-muted/40"
                          )}
                          onClick={() => setSelectedEnrollmentId(enrollment.id)}
                        >
                          {/* Selection indicator */}
                          <div
                            className={cn(
                              "h-4 w-0.5 flex-shrink-0 rounded-full transition-colors",
                              isSelected ? "bg-violet-500" : "bg-transparent"
                            )}
                          />

                          {/* Contact info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium">
                                {contact?.full_name ?? "Unknown contact"}
                              </span>
                              {isSelected && (
                                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-violet-400" />
                              )}
                            </div>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {contact?.company
                                ? `${contact.company}${contact.role ? ` · ${contact.role}` : ""}`
                                : (contact?.role ?? "")}
                            </p>
                          </div>

                          {/* Step */}
                          <div className="hidden flex-shrink-0 text-center sm:block">
                            <p className="text-xs font-medium text-foreground">
                              {nextPendingStep
                                ? `Step ${nextPendingStep.step_order}`
                                : "—"}
                            </p>
                            {nextPendingStep?.scheduled_for && (
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(
                                  nextPendingStep.scheduled_for
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </p>
                            )}
                          </div>

                          {/* Status badge */}
                          <Badge
                            variant="outline"
                            className={cn(
                              "flex-shrink-0 px-1.5 text-[10px]",
                              ENROLLMENT_STATUS_BADGE[enrollment.status] ??
                                ENROLLMENT_STATUS_BADGE.not_started
                            )}
                          >
                            {getSequenceStatusLabel(enrollment.status)}
                          </Badge>

                          {/* Remove */}
                          <button
                            type="button"
                            title="Remove from sequence"
                            disabled={isRemoving}
                            className="flex-shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleRemoveEnrollment(enrollment.id)
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline */}
          {selectedEnrollment ? (
            <SequenceTimeline
              steps={data.steps}
              enrollmentSteps={selectedEnrollmentSteps}
              enrollmentStatus={selectedEnrollment.status}
              onAction={handleEnrollmentAction}
            />
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                Select an enrollment to view its timeline
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Step performance ──────────────────────────────────────── */}
        {stepPerformance.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Step Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {stepPerformance.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Step {step.order}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {step.subject}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right text-xs text-muted-foreground">
                      <p>{step.sent} sent</p>
                      <p>{step.replyRate}% reply</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardShell>
  )
}
