"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { SequenceTimeline } from "@/components/SequenceTimeline"
import { computeSequenceStats, getSequenceStatusLabel } from "@/lib/sequence-engine"
import {
  Sequence,
  SequenceEnrollment,
  SequenceEnrollmentStep,
  SequenceEvent,
  SequenceStep,
} from "@/lib/types/sequence"
import { AlertCircle, Pause, Play, Users } from "lucide-react"

interface SequenceDetailResponse {
  sequence: Sequence
  steps: SequenceStep[]
  enrollments: SequenceEnrollment[]
  enrollmentSteps: SequenceEnrollmentStep[]
  events: SequenceEvent[]
}

export default function SequenceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sequenceId = params.id as string

  const [data, setData] = useState<SequenceDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/v1/sequences/${sequenceId}`)
      if (!response.ok) {
        const payload = await response.json()
        throw new Error(payload.error || "Failed to load sequence")
      }
      const payload = (await response.json()) as SequenceDetailResponse
      setData(payload)
      setSelectedEnrollmentId((prev) => prev ?? payload.enrollments[0]?.id ?? null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sequence")
    } finally {
      setLoading(false)
    }
  }, [sequenceId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const stats = useMemo(() => {
    if (!data) return null
    return computeSequenceStats({
      enrollments: data.enrollments,
      events: data.events,
    })
  }, [data])

  const stepPerformance = useMemo(() => {
    if (!data) return []
    const sentByStep = new Map<string, number>()
    const openedByStep = new Map<string, number>()
    const repliedByStep = new Map<string, number>()

    data.events.forEach((event) => {
      if (!event.step_id) return
      if (event.event_type === "sent") {
        sentByStep.set(event.step_id, (sentByStep.get(event.step_id) || 0) + 1)
      }
      if (event.event_type === "opened") {
        openedByStep.set(
          event.step_id,
          (openedByStep.get(event.step_id) || 0) + 1
        )
      }
      if (event.event_type === "replied") {
        repliedByStep.set(
          event.step_id,
          (repliedByStep.get(event.step_id) || 0) + 1
        )
      }
    })

    return data.steps.map((step) => {
      const sent = sentByStep.get(step.id) || 0
      const opened = openedByStep.get(step.id) || 0
      const replied = repliedByStep.get(step.id) || 0
      return {
        id: step.id,
        order: step.order,
        subject: step.subject,
        sent,
        openRate: sent ? Math.round((opened / sent) * 100) : 0,
        replyRate: sent ? Math.round((replied / sent) * 100) : 0,
      }
    })
  }, [data])

  const templatePerformance = useMemo(() => {
    if (!data) return []
    const replyCounts = new Map<string, { replies: number; sent: number }>()

    data.steps.forEach((step) => {
      if (!step.template_id) return
      replyCounts.set(step.template_id, { replies: 0, sent: 0 })
    })

    data.events.forEach((event) => {
      if (!event.step_id) return
      const step = data.steps.find((s) => s.id === event.step_id)
      if (!step?.template_id) return
      const entry = replyCounts.get(step.template_id)
      if (!entry) return
      if (event.event_type === "sent") {
        entry.sent += 1
      }
      if (event.event_type === "replied") {
        entry.replies += 1
      }
    })

    return Array.from(replyCounts.entries())
      .map(([templateId, stats]) => ({
        templateId,
        replyRate: stats.sent ? Math.round((stats.replies / stats.sent) * 100) : 0,
        sent: stats.sent,
      }))
      .sort((a, b) => b.replyRate - a.replyRate)
      .slice(0, 3)
  }, [data])

  const selectedEnrollment = useMemo(
    () => data?.enrollments.find((enrollment) => enrollment.id === selectedEnrollmentId) ?? null,
    [data, selectedEnrollmentId]
  )

  const selectedEnrollmentSteps = useMemo(
    () =>
      data?.enrollmentSteps.filter(
        (step) => step.enrollment_id === selectedEnrollment?.id
      ) ?? [],
    [data, selectedEnrollment]
  )

  const handleSequenceStatus = async (status: "paused" | "active") => {
    try {
      await fetch(`/api/v1/sequences/${sequenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      refresh()
    } catch (err) {
      console.error(err)
    }
  }

  const handleEnrollmentAction = async (action: string, enrollmentStepId?: string) => {
    try {
      await fetch(`/api/v1/sequences/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          enrollmentId: selectedEnrollment?.id,
          enrollmentStepId,
        }),
      })
      refresh()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <p className="text-muted-foreground">Loading sequence...</p>
      </DashboardShell>
    )
  }

  if (error || !data) {
    return (
      <DashboardShell>
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error || "Sequence not found"}
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
          title={data.sequence.name}
          description={data.sequence.description || "Sequence overview"}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/dashboard/sequences/${sequenceId}/enroll`)}
              >
                <Users className="mr-2 h-4 w-4" />
                Enroll Contacts
              </Button>
              {data.sequence.status === "paused" ? (
                <Button onClick={() => handleSequenceStatus("active")}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume
                </Button>
              ) : (
                <Button variant="outline" onClick={() => handleSequenceStatus("paused")}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </Button>
              )}
            </div>
          }
        />

        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Contacts</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{stats.totalContacts}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Emails Sent</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{stats.emailsSent}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Reply Rate</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {stats.emailsSent > 0 ? Math.round((stats.replied / stats.emailsSent) * 100) : 0}%
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Completion</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{stats.completionRate}%</CardContent>
            </Card>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Step Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {stepPerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No step data yet.</p>
              ) : (
                stepPerformance.map((step) => (
                  <div key={step.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">Step {step.order}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{step.subject}</p>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      <p>{step.openRate}% open</p>
                      <p>{step.replyRate}% reply</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best Performing Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {templatePerformance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No template data yet.</p>
              ) : (
                templatePerformance.map((template) => (
                  <div key={template.templateId} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Template {template.templateId.slice(0, 6)}</p>
                      <p className="text-xs text-muted-foreground">{template.sent} sent</p>
                    </div>
                    <Badge variant="outline">{template.replyRate}% reply</Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Enrollments</CardTitle>
            </CardHeader>
            <CardContent>
              {data.enrollments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contacts enrolled yet.</p>
              ) : (
                <div className="space-y-3">
                  {data.enrollments.map((enrollment) => (
                    <button
                      key={enrollment.id}
                      type="button"
                      className={`w-full rounded-lg border p-3 text-left transition ${
                        enrollment.id === selectedEnrollmentId
                          ? "border-primary bg-primary/5"
                          : "hover:border-muted-foreground/40"
                      }`}
                      onClick={() => setSelectedEnrollmentId(enrollment.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">
                            {enrollment.contact?.full_name || "Unknown contact"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Next step:{" "}
                            {enrollment.next_step_at
                              ? new Date(enrollment.next_step_at).toLocaleDateString()
                              : "Not scheduled"}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {getSequenceStatusLabel(enrollment.status)}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedEnrollment ? (
            <SequenceTimeline
              steps={data.steps}
              enrollmentSteps={selectedEnrollmentSteps}
              enrollmentStatus={selectedEnrollment.status}
              onAction={handleEnrollmentAction}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-sm text-muted-foreground text-center">
                Select an enrollment to view the timeline.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}

