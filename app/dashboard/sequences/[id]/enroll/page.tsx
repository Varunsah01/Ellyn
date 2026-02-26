"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Search,
  Shield,
  ShieldCheck,
  Users,
  X,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Textarea } from "@/components/ui/Textarea"
import { Badge } from "@/components/ui/Badge"
import { useContacts, type Contact } from "@/lib/hooks/useContacts"
import type { SequenceStep } from "@/lib/types/sequence"
import { type EnrollmentOverrides, calculateSchedule } from "@/lib/sequence-engine"
import { showToast } from "@/lib/toast"
import { cn } from "@/lib/utils"

type WizardStep = 1 | 2 | 3

interface SequenceDetail {
  id: string
  name: string
  description?: string | null
  steps: SequenceStep[]
}

function ConfidenceBadge({ contact }: { contact: Contact }) {
  const email = contact.confirmed_email || contact.inferred_email
  if (!email) {
    return <span className="text-xs text-muted-foreground">No email</span>
  }
  if (contact.email_verified) {
    return (
      <div className="flex items-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
        <span className="text-xs text-green-600">Verified</span>
      </div>
    )
  }
  const confidence = contact.email_confidence
  if (!confidence) return null
  return (
    <div className="flex items-center gap-1">
      <Shield
        className={cn(
          "h-3.5 w-3.5",
          confidence >= 80 ? "text-amber-500" : "text-slate-400"
        )}
      />
      <span
        className={cn(
          "text-xs",
          confidence >= 80 ? "text-amber-600" : "text-muted-foreground"
        )}
      >
        {confidence}%
      </span>
    </div>
  )
}

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Select Contacts",
  2: "Preview & Customize",
  3: "Confirm & Launch",
}

export default function EnrollContactsPage() {
  const params = useParams()
  const router = useRouter()
  const sequenceId = params.id as string

  const [wizardStep, setWizardStep] = useState<WizardStep>(1)
  const [sequence, setSequence] = useState<SequenceDetail | null>(null)
  const [sequenceLoading, setSequenceLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Contact selection state
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [skipUnverified, setSkipUnverified] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")

  // Customisation state
  const [customNotes, setCustomNotes] = useState<Record<string, string>>({})
  const [overrides] = useState<EnrollmentOverrides>({})
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null)

  // Schedule state
  const [scheduleType, setScheduleType] = useState<"immediate" | "scheduled">("immediate")
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const { contacts, loading: contactsLoading } = useContacts({ limit: 200 })

  // Client-side filter — avoids debounce delay for small contact sets
  const filteredContacts = useMemo(() => {
    let result = contacts
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (c) =>
          c.full_name?.toLowerCase().includes(q) ||
          c.company?.toLowerCase().includes(q) ||
          (c.confirmed_email || c.inferred_email || "").toLowerCase().includes(q)
      )
    }
    if (skipUnverified) {
      result = result.filter(
        (c) =>
          c.email_verified ||
          (c.email_confidence !== undefined && c.email_confidence >= 70)
      )
    }
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter)
    }
    return result
  }, [contacts, search, skipUnverified, statusFilter])

  useEffect(() => {
    const loadSequence = async () => {
      try {
        setSequenceLoading(true)
        const res = await fetch(`/api/v1/sequences/${sequenceId}`)
        if (!res.ok) {
          const d = (await res.json()) as { error?: string }
          throw new Error(d.error ?? "Failed to load sequence")
        }
        const d = await res.json()
        // The detail endpoint returns { sequence, steps, enrollments, … }
        const seq: SequenceDetail = d.sequence
          ? { ...d.sequence, steps: d.steps ?? d.sequence.steps ?? [] }
          : { ...d, steps: d.steps ?? [] }
        setSequence(seq)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sequence")
      } finally {
        setSequenceLoading(false)
      }
    }
    void loadSequence()
  }, [sequenceId])

  const selectedContactList = useMemo(
    () => contacts.filter((c) => selectedContacts.has(c.id)),
    [contacts, selectedContacts]
  )

  const estimatedEndDate = useMemo(() => {
    if (!sequence?.steps.length) return null
    const start =
      scheduleType === "immediate" ? new Date() : new Date(startDate)
    const schedule = calculateSchedule(sequence.steps, start)
    return schedule[schedule.length - 1]?.scheduledFor ?? null
  }, [sequence, startDate, scheduleType])

  const toggleContact = useCallback((id: string) => {
    setSelectedContacts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleSelectAll = () => {
    if (
      selectedContacts.size === filteredContacts.length &&
      filteredContacts.length > 0
    ) {
      setSelectedContacts(new Set())
    } else {
      setSelectedContacts(new Set(filteredContacts.map((c) => c.id)))
    }
  }

  const handleEnroll = async () => {
    if (!sequence || selectedContacts.size === 0) return
    setSaving(true)
    setError(null)
    try {
      const finalStartDate =
        scheduleType === "immediate"
          ? new Date().toISOString().slice(0, 10)
          : startDate
      const res = await fetch(`/api/v1/sequences/${sequenceId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: Array.from(selectedContacts),
          startDate: finalStartDate,
          overrides,
          metadata: { customNotes },
        }),
      })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        throw new Error(d.error ?? "Failed to enroll contacts")
      }
      const count = selectedContacts.size
      showToast.success(
        `${count} contact${count !== 1 ? "s" : ""} enrolled in ${sequence.name}`
      )
      router.push(`/dashboard/sequences/${sequenceId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enroll contacts")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardShell
      breadcrumbs={[
        { label: "Sequences", href: "/dashboard/sequences" },
        {
          label: sequence?.name ?? "Sequence",
          href: `/dashboard/sequences/${sequenceId}`,
        },
        { label: "Enroll Contacts" },
      ]}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* ── Wizard step indicator ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1">
          {([1, 2, 3] as WizardStep[]).map((step, i) => {
            const isActive = wizardStep === step
            const isDone = wizardStep > step
            return (
              <div key={step} className="flex items-center gap-1">
                {i > 0 && (
                  <div
                    className={cn(
                      "h-px w-6 flex-shrink-0",
                      isDone ? "bg-violet-500" : "bg-muted"
                    )}
                  />
                )}
                <button
                  type="button"
                  disabled={step > wizardStep}
                  onClick={() => step < wizardStep && setWizardStep(step)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-violet-100 text-violet-700"
                      : isDone
                        ? "cursor-pointer text-violet-600 hover:bg-violet-50"
                        : "text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      isActive
                        ? "bg-violet-600 text-white"
                        : isDone
                          ? "bg-violet-200 text-violet-700"
                          : "bg-muted-foreground/20 text-muted-foreground"
                    )}
                  >
                    {isDone ? <CheckCircle2 className="h-3 w-3" /> : step}
                  </span>
                  <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
                </button>
              </div>
            )
          })}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ── STEP 1 — Select Contacts ─────────────────────────────── */}
          {wizardStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle>Select Contacts</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose who to enroll in{" "}
                    <span className="font-medium text-foreground">
                      {sequenceLoading ? "…" : (sequence?.name ?? "this sequence")}
                    </span>
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Search + status filter */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[180px] flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by name, company, or email…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">All statuses</option>
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="replied">Replied</option>
                      <option value="no_response">No response</option>
                    </select>
                  </div>

                  {/* Skip unverified toggle */}
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={skipUnverified}
                      onClick={() => setSkipUnverified((p) => !p)}
                      className={cn(
                        "relative h-5 w-9 flex-shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        skipUnverified ? "bg-violet-600" : "bg-input"
                      )}
                    >
                      <span
                        className={cn(
                          "block h-4 w-4 rounded-full bg-white shadow transition-transform",
                          skipUnverified ? "translate-x-[18px]" : "translate-x-0.5"
                        )}
                      />
                    </button>
                    <div>
                      <p className="text-sm font-medium">
                        Skip contacts with unverified emails
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Only show contacts with verified or high-confidence (≥70%) emails
                      </p>
                    </div>
                  </div>

                  {/* Select-all row */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-xs font-medium text-violet-600 hover:text-violet-700"
                    >
                      {selectedContacts.size === filteredContacts.length &&
                      filteredContacts.length > 0
                        ? "Deselect all"
                        : `Select all ${filteredContacts.length}`}
                    </button>
                    <span className="text-xs text-muted-foreground">
                      {selectedContacts.size} selected
                    </span>
                  </div>

                  {/* Contact list */}
                  {contactsLoading ? (
                    <div className="flex items-center justify-center py-14">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredContacts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <Users className="mb-3 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No contacts found</p>
                      {skipUnverified && (
                        <button
                          type="button"
                          onClick={() => setSkipUnverified(false)}
                          className="mt-2 text-xs text-violet-600 hover:underline"
                        >
                          Show contacts with unverified emails
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="-mx-1 max-h-[420px] space-y-1 overflow-y-auto px-1">
                      {filteredContacts.map((contact) => {
                        const isSelected = selectedContacts.has(contact.id)
                        const email =
                          contact.confirmed_email || contact.inferred_email
                        return (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => toggleContact(contact.id)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                              isSelected
                                ? "border-violet-300 bg-violet-50"
                                : "border-transparent hover:border-muted-foreground/20 hover:bg-muted/40"
                            )}
                          >
                            {/* Checkbox */}
                            <span
                              className={cn(
                                "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border-2 transition-colors",
                                isSelected
                                  ? "border-violet-600 bg-violet-600"
                                  : "border-muted-foreground/30"
                              )}
                            >
                              {isSelected && (
                                <svg
                                  className="h-2.5 w-2.5 text-white"
                                  fill="none"
                                  viewBox="0 0 10 10"
                                >
                                  <path
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M1.5 5l2.5 2.5 5-5"
                                  />
                                </svg>
                              )}
                            </span>

                            {/* Contact info */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium">
                                  {contact.full_name}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="flex-shrink-0 px-1.5 text-[10px]"
                                >
                                  {contact.status}
                                </Badge>
                              </div>
                              <p className="truncate text-xs text-muted-foreground">
                                {[contact.company, contact.role]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              {email && (
                                <p className="truncate text-xs text-muted-foreground">
                                  {email}
                                </p>
                              )}
                            </div>

                            {/* Confidence badge */}
                            <div className="flex-shrink-0">
                              <ConfidenceBadge contact={contact} />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button
                  onClick={() => setWizardStep(2)}
                  disabled={selectedContacts.size === 0}
                >
                  Next: Preview
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2 — Preview & Customize ─────────────────────────── */}
          {wizardStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
                {/* Left: selected contacts with custom-note panels */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">
                        Enrolling {selectedContacts.size} contact
                        {selectedContacts.size !== 1 ? "s" : ""}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        into {sequence?.name ?? "sequence"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[480px] divide-y overflow-y-auto">
                      {selectedContactList.map((contact) => {
                        const isExpanded = expandedContactId === contact.id
                        const note = customNotes[contact.id] ?? ""
                        return (
                          <div key={contact.id}>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedContactId(isExpanded ? null : contact.id)
                              }
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">
                                  {contact.full_name}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {[contact.company, contact.role]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </div>
                              <div className="flex flex-shrink-0 items-center gap-2">
                                {note && (
                                  <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700">
                                    Note set
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedContacts((prev) => {
                                      const next = new Set(prev)
                                      next.delete(contact.id)
                                      return next
                                    })
                                  }}
                                  className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden"
                                >
                                  <div className="space-y-2 border-t bg-muted/20 px-4 pb-3 pt-2">
                                    <Label className="text-xs">
                                      Custom note for{" "}
                                      {contact.first_name ?? contact.full_name}
                                    </Label>
                                    <Textarea
                                      placeholder={`Add a personalised note… replaces {{custom_note}} in templates`}
                                      value={note}
                                      onChange={(e) =>
                                        setCustomNotes((prev) => ({
                                          ...prev,
                                          [contact.id]: e.target.value,
                                        }))
                                      }
                                      className="min-h-[80px] text-sm"
                                    />
                                    <p className="text-[11px] text-muted-foreground">
                                      Replaces{" "}
                                      <code className="rounded bg-muted px-1 text-[10px]">
                                        {"{{custom_note}}"}
                                      </code>{" "}
                                      in all email steps for this contact.
                                    </p>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Right: sequence timeline preview + estimated end */}
                <div className="space-y-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Sequence Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {sequenceLoading ? (
                        <p className="text-sm text-muted-foreground">Loading…</p>
                      ) : (
                        <div>
                          {sequence?.steps.map((step, i) => (
                            <div key={step.id} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">
                                  {step.order}
                                </div>
                                {i < (sequence.steps.length - 1) && (
                                  <div className="my-1 w-px flex-1 bg-muted" />
                                )}
                              </div>
                              <div
                                className={cn(
                                  "min-w-0 pb-3 pt-0.5",
                                  i === sequence.steps.length - 1 && "pb-0"
                                )}
                              >
                                <p className="truncate text-sm font-medium leading-tight">
                                  {step.subject ||
                                    (step.stepType === "wait"
                                      ? `Wait ${step.delay_days} day${step.delay_days !== 1 ? "s" : ""}`
                                      : "Untitled step")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {i === 0 ? "Day 1" : `+${step.delay_days} days`}
                                  {step.stepType ? ` · ${step.stepType}` : ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {estimatedEndDate && (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                      <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-medium">Estimated completion</p>
                        <p className="text-xs text-muted-foreground">
                          {estimatedEndDate.toLocaleDateString("en-US", {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setWizardStep(1)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={() => setWizardStep(3)}
                  disabled={selectedContacts.size === 0}
                >
                  Next: Confirm
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3 — Confirm & Launch ─────────────────────────────── */}
          {wizardStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="space-y-4"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Confirm & Launch</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Summary chips */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-muted/40 p-4 text-center">
                      <p className="text-2xl font-bold">{selectedContacts.size}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">contacts</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-4 text-center">
                      <p className="text-2xl font-bold">
                        {sequence?.steps.length ?? 0}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">steps</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-4 text-center">
                      <p className="text-2xl font-bold">
                        {sequence?.steps.reduce(
                          (sum, s) => sum + (s.delay_days ?? 0),
                          0
                        ) ?? 0}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">days total</p>
                    </div>
                  </div>

                  {/* Schedule picker */}
                  <div className="space-y-3">
                    <Label>When should the first email go out?</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setScheduleType("immediate")}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                          scheduleType === "immediate"
                            ? "border-violet-300 bg-violet-50"
                            : "hover:border-muted-foreground/20"
                        )}
                      >
                        <Mail
                          className={cn(
                            "h-5 w-5 flex-shrink-0",
                            scheduleType === "immediate"
                              ? "text-violet-600"
                              : "text-muted-foreground"
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium">Start immediately</p>
                          <p className="text-xs text-muted-foreground">
                            Send first email today
                          </p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setScheduleType("scheduled")}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                          scheduleType === "scheduled"
                            ? "border-violet-300 bg-violet-50"
                            : "hover:border-muted-foreground/20"
                        )}
                      >
                        <Clock
                          className={cn(
                            "h-5 w-5 flex-shrink-0",
                            scheduleType === "scheduled"
                              ? "text-violet-600"
                              : "text-muted-foreground"
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium">Schedule for later</p>
                          <p className="text-xs text-muted-foreground">
                            Pick a start date
                          </p>
                        </div>
                      </button>
                    </div>

                    <AnimatePresence>
                      {scheduleType === "scheduled" && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 pt-1">
                            <Label htmlFor="start-date">Start date</Label>
                            <Input
                              id="start-date"
                              type="date"
                              value={startDate}
                              min={new Date().toISOString().slice(0, 10)}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="max-w-xs"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {estimatedEndDate && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      Sequence completes around{" "}
                      <span className="font-medium">
                        {estimatedEndDate.toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    <span className="font-medium">Note: </span>
                    Contacts already enrolled in this sequence will be skipped
                    automatically.
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between">
                <Button variant="outline" onClick={() => setWizardStep(2)}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={() => void handleEnroll()}
                  disabled={saving || selectedContacts.size === 0}
                  style={{ backgroundColor: "#7C3AED", color: "#fff" }}
                >
                  {saving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Enroll {selectedContacts.size} Contact
                  {selectedContacts.size !== 1 ? "s" : ""}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardShell>
  )
}
