"use client"

import { useEffect, useRef, useState } from "react"
import { Sparkles, Undo2, Plus, ChevronDown } from "lucide-react"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover"
import { showToast } from "@/lib/toast"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"
import {
  extractVariables,
  PREDEFINED_VARIABLE_LIST,
} from "@/lib/template-variables"
import { useQuotaGate } from "@/hooks/useQuotaGate"
import type { TemplateItem } from "@/components/templates/TemplateCard"

const TONES = [
  "professional",
  "casual",
  "formal",
  "friendly",
]

const CATEGORIES = [
  { value: "job_seeker", label: "Job Seeker" },
  { value: "smb_sales", label: "Sales Outreach" },
  { value: "general", label: "General" },
]

type FormState = {
  name: string
  subject: string
  body: string
  tone: string
  category: string
  use_case: string
}

interface TemplateEditorSheetProps {
  open: boolean
  template: TemplateItem | null
  isSaving?: boolean
  onOpenChange: (open: boolean) => void
  onSave: (
    form: FormState & { id?: string; variables: string[] }
  ) => Promise<void>
}

export function TemplateEditorSheet({
  open,
  template,
  isSaving,
  onOpenChange,
  onSave,
}: TemplateEditorSheetProps) {
  const { canUse, openUpgradeModal, UpgradeModal } = useQuotaGate("ai_draft")

  const [form, setForm] = useState<FormState>({
    name: "",
    subject: "",
    body: "",
    tone: "professional",
    category: "general",
    use_case: "",
  })

  const [enhancing, setEnhancing] = useState(false)
  const [changingTone, setChangingTone] = useState(false)
  const [undoBody, setUndoBody] = useState<string | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [varPickerOpen, setVarPickerOpen] = useState(false)

  // Populate form when template changes
  useEffect(() => {
    if (template) {
      setForm({
        name: template.name,
        subject: template.subject,
        body: template.body,
        tone: template.tone ?? "professional",
        category: template.category ?? "general",
        use_case: template.use_case ?? "",
      })
    } else {
      setForm({
        name: "",
        subject: "",
        body: "",
        tone: "professional",
        category: "general",
        use_case: "",
      })
    }
    setUndoBody(null)
  }, [template])

  // Auto-resize textarea
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [form.body])

  const detectedVars = extractVariables(`${form.subject} ${form.body}`)

  const insertVariable = (varName: string) => {
    const el = bodyRef.current
    if (!el) {
      setForm((f) => ({ ...f, body: f.body + `{{${varName}}}` }))
      return
    }
    const start = el.selectionStart ?? form.body.length
    const end = el.selectionEnd ?? form.body.length
    const token = `{{${varName}}}`
    const newBody =
      form.body.slice(0, start) + token + form.body.slice(end)
    setForm((f) => ({ ...f, body: newBody }))
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
    setVarPickerOpen(false)
  }

  const clearUndoTimer = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }

  const checkAiQuotaBeforeGenerate = async (): Promise<boolean> => {
    if (!canUse) {
      openUpgradeModal()
      return false
    }

    try {
      const response = await supabaseAuthedFetch(
        "/api/quota/check?feature=ai_generation",
        { method: "GET" }
      )
      const payload = (await response.json().catch(() => null)) as
        | { allowed?: boolean }
        | null

      if (!response.ok) {
        return canUse
      }

      if (payload?.allowed === false) {
        openUpgradeModal()
        return false
      }

      return true
    } catch {
      return canUse
    }
  }

  const handleEnhance = async () => {
    if (!form.body.trim()) {
      showToast.error("Write a body first before enhancing")
      return
    }
    const allowed = await checkAiQuotaBeforeGenerate()
    if (!allowed) {
      return
    }
    setEnhancing(true)
    try {
      const res = await supabaseAuthedFetch("/api/ai/enhance-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: form.body,
          action: "enhance",
          additionalContext: { tone: form.tone },
        }),
      })
      const data = (await res.json()) as {
        success: boolean
        enhancedDraft?: string
        error?: string
      }
      if (!res.ok || !data.success) {
        if (res.status === 402) {
          openUpgradeModal()
          return
        }
        throw new Error(data.error ?? "Enhancement failed")
      }
      if (data.enhancedDraft) {
        clearUndoTimer()
        setUndoBody(form.body)
        setForm((f) => ({ ...f, body: data.enhancedDraft! }))
        showToast.success("Draft enhanced — 5s undo available")
        undoTimerRef.current = setTimeout(() => {
          setUndoBody(null)
          undoTimerRef.current = null
        }, 5000)
      }
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Enhancement failed"
      )
    } finally {
      setEnhancing(false)
    }
  }

  const handleUndo = () => {
    if (!undoBody) return
    clearUndoTimer()
    setForm((f) => ({ ...f, body: undoBody }))
    setUndoBody(null)
    showToast.info("Reverted to original")
  }

  const handleToneChange = async (targetTone: string) => {
    if (!form.body.trim()) {
      showToast.error("Write a body first")
      return
    }
    const allowed = await checkAiQuotaBeforeGenerate()
    if (!allowed) {
      return
    }
    setChangingTone(true)
    try {
      const res = await supabaseAuthedFetch("/api/ai/customize-tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: form.body, targetTone }),
      })
      const data = (await res.json()) as {
        success: boolean
        customizedDraft?: string
        error?: string
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Tone change failed")
      }
      if (data.customizedDraft) {
        setForm((f) => ({
          ...f,
          body: data.customizedDraft!,
          tone: targetTone,
        }))
        showToast.success(`Tone changed to ${targetTone}`)
      }
    } catch (err) {
      showToast.error(err instanceof Error ? err.message : "Tone change failed")
    } finally {
      setChangingTone(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.subject.trim() || !form.body.trim()) {
      showToast.error("Name, subject, and body are required")
      return
    }
    await onSave({
      ...form,
      id: template?.id,
      variables: extractVariables(`${form.subject} ${form.body}`),
    })
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col overflow-hidden sm:max-w-2xl"
        >
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="text-[#2D2B55]">
              {template?.id ? "Edit Template" : "New Template"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 space-y-4 overflow-y-auto pb-4 pr-1 pt-2">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Name *</Label>
              <Input
                id="tpl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Cold Outreach to Hiring Manager"
              />
            </div>

            {/* Category + Use Case row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="tpl-usecase">Use Case</Label>
                <Input
                  id="tpl-usecase"
                  value={form.use_case}
                  onChange={(e) =>
                    setForm({ ...form, use_case: e.target.value })
                  }
                  placeholder="cold_outreach"
                />
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="tpl-subject">Subject *</Label>
              <Input
                id="tpl-subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Quick question about {{role}} at {{company}}"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="tpl-body">Body *</Label>
                {/* Variable inserter */}
                <Popover open={varPickerOpen} onOpenChange={setVarPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 gap-1 text-xs"
                    >
                      <Plus className="h-3 w-3" />
                      Insert Variable
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-2" align="end">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Common Variables
                    </p>
                    <div className="space-y-0.5">
                      {PREDEFINED_VARIABLE_LIST.map((v) => (
                        <button
                          key={v.name}
                          type="button"
                          onClick={() => insertVariable(v.name)}
                          className="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-muted transition-colors"
                        >
                          <span className="text-xs font-medium">
                            {`{{${v.name}}}`}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {v.description}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <textarea
                id="tpl-body"
                ref={bodyRef}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Hi {{first_name}},&#10;&#10;…"
                rows={10}
                className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
                style={{ overflow: "hidden" }}
              />

              {/* Detected variable chips */}
              {detectedVars.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {detectedVars.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      title="Click to insert at cursor"
                      className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200 hover:bg-violet-100 transition-colors"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* AI actions row */}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-violet-200 text-violet-700 hover:bg-violet-100"
                onClick={() => void handleEnhance()}
                disabled={enhancing || changingTone}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {enhancing ? "Enhancing…" : "AI Enhance"}
              </Button>

              {undoBody && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-muted-foreground"
                  onClick={handleUndo}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  Undo
                </Button>
              )}

              {/* Tone picker */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 border-violet-200 text-violet-700 hover:bg-violet-100"
                    disabled={enhancing || changingTone}
                  >
                    {changingTone ? "Changing…" : `Tone: ${form.tone}`}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {TONES.map((t) => (
                    <DropdownMenuItem
                      key={t}
                      onClick={() => void handleToneChange(t)}
                      className="capitalize"
                    >
                      {t}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <SheetFooter className="flex-shrink-0 gap-2 border-t pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              disabled={isSaving}
              style={{ backgroundColor: "#7C3AED", color: "#fff" }}
            >
              {isSaving ? "Saving…" : "Save Template"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {UpgradeModal && <UpgradeModal />}
    </>
  )
}
