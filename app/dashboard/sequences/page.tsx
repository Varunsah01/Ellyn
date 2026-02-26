"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  CalendarCheck,
  FileText,
  GitBranch,
  Info,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { SequenceCard } from "@/components/sequences/SequenceCard"
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
import { usePersona } from "@/context/PersonaContext"
import { getPersonaCopy } from "@/lib/persona-copy"
import type { Sequence } from "@/lib/types/sequence"

// ─── Types ────────────────────────────────────────────────────────────────────

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

function SequenceGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="space-y-1">
                <Skeleton className="h-3 w-10 mx-auto" />
                <Skeleton className="h-6 w-8 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SequencesPage() {
  const router = useRouter()
  const { persona } = usePersona()
  const copy = getPersonaCopy(persona)

  const [sequences, setSequences] = useState<Sequence[]>([])
  const [digest, setDigest] = useState<DigestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Create dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: "", description: "" })
  const [creating, setCreating] = useState(false)

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [seqRes, digestRes] = await Promise.all([
        fetch("/api/v1/sequences"),
        fetch("/api/v1/sequences/execute"),
      ])

      if (!seqRes.ok) {
        const d = (await seqRes.json()) as { error?: string }
        throw new Error(d.error ?? "Failed to load sequences")
      }

      const seqData = (await seqRes.json()) as { sequences?: Sequence[] }
      const digestData = digestRes.ok
        ? ((await digestRes.json()) as { items?: DigestItem[] })
        : { items: [] }

      setSequences(seqData.sequences ?? [])
      setDigest(digestData.items ?? [])
      setError(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load sequences"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const patchSequence = async (
    id: string,
    body: Record<string, unknown>
  ) => {
    const res = await fetch(`/api/v1/sequences/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const d = (await res.json().catch(() => null)) as {
        error?: string
      } | null
      throw new Error(d?.error ?? "Failed to update sequence")
    }
  }

  const handlePause = async (id: string) => {
    try {
      await patchSequence(id, { status: "paused" })
      showToast.success("Sequence paused")
      void fetchData()
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to pause"
      )
    }
  }

  const handleResume = async (id: string) => {
    try {
      await patchSequence(id, { status: "active" })
      showToast.success("Sequence resumed")
      void fetchData()
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to resume"
      )
    }
  }

  const handleDuplicate = async (id: string) => {
    const seq = sequences.find((s) => s.id === id)
    if (!seq) return
    try {
      const res = await fetch("/api/v1/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${seq.name} (Copy)`,
          description: seq.description,
          goal: seq.goal,
          steps: seq.steps.map(({ subject, body, delay_days, order }) => ({
            subject,
            body,
            delay_days,
            order,
          })),
        }),
      })
      if (!res.ok) throw new Error("Duplicate failed")
      showToast.success("Sequence duplicated")
      void fetchData()
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to duplicate"
      )
    }
  }

  const handleDelete = async (id: string) => {
    const seq = sequences.find((s) => s.id === id)
    if (!seq) return
    if (!window.confirm(`Delete "${seq.name}"?`)) return
    try {
      const res = await fetch(`/api/v1/sequences/${id}`, {
        method: "DELETE",
      })
      if (!res.ok && res.status !== 404) throw new Error("Delete failed")
      showToast.success("Sequence deleted")
      void fetchData()
    } catch {
      showToast.error("Failed to delete sequence")
    }
  }

  const handleMarkSent = (enrollmentStepId: string) => {
    void fetch("/api/v1/sequences/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_sent", enrollmentStepId }),
    }).then(() => void fetchData())
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
        const d = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(d.error ?? `HTTP ${res.status}`)
      }
      const d = (await res.json()) as { sequence: { id: string } }
      showToast.success("Sequence created")
      closeDialog()
      router.push(`/dashboard/sequences/${d.sequence.id}`)
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Failed to create sequence"
      )
    } finally {
      setCreating(false)
    }
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const filteredSequences = searchQuery.trim()
    ? sequences.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.description ?? "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
      )
    : sequences

  const activeCount = sequences.filter((s) => s.status === "active").length

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardShell breadcrumbs={[{ label: copy.sequences }]}>
      <PageHeader
        title={copy.sequences}
        description="Automate follow-ups and track performance across contacts"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchData()}
              disabled={loading}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", loading && "animate-spin")}
              />
              Refresh
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Sequence
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button
            type="button"
            onClick={() => void fetchData()}
            className="ml-auto underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* How-it-works banner */}
      <Card className="mb-6 border-blue-200/80 bg-blue-50/40">
        <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
            <div>
              <p className="text-sm font-medium text-slate-900">
                How sequences work
              </p>
              <p className="text-sm text-slate-600">
                Create a sequence, enroll contacts, then use today&apos;s
                digest to send and mark steps complete.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/templates">
                <FileText className="mr-2 h-4 w-4" />
                Templates
              </Link>
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Sequence
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* ── Sequences grid ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search sequences…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
            {activeCount > 0 && (
              <Badge
                variant="outline"
                className="shrink-0 border-green-200 bg-green-50 text-green-700"
              >
                {activeCount} active
              </Badge>
            )}
          </div>

          {loading ? (
            <SequenceGridSkeleton />
          ) : filteredSequences.length === 0 ? (
            <div className="rounded-xl border border-dashed p-12 text-center">
              <GitBranch className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">
                {searchQuery
                  ? "No sequences match your search"
                  : "No sequences yet"}
              </p>
              {!searchQuery && (
                <>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create your first sequence to automate follow-ups
                  </p>
                  <Button
                    className="mt-4"
                    size="sm"
                    onClick={() => setDialogOpen(true)}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    New Sequence
                  </Button>
                </>
              )}
            </div>
          ) : (
            <motion.div
              className="grid gap-4 md:grid-cols-2"
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: { transition: { staggerChildren: 0.06 } },
              }}
            >
              <AnimatePresence>
                {filteredSequences.map((seq) => (
                  <motion.div
                    key={seq.id}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      visible: { opacity: 1, y: 0 },
                    }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SequenceCard
                      sequence={seq}
                      onPause={handlePause}
                      onResume={handleResume}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* ── Today's emails ──────────────────────────────────────────────── */}
        <Card className="h-fit">
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
              <div className="rounded-lg border border-dashed p-5">
                <p className="text-sm font-medium text-slate-900">
                  No emails scheduled for today
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enroll contacts in a sequence to populate this daily send
                  list.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {digest.map((item) => (
                  <div
                    key={item.enrollmentStepId}
                    className="rounded-lg border p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">
                          {item.contactName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.contactEmail}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.sequenceName}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(item.scheduledFor).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-medium">
                      {item.subject}
                    </p>
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
                          Outlook
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          handleMarkSent(item.enrollmentStepId)
                        }
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
            <DialogTitle>New Sequence</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => void handleCreate(e)}
            className="space-y-4"
          >
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
                  setCreateForm({
                    ...createForm,
                    description: e.target.value,
                  })
                }
                placeholder="What is this sequence for?"
                className="min-h-[80px] resize-none text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              A placeholder first step is created. Edit steps on the sequence
              detail page.
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
