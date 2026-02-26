"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Eye, EyeOff, Plus } from "lucide-react"
import { TemplatePreview } from "@/components/TemplatePreview"
import { AiDraftPanel } from "@/components/templates/AiDraftPanel"
import { SaveToExtensionButton } from "@/components/templates/SaveToExtensionButton"
import type { TemplateItem } from "@/components/templates/TemplateCard"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/Sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import {
  extractVariables,
  PREDEFINED_VARIABLE_LIST,
} from "@/lib/template-variables"

type FormState = {
  name: string
  subject: string
  body: string
  tone: string
  category: string
  use_case: string
}

type FormErrors = {
  name?: string
  subject?: string
  body?: string
}

const TONES = [
  "professional",
  "friendly",
  "direct",
  "warm",
  "consultative",
  "executive",
  "enthusiastic",
  "value-first",
  "light",
  "confident",
  "collaborative",
] as const

const CATEGORIES = [
  { value: "job_seeker", label: "Job Seeker" },
  { value: "smb_sales", label: "Sales Outreach" },
  { value: "general", label: "General" },
  { value: "custom", label: "Custom" },
] as const

interface TemplateEditorSheetProps {
  open: boolean
  template: TemplateItem | null
  isSaving?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (
    form: FormState & {
      id?: string
      variables: string[]
      forceCreate?: boolean
      is_default?: boolean
    }
  ) => Promise<void>
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {}

  if (form.name.trim().length < 3) {
    errors.name = "Name must be at least 3 characters"
  }

  if (form.subject.trim().length < 5) {
    errors.subject = "Subject must be at least 5 characters"
  }

  if (form.body.trim().length < 20) {
    errors.body = "Body must be at least 20 characters"
  }

  return errors
}

export function TemplateEditorSheet({
  open,
  template,
  isSaving,
  onOpenChange,
  onSave,
}: TemplateEditorSheetProps) {
  const [form, setForm] = useState<FormState>({
    name: "",
    subject: "",
    body: "",
    tone: "professional",
    category: "general",
    use_case: "general",
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [isAiBusy, setIsAiBusy] = useState(false)

  const subjectRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const isSystemTemplate = Boolean(template?.is_system || template?.is_default)

  useEffect(() => {
    if (template) {
      const templateUseCase =
        template.use_case === "job_seeker" ||
        template.use_case === "smb_sales" ||
        template.use_case === "general"
          ? template.use_case
          : template.category === "job_seeker" ||
              template.category === "smb_sales" ||
              template.category === "general"
            ? template.category
            : "general"

      setForm({
        name: template.name,
        subject: template.subject,
        body: template.body,
        tone: template.tone ?? "professional",
        category: template.category ?? "general",
        use_case: templateUseCase,
      })
    } else {
      setForm({
        name: "",
        subject: "",
        body: "",
        tone: "professional",
        category: "general",
        use_case: "general",
      })
    }

    setErrors({})
    setShowMobilePreview(false)
    setIsAiBusy(false)
  }, [template])

  const detectedVars = useMemo(
    () => extractVariables(`${form.subject} ${form.body}`),
    [form.subject, form.body]
  )

  const variableNames = useMemo(() => {
    const predefined = PREDEFINED_VARIABLE_LIST.map((item) => item.name)
    return Array.from(new Set([...predefined, ...detectedVars]))
  }, [detectedVars])

  const aiUseCase = useMemo(() => {
    if (
      form.use_case === "job_seeker" ||
      form.use_case === "smb_sales" ||
      form.use_case === "general"
    ) {
      return form.use_case
    }

    if (
      form.category === "job_seeker" ||
      form.category === "smb_sales" ||
      form.category === "general"
    ) {
      return form.category
    }

    return "general"
  }, [form.category, form.use_case])

  const aiContact = useMemo(
    () => ({
      firstName: variableNames.includes("firstName") ? "{{firstName}}" : "there",
      company: variableNames.includes("company") ? "{{company}}" : "your company",
      role: variableNames.includes("role") ? "{{role}}" : undefined,
    }),
    [variableNames]
  )

  const aiSender = useMemo(
    () => ({
      name: variableNames.includes("userName") ? "{{userName}}" : "You",
      context: "",
    }),
    [variableNames]
  )

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const insertVariableAtCursor = (target: "subject" | "body", varName: string) => {
    const token = `{{${varName}}}`

    if (target === "subject") {
      const input = subjectRef.current
      if (!input) {
        updateField("subject", `${form.subject}${token}`)
        return
      }

      const start = input.selectionStart ?? form.subject.length
      const end = input.selectionEnd ?? form.subject.length
      const nextValue =
        form.subject.slice(0, start) + token + form.subject.slice(end)

      updateField("subject", nextValue)
      requestAnimationFrame(() => {
        input.focus()
        const nextPos = start + token.length
        input.setSelectionRange(nextPos, nextPos)
      })

      return
    }

    const textarea = bodyRef.current
    if (!textarea) {
      updateField("body", `${form.body}${token}`)
      return
    }

    const start = textarea.selectionStart ?? form.body.length
    const end = textarea.selectionEnd ?? form.body.length
    const nextValue = form.body.slice(0, start) + token + form.body.slice(end)

    updateField("body", nextValue)
    requestAnimationFrame(() => {
      textarea.focus()
      const nextPos = start + token.length
      textarea.setSelectionRange(nextPos, nextPos)
    })
  }

  const handleSave = async () => {
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    await onSave({
      ...form,
      id: isSystemTemplate ? undefined : template?.id,
      forceCreate: isSystemTemplate,
      is_default: false,
      variables: extractVariables(`${form.subject} ${form.body}`),
    })
  }

  const sheetTitle = isSystemTemplate
    ? `Edit Copy of ${template?.name ?? "Template"}`
    : template?.id
      ? "Edit Template"
      : "New Template"

  const previewTemplate = {
    id: template?.id ?? "",
    name: form.name,
    subject: form.subject,
    body: form.body,
    tone: form.tone,
    category: form.category,
    use_case: form.use_case,
    variables: extractVariables(`${form.subject} ${form.body}`),
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-hidden sm:max-w-5xl"
        aria-label="Template editor"
      >
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="text-[#2D2B55]">{sheetTitle}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden pt-2">
          <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div className="space-y-4 overflow-y-auto pb-4 pr-1">
              {isSystemTemplate && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  This is a system template - editing will create a personal copy.
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="tpl-name">Template Name *</Label>
                <Input
                  id="tpl-name"
                  aria-label="Template name"
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="Cold Outreach to Hiring Manager"
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) => updateField("category", value)}
                  >
                    <SelectTrigger aria-label="Template category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Tone</Label>
                  <Select
                    value={form.tone}
                    onValueChange={(value) => updateField("tone", value)}
                  >
                    <SelectTrigger aria-label="Template tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONES.map((tone) => (
                        <SelectItem key={tone} value={tone}>
                          {tone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tpl-usecase">Use Case</Label>
                <Input
                  id="tpl-usecase"
                  aria-label="Template use case"
                  value={form.use_case}
                  onChange={(event) =>
                    updateField("use_case", event.target.value)
                    }
                    placeholder="job_seeker | smb_sales | general"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tpl-subject">Subject *</Label>
                <Input
                  id="tpl-subject"
                  ref={subjectRef}
                  aria-label="Template subject"
                  value={form.subject}
                  onChange={(event) => updateField("subject", event.target.value)}
                  placeholder="Quick question about {{role}} at {{company}}"
                />
                {errors.subject && (
                  <p className="text-xs text-destructive">{errors.subject}</p>
                )}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {variableNames.slice(0, 10).map((varName) => (
                    <button
                      key={`subject-${varName}`}
                      type="button"
                      onClick={() => insertVariableAtCursor("subject", varName)}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 transition-colors hover:bg-slate-200"
                    >
                      {`{{${varName}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="tpl-body">Body *</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 text-xs"
                      onClick={() =>
                        insertVariableAtCursor(
                          "body",
                          variableNames[0] ??
                            PREDEFINED_VARIABLE_LIST[0]?.name ??
                            "firstName"
                        )
                      }
                    >
                      <Plus className="h-3 w-3" />
                      Insert Variable
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 text-xs lg:hidden"
                      onClick={() => setShowMobilePreview((prev) => !prev)}
                    >
                      {showMobilePreview ? (
                        <EyeOff className="h-3.5 w-3.5" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                      {showMobilePreview ? "Hide Preview" : "Show Preview"}
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <textarea
                    id="tpl-body"
                    ref={bodyRef}
                    aria-label="Template body"
                    value={form.body}
                    onChange={(event) => updateField("body", event.target.value)}
                    placeholder="Hi {{firstName}},\n\n..."
                    rows={10}
                    className="min-h-[220px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  />

                  {isAiBusy && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md border border-violet-200/70 bg-white/70 backdrop-blur-[1px]">
                      <div className="h-full w-full animate-pulse bg-gradient-to-r from-transparent via-violet-100/70 to-transparent" />
                    </div>
                  )}
                </div>

                {errors.body && (
                  <p className="text-xs text-destructive">{errors.body}</p>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {variableNames.map((varName) => (
                    <button
                      key={`body-${varName}`}
                      type="button"
                      onClick={() => insertVariableAtCursor("body", varName)}
                      className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200 transition-colors hover:bg-violet-100"
                    >
                      {`{{${varName}}}`}
                    </button>
                  ))}
                </div>
              </div>

              <AiDraftPanel
                subject={form.subject}
                body={form.body}
                tone={form.tone}
                useCase={aiUseCase}
                contact={aiContact}
                sender={aiSender}
                onApplySubject={(nextSubject) =>
                  updateField("subject", nextSubject)
                }
                onApplyBody={(nextBody) => updateField("body", nextBody)}
                onBusyChange={setIsAiBusy}
              />

              {showMobilePreview && (
                <div className="lg:hidden">
                  <TemplatePreview
                    subject={form.subject}
                    body={form.body}
                    className="border-slate-200 bg-slate-50"
                  />
                </div>
              )}
            </div>

            <div className="hidden overflow-y-auto border-l pl-4 lg:block">
              <TemplatePreview
                subject={form.subject}
                body={form.body}
                className="sticky top-0 border-slate-200 bg-slate-50"
              />
            </div>
          </div>
        </div>

        <SheetFooter className="flex-shrink-0 gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <SaveToExtensionButton
            template={previewTemplate}
            variant="outline"
            disabled={isSaving}
          />
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            style={{ backgroundColor: "#7C3AED", color: "#fff" }}
          >
            {isSaving ? "Saving..." : "Save Template"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
