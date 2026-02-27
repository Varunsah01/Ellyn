"use client"

import { useMemo, useRef, useState } from "react"
import { ChevronDown, Loader2, Plus } from "lucide-react"

import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { Textarea } from "@/components/ui/Textarea"
import { withCsrfHeaders } from "@/lib/csrf"
import { createClient } from "@/lib/supabase/client"
import { extractVariables, PREDEFINED_VARIABLE_LIST } from "@/lib/template-variables"
import { showToast } from "@/lib/toast"

type EditorCategory =
  | "job_search"
  | "sales_outreach"
  | "follow_up"
  | "networking"
  | "custom"

type EditorTone = "professional" | "friendly" | "casual" | "formal"

type ApiCategory = "job_seeker" | "smb_sales" | "general"

const CATEGORY_OPTIONS: Array<{ value: EditorCategory; label: string }> = [
  { value: "job_search", label: "Job Search" },
  { value: "sales_outreach", label: "Sales Outreach" },
  { value: "follow_up", label: "Follow-Up" },
  { value: "networking", label: "Networking" },
  { value: "custom", label: "Custom" },
]

const TONE_OPTIONS: Array<{ value: EditorTone; label: string }> = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "casual", label: "Casual" },
  { value: "formal", label: "Formal" },
]

const BASE_VARIABLE_SUGGESTIONS = [
  "first_name",
  "last_name",
  "company",
  "role",
  "your_name",
  "sender_name",
  "your_company",
  "pain_point",
  "benefit",
  "department",
  "target_field",
]

const CATEGORY_TO_API_CATEGORY: Record<EditorCategory, ApiCategory> = {
  job_search: "job_seeker",
  networking: "job_seeker",
  sales_outreach: "smb_sales",
  follow_up: "general",
  custom: "general",
}

export interface Props {
  initialName?: string
  initialSubject?: string
  initialBody?: string
  initialCategory?: string
  initialTone?: string
  initialVariables?: string[]
  onSaved: (templateId: string) => void
  onCancel: () => void
}

type PreviewSegment =
  | { type: "text"; value: string }
  | { type: "variable"; value: string }

function normalizeCategory(value?: string): EditorCategory {
  if (
    value === "job_search" ||
    value === "sales_outreach" ||
    value === "follow_up" ||
    value === "networking" ||
    value === "custom"
  ) {
    return value
  }

  if (value === "job_seeker") return "job_search"
  if (value === "smb_sales") return "sales_outreach"
  if (value === "general") return "custom"

  return "custom"
}

function normalizeTone(value?: string): EditorTone {
  if (
    value === "professional" ||
    value === "friendly" ||
    value === "casual" ||
    value === "formal"
  ) {
    return value
  }
  return "professional"
}

function tokenizeTemplate(value: string): PreviewSegment[] {
  const result: PreviewSegment[] = []
  const regex = /\{\{([^}]+)\}\}/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(value)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: "text", value: value.slice(lastIndex, match.index) })
    }

    const name = match[1]?.trim()
    if (name) {
      result.push({ type: "variable", value: `{{${name}}}` })
    } else {
      result.push({ type: "text", value: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < value.length) {
    result.push({ type: "text", value: value.slice(lastIndex) })
  }

  return result
}

function renderPreviewSegments(segments: PreviewSegment[]) {
  return segments.map((segment, index) => {
    if (segment.type === "variable") {
      return (
        <span
          key={`${segment.value}-${index}`}
          className="inline-flex items-center rounded bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 mx-0.5 text-[11px] font-medium"
        >
          {segment.value}
        </span>
      )
    }
    return <span key={`text-${index}`}>{segment.value}</span>
  })
}

export function EmailTemplateEditor({
  initialName,
  initialSubject,
  initialBody,
  initialCategory,
  initialTone,
  initialVariables,
  onSaved,
  onCancel,
}: Props) {
  const [name, setName] = useState(initialName ?? "")
  const [subject, setSubject] = useState(initialSubject ?? "")
  const [body, setBody] = useState(initialBody ?? "")
  const [category, setCategory] = useState<EditorCategory>(
    normalizeCategory(initialCategory)
  )
  const [tone, setTone] = useState<EditorTone>(normalizeTone(initialTone))
  const [saving, setSaving] = useState(false)
  const [subjectVariablesOpen, setSubjectVariablesOpen] = useState(false)
  const [bodyVariablesOpen, setBodyVariablesOpen] = useState(false)

  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const detectedVariables = useMemo(
    () => extractVariables(`${subject} ${body}`),
    [subject, body]
  )

  const availableVariables = useMemo(() => {
    const fromProps = (initialVariables ?? []).map((value) => value.trim())
    const fromLibrary = PREDEFINED_VARIABLE_LIST.map((item) => item.name)

    return Array.from(
      new Set(
        [...BASE_VARIABLE_SUGGESTIONS, ...fromLibrary, ...fromProps, ...detectedVariables].filter(
          Boolean
        )
      )
    )
  }, [detectedVariables, initialVariables])

  const subjectPreview = useMemo(() => tokenizeTemplate(subject), [subject])
  const bodyPreview = useMemo(() => tokenizeTemplate(body), [body])

  const canSave =
    name.trim().length > 0 &&
    subject.trim().length > 0 &&
    body.trim().length > 0 &&
    !saving

  const insertVariable = (target: "subject" | "body", variableName: string) => {
    const token = `{{${variableName}}}`

    if (target === "subject") {
      const input = subjectRef.current
      if (!input) {
        setSubject((prev) => `${prev}${token}`)
        return
      }

      const start = input.selectionStart ?? subject.length
      const end = input.selectionEnd ?? subject.length
      const next = subject.slice(0, start) + token + subject.slice(end)
      setSubject(next)

      requestAnimationFrame(() => {
        input.focus()
        const nextPosition = start + token.length
        input.setSelectionRange(nextPosition, nextPosition)
      })
      return
    }

    const textarea = bodyRef.current
    if (!textarea) {
      setBody((prev) => `${prev}${token}`)
      return
    }

    const start = textarea.selectionStart ?? body.length
    const end = textarea.selectionEnd ?? body.length
    const next = body.slice(0, start) + token + body.slice(end)
    setBody(next)

    requestAnimationFrame(() => {
      textarea.focus()
      const nextPosition = start + token.length
      textarea.setSelectionRange(nextPosition, nextPosition)
    })
  }

  const saveTemplate = async () => {
    if (!name.trim()) {
      showToast.error("Template name is required")
      return
    }
    if (!subject.trim()) {
      showToast.error("Subject is required")
      return
    }
    if (!body.trim()) {
      showToast.error("Body is required")
      return
    }

    setSaving(true)

    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const headers = new Headers({
        "Content-Type": "application/json",
      })

      if (session?.access_token) {
        headers.set("Authorization", `Bearer ${session.access_token}`)
      }

      const payload = {
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        category: CATEGORY_TO_API_CATEGORY[category],
        tone,
        variables: detectedVariables,
        tags: [category],
        is_system: false,
      }

      const init = withCsrfHeaders({
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })

      const response = await fetch("/api/email-templates", init)
      const json = (await response.json().catch(() => null)) as
        | {
            error?: string
            template?: { id?: string | null }
          }
        | null

      if (!response.ok) {
        throw new Error(json?.error || "Failed to save template")
      }

      const templateId = json?.template?.id
      if (!templateId) {
        throw new Error("Template saved but no template id was returned")
      }

      showToast.success("Template saved!")
      onSaved(templateId)
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : "Failed to save template"
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g. Job Application Follow-Up"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as EditorCategory)}
                >
                  <SelectTrigger aria-label="Template category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tone</Label>
                <Select
                  value={tone}
                  onValueChange={(value) => setTone(value as EditorTone)}
                >
                  <SelectTrigger aria-label="Template tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TONE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="template-subject">Subject</Label>
                <Popover
                  open={subjectVariablesOpen}
                  onOpenChange={setSubjectVariablesOpen}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Insert Variable
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-2">
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {availableVariables.map((variable) => (
                        <button
                          key={`subject-${variable}`}
                          type="button"
                          onClick={() => {
                            insertVariable("subject", variable)
                            setSubjectVariablesOpen(false)
                          }}
                          className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                        >
                          {`{{${variable}}}`}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Input
                id="template-subject"
                ref={subjectRef}
                placeholder="Follow-up on {{role}} at {{company}}"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="template-body">Body</Label>
                <Popover open={bodyVariablesOpen} onOpenChange={setBodyVariablesOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Insert Variable
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-2">
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {availableVariables.map((variable) => (
                        <button
                          key={`body-${variable}`}
                          type="button"
                          onClick={() => {
                            insertVariable("body", variable)
                            setBodyVariablesOpen(false)
                          }}
                          className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                        >
                          {`{{${variable}}}`}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <Textarea
                id="template-body"
                ref={bodyRef}
                rows={10}
                className="min-h-[220px]"
                placeholder={`Hi {{first_name}},\n\nI wanted to follow up on...`}
                value={body}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Auto-detected Variables
              </p>
              {detectedVariables.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No variables detected yet. Use placeholders like {"{{first_name}}"}.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {detectedVariables.map((variable) => (
                    <Badge key={variable} variant="secondary" className="text-[10px]">
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Subject
              </p>
              <p className="text-sm leading-relaxed">
                <span className="font-medium">Subject: </span>
                {subjectPreview.length > 0 ? (
                  renderPreviewSegments(subjectPreview)
                ) : (
                  <span className="text-muted-foreground">No subject yet</span>
                )}
              </p>
            </div>

            <div className="rounded-md border bg-muted/20 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Body
              </p>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {bodyPreview.length > 0 ? (
                  renderPreviewSegments(bodyPreview)
                ) : (
                  <span className="text-muted-foreground">No body yet</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => void saveTemplate()} disabled={!canSave}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Template
        </Button>
      </div>
    </div>
  )
}
