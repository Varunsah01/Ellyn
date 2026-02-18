"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle,
  CalendarCheck,
  FileText,
  Info,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Skeleton } from "@/components/ui/Skeleton"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { buildGmailLink, buildOutlookLink } from "@/lib/sequence-engine"
import { showToast } from "@/lib/toast"
import { cn } from "@/lib/utils"
import type { Sequence } from "@/lib/types/sequence"

// ─── Types ───────────────────────────────────────────────────────────────────

interface DigestItem {
  enrollmentStepId: string
  sequenceId: string
  sequenceName: string
  contactName: string
  contactEmail: string
  subject: string
  body: string
  scheduledFor: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border-slate-200",
  active: "bg-green-50 text-green-700 border-green-200",
  paused: "bg-yellow-50 text-yellow-700 border-yellow-200",
  completed: "bg-blue-50 text-blue-700 border-blue-200",
}

// A minimal placeholder step so the API's `min(1)` constraint is satisfied.
// Users are prompted to edit steps on the detail page after creation.
const PLACEHOLDER_STEP = {
  subject: "(Step 1 — edit me)",
  body: "Hi,\n\nAdd your message here.\n\nBest,",
  order: 1,
  delay_days: 0,
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function DigestSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-lg border p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SequencesListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24 ml-auto" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SequencesPage() {
  const router = useRouter()

  const [sequences, setSequences] = useState<Sequence[]>([])
  const [digest, setDigest] = useState<DigestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: "", description: "" })
  const [creating, setCreating] = useState(false)

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [sequencesRes, digestRes] = await Promise.all([
        fetch("/api/v1/sequences"),
        fetch("/api/v1/sequences/execute"),
      ])

      if (!sequencesRes.ok) {
        const data = (await sequencesRes.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to load sequences")
      }

      const sequencesData = (await sequencesRes.json()) as { sequences?: Sequence[] }
      const digestData = digestRes.ok
        ? ((await digestRes.json()) as { items?: DigestItem[] })
        : { items: [] }

      setSequences(sequencesData.sequences ?? [])
      setDigest(digestData.items ?? [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sequences")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleMarkSent = (enrollmentStepId: string) => {
    void fetch("/api/v1/sequences/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_sent", enrollmentStepId }),
    }).then(() => fetchData())
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setCreateForm({ name: "", description: "" })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createForm.name.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/v1/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name.trim(),
          description: createForm.description.trim() || undefined,
          steps: [PLACEHOLDER_STEP],
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as { sequence: { id: string } }
      showToast.success("Sequence created")
      closeDialog()
      router.push(`/dashboard/sequences/${data.sequence.id}`)
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Failed to create sequence")
    } finally {
      setCreating(false)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardShell breadcrumbs={[{ label: "Sequences" }]}>
      <PageHeader
        title="Sequences"
        description="Automate follow-ups and track performance"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchData()}
              disabled={loading}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Sequence
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* How-it-works banner */}
      <Card className="mb-6 border-blue-200/80 bg-blue-50/40">
        <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <div>
              <p className="text-sm font-medium text-slate-900">How sequences work</p>
              <p className="text-sm text-slate-600">
                Create a sequence, enroll contacts, then use today's digest to send
                and mark steps complete.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/templates">
                <FileText className="mr-2 h-4 w-4" />
                Open Templates
              </Link>
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Sequence
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* ── Today's emails ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Today&apos;s emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <DigestSkeleton />
            ) : digest.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium text-slate-900">
                  No emails scheduled for today
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enroll contacts in a sequence to populate this daily send list.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {digest.map((item) => (
                  <div key={item.enrollmentStepId} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{item.contactName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.contactEmail}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.sequenceName}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(item.scheduledFor).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium">{item.subject}</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-[11px]">
                        Ready to send
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={buildGmailLink({
                            to: item.contactEmail,
                            subject: item.subject,
                            body: item.body,
                          })}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Gmail
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={buildOutlookLink({
                            to: item.contactEmail,
                            subject: item.subject,
                            body: item.body,
                          })}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Outlook
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleMarkSent(item.enrollmentStepId)}
                      >
                        Mark Sent
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Sequences list ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base">Your Sequences</CardTitle>
            {!loading && sequences.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {sequences.length} total
              </span>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <SequencesListSkeleton />
            ) : sequences.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Mail className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">No sequences yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create your first sequence to start automating follow-ups.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={() => setDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Sequence
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {sequences.map((seq) => (
                  <button
                    key={seq.id}
                    type="button"
                    onClick={() => router.push(`/dashboard/sequences/${seq.id}`)}
                    className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50 hover:border-muted-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {/* Name + status */}
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate text-sm font-medium">
                        {seq.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 text-[11px] font-medium capitalize",
                          STATUS_PILL[seq.status] ?? STATUS_PILL.draft
                        )}
                      >
                        {seq.status}
                      </Badge>
                    </div>

                    {/* Description */}
                    {seq.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {seq.description}
                      </p>
                    )}

                    {/* Meta row: steps · contacts · date */}
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {seq.steps.length} step
                        {seq.steps.length !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {seq.stats.totalContacts} enrolled
                      </span>
                      <span className="ml-auto">
                        {new Date(seq.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Create Sequence Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog()
          else setDialogOpen(true)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sequence</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="seq-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="seq-name"
                required
                autoFocus
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="e.g. Product Demo Outreach"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="seq-desc" className="text-sm font-medium">
                Description
              </label>
              <Textarea
                id="seq-desc"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
                placeholder="What is this sequence for?"
                className="min-h-[80px] resize-none text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A placeholder first step will be created. You can edit steps on
              the sequence detail page.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || !createForm.name.trim()}
              >
                {creating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create Sequence"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
