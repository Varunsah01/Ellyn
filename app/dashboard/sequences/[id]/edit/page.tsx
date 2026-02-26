"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Skeleton } from "@/components/ui/Skeleton"
import { showToast } from "@/lib/toast"

interface SequenceMetadata {
  id: string
  name: string
  description?: string | null
  goal?: string | null
  status: "draft" | "active" | "paused" | "completed"
}

function EditSkeleton() {
  return (
    <DashboardShell>
      <div className="mx-auto max-w-xl space-y-6">
        <Skeleton className="h-7 w-48" />
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
    </DashboardShell>
  )
}

export default function EditSequencePage() {
  const params = useParams()
  const router = useRouter()
  const sequenceId = params.id as string

  const [meta, setMeta] = useState<SequenceMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [goal, setGoal] = useState("")
  const [status, setStatus] = useState<SequenceMetadata["status"]>("draft")

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/sequences/${sequenceId}`)
      if (!res.ok) throw new Error("Failed to load")
      const data = (await res.json()) as { sequence: SequenceMetadata }
      const seq = data.sequence
      setMeta(seq)
      setName(seq.name)
      setDescription(seq.description ?? "")
      setGoal(seq.goal ?? "")
      setStatus(seq.status)
    } catch {
      showToast.error("Failed to load sequence")
      router.push(`/dashboard/sequences/${sequenceId}`)
    } finally {
      setLoading(false)
    }
  }, [sequenceId, router])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    if (!name.trim()) {
      showToast.error("Name is required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/v1/sequences/${sequenceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          goal: goal.trim() || null,
          status,
        }),
      })
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(payload?.error ?? "Save failed")
      }
      showToast.success("Sequence updated")
      router.push(`/dashboard/sequences/${sequenceId}`)
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to save"
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <EditSkeleton />

  return (
    <DashboardShell
      breadcrumbs={[
        { label: "Sequences", href: "/dashboard/sequences" },
        { label: meta?.name ?? "Sequence", href: `/dashboard/sequences/${sequenceId}` },
        { label: "Edit" },
      ]}
    >
      <div className="mx-auto max-w-xl">
        {/* Back link */}
        <button
          type="button"
          onClick={() => router.push(`/dashboard/sequences/${sequenceId}`)}
          className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sequence
        </button>

        <h1
          className="mb-6 text-2xl font-semibold text-[#2D2B55]"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          Edit Sequence
        </h1>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="seq-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="seq-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Hiring Manager Outreach"
                maxLength={120}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="seq-desc">Description</Label>
              <textarea
                id="seq-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this sequence for?"
                rows={3}
                maxLength={3000}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            </div>

            {/* Goal */}
            <div className="space-y-1.5">
              <Label htmlFor="seq-goal">Goal</Label>
              <Input
                id="seq-goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Schedule an interview"
                maxLength={500}
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="seq-status">Status</Label>
              <select
                id="seq-status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as SequenceMetadata["status"])
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/sequences/${sequenceId}`)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            disabled={saving || !name.trim()}
            style={{ backgroundColor: "#7C3AED", color: "#fff" }}
            onClick={() => void handleSave()}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </DashboardShell>
  )
}
