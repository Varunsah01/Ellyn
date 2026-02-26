"use client"

import { useState, useEffect, useCallback } from "react"
import { formatDistanceToNow, parseISO, format } from "date-fns"
import {
  ExternalLink,
  Star,
  Calendar,
  DollarSign,
  Link as LinkIcon,
  Mail,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Textarea } from "@/components/ui/Textarea"
import { cn } from "@/lib/utils"
import { showToast } from "@/lib/toast"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"
import type { ApplicationStage, TrackerContact } from "./types"

interface ApplicationDetailSheetProps {
  contact: TrackerContact | null
  stages: ApplicationStage[]
  open: boolean
  onClose: () => void
  onUpdated: (updated: TrackerContact) => void
}

function StarRating({
  value,
  onChange,
}: {
  value: number | null
  onChange: (v: number) => void
}) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i === value ? 0 : i)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(0)}
          className="focus:outline-none"
        >
          <Star
            className={cn(
              "h-5 w-5 transition-colors",
              i <= (hovered || value || 0)
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-muted-foreground/30"
            )}
          />
        </button>
      ))}
    </div>
  )
}

async function patchContact(
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const res = await supabaseAuthedFetch(`/api/v1/contacts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error("Failed to update contact")
}

async function patchStage(contactId: string, stageId: string | null): Promise<void> {
  const res = await supabaseAuthedFetch(`/api/v1/contacts/${contactId}/stage`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stageId }),
  })
  if (!res.ok) throw new Error("Failed to update stage")
}

export function ApplicationDetailSheet({
  contact,
  stages,
  open,
  onClose,
  onUpdated,
}: ApplicationDetailSheetProps) {
  const [fields, setFields] = useState({
    job_url: "",
    applied_at: "",
    interview_date: "",
    salary_range: "",
    notes: "",
    excitement_level: null as number | null,
  })

  useEffect(() => {
    if (!contact) return
    setFields({
      job_url: contact.job_url ?? "",
      applied_at: contact.applied_at
        ? format(parseISO(contact.applied_at), "yyyy-MM-dd")
        : "",
      interview_date: contact.interview_date
        ? format(parseISO(contact.interview_date), "yyyy-MM-dd")
        : "",
      salary_range: contact.salary_range ?? "",
      notes: contact.notes ?? "",
      excitement_level: contact.excitement_level,
    })
  }, [contact])

  const saveField = useCallback(
    async (key: string, value: unknown) => {
      if (!contact) return
      try {
        const patch: Record<string, unknown> = {
          [key]: value === "" ? null : value,
        }
        await patchContact(contact.id, patch)
        onUpdated({ ...contact, ...patch } as TrackerContact)
      } catch {
        showToast.error("Failed to save")
      }
    },
    [contact, onUpdated]
  )

  const handleStageChange = useCallback(
    async (stageId: string) => {
      if (!contact) return
      try {
        await patchStage(contact.id, stageId)
        onUpdated({ ...contact, stage_id: stageId })
      } catch {
        showToast.error("Failed to move stage")
      }
    },
    [contact, onUpdated]
  )

  const handleExcitementChange = useCallback(
    async (level: number) => {
      if (!contact) return
      const newLevel = level === 0 ? null : level
      setFields((f) => ({ ...f, excitement_level: newLevel }))
      await saveField("excitement_level", newLevel)
    },
    [contact, saveField]
  )

  if (!contact) return null

  const fullName = `${contact.first_name} ${contact.last_name}`.trim()
  const initials = `${contact.first_name[0] ?? ""}${contact.last_name[0] ?? ""}`.toUpperCase()

  const lastContacted = contact.last_contacted_at
    ? formatDistanceToNow(parseISO(contact.last_contacted_at), { addSuffix: true })
    : null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 border-b bg-muted/30">
          <SheetHeader>
            <SheetTitle className="sr-only">Application detail</SheetTitle>
          </SheetHeader>
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 ring-2 ring-border">
              <AvatarImage src={contact.avatar_url ?? undefined} alt={fullName} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-base leading-tight">{fullName}</h2>
              {contact.role && (
                <p className="text-sm text-muted-foreground">{contact.role}</p>
              )}
              {contact.company_name && (
                <p className="text-sm font-medium">{contact.company_name}</p>
              )}
              <div className="flex gap-2 mt-1.5">
                {contact.email && (
                  <a href={`mailto:${contact.email}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <Mail className="h-3 w-3" />
                      Email
                    </Button>
                  </a>
                )}
                {contact.linkedin_url && (
                  <a href={contact.linkedin_url} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                      <ExternalLink className="h-3 w-3" />
                      LinkedIn
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Stage selector */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Pipeline Stage
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((stage) => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => void handleStageChange(stage.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                    contact.stage_id === stage.id
                      ? "text-white border-transparent shadow-sm"
                      : "bg-transparent border-border text-muted-foreground hover:border-primary/40"
                  )}
                  style={
                    contact.stage_id === stage.id
                      ? { backgroundColor: stage.color, borderColor: stage.color }
                      : undefined
                  }
                >
                  {stage.name}
                </button>
              ))}
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Last contacted</p>
              <p className="text-sm font-medium mt-0.5">
                {lastContacted ?? "Never"}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">Added</p>
              <p className="text-sm font-medium mt-0.5">
                {formatDistanceToNow(parseISO(contact.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          {/* Excitement rating */}
          <div>
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Excitement Level
            </Label>
            <StarRating
              value={fields.excitement_level}
              onChange={(v) => void handleExcitementChange(v)}
            />
          </div>

          {/* Job URL */}
          <div className="space-y-1.5">
            <Label htmlFor="job_url" className="flex items-center gap-1.5 text-sm">
              <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
              Job Posting URL
            </Label>
            <div className="flex gap-2">
              <Input
                id="job_url"
                value={fields.job_url}
                onChange={(e) => setFields((f) => ({ ...f, job_url: e.target.value }))}
                onBlur={() => void saveField("job_url", fields.job_url)}
                placeholder="https://..."
                className="text-sm"
              />
              {fields.job_url && (
                <a href={fields.job_url} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="icon" className="h-10 w-10 flex-shrink-0">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              )}
            </div>
          </div>

          {/* Applied & Interview dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="applied_at" className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Applied Date
              </Label>
              <Input
                id="applied_at"
                type="date"
                value={fields.applied_at}
                onChange={(e) => setFields((f) => ({ ...f, applied_at: e.target.value }))}
                onBlur={() =>
                  void saveField(
                    "applied_at",
                    fields.applied_at ? new Date(fields.applied_at).toISOString() : null
                  )
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interview_date" className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                Interview Date
              </Label>
              <Input
                id="interview_date"
                type="date"
                value={fields.interview_date}
                onChange={(e) => setFields((f) => ({ ...f, interview_date: e.target.value }))}
                onBlur={() =>
                  void saveField(
                    "interview_date",
                    fields.interview_date
                      ? new Date(fields.interview_date).toISOString()
                      : null
                  )
                }
                className="text-sm"
              />
            </div>
          </div>

          {/* Salary range */}
          <div className="space-y-1.5">
            <Label htmlFor="salary_range" className="flex items-center gap-1.5 text-sm">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
              Salary Range
            </Label>
            <Input
              id="salary_range"
              value={fields.salary_range}
              onChange={(e) => setFields((f) => ({ ...f, salary_range: e.target.value }))}
              onBlur={() => void saveField("salary_range", fields.salary_range)}
              placeholder="e.g. $80k–$100k"
              className="text-sm"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-sm">Notes</Label>
            <Textarea
              id="notes"
              value={fields.notes}
              onChange={(e) => setFields((f) => ({ ...f, notes: e.target.value }))}
              onBlur={() => void saveField("notes", fields.notes)}
              placeholder="Add notes about this application..."
              className="text-sm min-h-[100px] resize-none"
            />
          </div>

          {/* Email badge if present */}
          {contact.email && (
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Email Address
              </Label>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded">{contact.email}</code>
                {contact.confidence != null && contact.confidence > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50"
                  >
                    {contact.confidence}% confidence
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
