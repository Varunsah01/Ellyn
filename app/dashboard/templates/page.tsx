"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  BookOpen,
  Briefcase,
  Copy,
  Plus,
  TrendingUp,
  User,
  WandSparkles,
} from "lucide-react"
import { TemplatePreview } from "@/components/TemplatePreview"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { TemplateEditorSheet } from "@/components/templates/TemplateEditorSheet"
import { ExtensionTemplatesSyncBanner } from "@/components/templates/ExtensionTemplatesSyncBanner"
import {
  TemplateCard,
  type TemplateItem,
} from "@/components/templates/TemplateCard"
import { useSaveToExtension } from "@/components/templates/SaveToExtensionButton"
import { UseTemplateDialog } from "@/components/templates/UseTemplateDialog"
import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { Textarea } from "@/components/ui/Textarea"
import { usePersona } from "@/context/PersonaContext"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"
import { extractVariables } from "@/lib/template-variables"
import { showToast } from "@/lib/toast"
import { cn } from "@/lib/utils"

type TabKey = "all" | "job_seeker" | "smb_sales" | "mine"
type AiUseCase = "job_seeker" | "smb_sales" | "general"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "All Templates", icon: BookOpen },
  { key: "job_seeker", label: "Job Search", icon: Briefcase },
  { key: "smb_sales", label: "Sales Outreach", icon: TrendingUp },
  { key: "mine", label: "My Templates", icon: User },
]

const TONE_OPTIONS = [
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

type ApiTemplate = {
  id: string
  name: string
  subject: string
  body: string
  tone?: string
  category?: string
  use_case?: string
  is_system?: boolean
  is_default?: boolean
  variables?: string[]
  tags?: string[]
  use_count?: number
  usage_count?: number
}

type SavePayload = {
  id?: string
  name: string
  subject: string
  body: string
  tone: string
  category: string
  use_case: string
  variables: string[]
  forceCreate?: boolean
  is_default?: boolean
}

type QuickDraftForm = {
  goal: string
  contactName: string
  company: string
  tone: string
}

type QuickDraftResult = {
  subject: string
  body: string
}

function readTemplatesFromResponse(payload: unknown): ApiTemplate[] {
  if (payload && typeof payload === "object") {
    const raw = payload as {
      templates?: unknown
      data?: { templates?: unknown }
    }

    if (Array.isArray(raw.templates)) {
      return raw.templates as ApiTemplate[]
    }

    if (Array.isArray(raw.data?.templates)) {
      return raw.data.templates as ApiTemplate[]
    }
  }

  return []
}

function mapTemplate(template: ApiTemplate): TemplateItem {
  return {
    id: template.id,
    name: template.name,
    subject: template.subject,
    body: template.body,
    tone: template.tone,
    category: template.category,
    use_case: template.use_case,
    is_system: template.is_system ?? false,
    is_default: template.is_default ?? false,
    variables: template.variables ?? [],
    tags: Array.isArray(template.tags) ? template.tags : [],
    usage_count: template.usage_count ?? template.use_count ?? 0,
  }
}

function readApiErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Request failed"
  }

  const raw = payload as {
    error?: unknown
    data?: { error?: unknown }
  }

  if (typeof raw.error === "string" && raw.error.trim()) {
    return raw.error
  }

  if (typeof raw.data?.error === "string" && raw.data.error.trim()) {
    return raw.data.error
  }

  return "Request failed"
}

export default function TemplatesPage() {
  const { isJobSeeker, isSalesRep } = usePersona()
  const { saveTemplate } = useSaveToExtension()

  const [userTemplates, setUserTemplates] = useState<TemplateItem[]>([])
  const [systemTemplates, setSystemTemplates] = useState<TemplateItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<TabKey>("all")

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<TemplateItem | null>(
    null
  )
  const [isSaving, setIsSaving] = useState(false)

  const [useDialogOpen, setUseDialogOpen] = useState(false)
  const [usingTemplate, setUsingTemplate] = useState<TemplateItem | null>(null)

  const [quickDraftOpen, setQuickDraftOpen] = useState(false)
  const [quickDraftForm, setQuickDraftForm] = useState<QuickDraftForm>({
    goal: "",
    contactName: "",
    company: "",
    tone: "professional",
  })
  const [quickDraftLoading, setQuickDraftLoading] = useState(false)
  const [quickDraftError, setQuickDraftError] = useState<string | null>(null)
  const [quickDraftResult, setQuickDraftResult] = useState<QuickDraftResult | null>(
    null
  )

  const hasSetDefaultTabRef = useRef(false)

  useEffect(() => {
    if (hasSetDefaultTabRef.current) return

    if (isJobSeeker) {
      setActiveTab("job_seeker")
      hasSetDefaultTabRef.current = true
      return
    }

    if (isSalesRep) {
      setActiveTab("smb_sales")
      hasSetDefaultTabRef.current = true
    }
  }, [isJobSeeker, isSalesRep])

  const inferredUseCase = useMemo<AiUseCase>(() => {
    if (activeTab === "job_seeker") return "job_seeker"
    if (activeTab === "smb_sales") return "smb_sales"
    if (isJobSeeker) return "job_seeker"
    if (isSalesRep) return "smb_sales"
    return "general"
  }, [activeTab, isJobSeeker, isSalesRep])

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const [userRes, systemRes] = await Promise.all([
        supabaseAuthedFetch("/api/v1/templates"),
        supabaseAuthedFetch("/api/templates/system"),
      ])

      const [userPayload, systemPayload] = await Promise.all([
        userRes.json().catch(() => null),
        systemRes.json().catch(() => null),
      ])

      if (!userRes.ok) {
        throw new Error(readApiErrorMessage(userPayload))
      }
      if (!systemRes.ok) {
        throw new Error(readApiErrorMessage(systemPayload))
      }

      setUserTemplates(readTemplatesFromResponse(userPayload).map(mapTemplate))
      setSystemTemplates(
        readTemplatesFromResponse(systemPayload).map(mapTemplate)
      )
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : "Failed to load templates"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTemplates()
  }, [fetchTemplates])

  const allTemplates = useMemo(
    () => [...systemTemplates, ...userTemplates],
    [systemTemplates, userTemplates]
  )

  const counts = useMemo(
    () => ({
      all: allTemplates.length,
      job_seeker: allTemplates.filter((template) => template.category === "job_seeker")
        .length,
      smb_sales: allTemplates.filter((template) => template.category === "smb_sales")
        .length,
      mine: userTemplates.length,
    }),
    [allTemplates, userTemplates]
  )

  const filteredTemplates = useMemo(() => {
    let list: TemplateItem[]
    if (activeTab === "mine") {
      list = userTemplates
    } else if (activeTab === "job_seeker") {
      list = allTemplates.filter((template) => template.category === "job_seeker")
    } else if (activeTab === "smb_sales") {
      list = allTemplates.filter((template) => template.category === "smb_sales")
    } else {
      list = allTemplates
    }

    const query = search.trim().toLowerCase()
    if (!query) return list

    return list.filter((template) => {
      return (
        template.name.toLowerCase().includes(query) ||
        template.subject.toLowerCase().includes(query) ||
        template.body.toLowerCase().includes(query)
      )
    })
  }, [activeTab, allTemplates, search, userTemplates])

  const handleNew = useCallback(() => {
    setEditingTemplate(null)
    setEditorOpen(true)
  }, [])

  const handleOpenQuickDraft = () => {
    setQuickDraftOpen(true)
    setQuickDraftError(null)
  }

  const handleEdit = (template: TemplateItem) => {
    setEditingTemplate(template)
    setEditorOpen(true)
  }

  const handleDuplicate = (template: TemplateItem) => {
    setEditingTemplate({
      ...template,
      id: "",
      name: `${template.name} (Copy)`,
      is_system: false,
      is_default: false,
    })
    setEditorOpen(true)
  }

  const handleDelete = async (template: TemplateItem) => {
    if (!template.id) return

    const shouldDelete = window.confirm(
      `Delete template \"${template.name}\"?`
    )
    if (!shouldDelete) return

    try {
      const response = await supabaseAuthedFetch(
        `/api/v1/templates/${template.id}`,
        { method: "DELETE" }
      )
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(readApiErrorMessage(payload))
      }

      showToast.success("Template deleted")
      await fetchTemplates()
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : "Failed to delete template"
      )
    }
  }

  const handleUse = (template: TemplateItem) => {
    if (template.id && !template.is_system) {
      void supabaseAuthedFetch(`/api/v1/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_count: (template.usage_count ?? 0) + 1 }),
      }).catch(() => {
        // usage increment is best-effort
      })
    }

    setUsingTemplate(template)
    setUseDialogOpen(true)
  }

  const handleSaveToExtension = useCallback(
    async (template: TemplateItem): Promise<boolean> => {
      const result = await saveTemplate({
        id: template.id,
        name: template.name,
        subject: template.subject,
        body: template.body,
        tone: template.tone,
        category: template.category,
        use_case: template.use_case,
        variables: template.variables,
      })

      return result.success
    },
    [saveTemplate]
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      if (event.key.toLowerCase() !== "n") return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const target = event.target as HTMLElement | null
      if (!target) return

      const editableTarget = target.closest(
        "input, textarea, select, [contenteditable='true'], [role='textbox']"
      )
      if (editableTarget) return

      event.preventDefault()
      handleNew()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handleNew])

  const handleSave = async (form: SavePayload) => {
    setIsSaving(true)
    try {
      const isUpdate = Boolean(form.id && !form.forceCreate)
      const endpoint = isUpdate
        ? `/api/v1/templates/${form.id}`
        : "/api/v1/templates"
      const method = isUpdate ? "PATCH" : "POST"

      const response = await supabaseAuthedFetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          subject: form.subject,
          body: form.body,
          tone: form.tone,
          category: form.category,
          use_case: form.use_case,
          variables: form.variables,
          is_default: false,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(readApiErrorMessage(payload))
      }

      showToast.success(isUpdate ? "Template updated" : "Template created")
      setEditorOpen(false)
      setEditingTemplate(null)
      await fetchTemplates()
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : "Failed to save template"
      )
    } finally {
      setIsSaving(false)
    }
  }

  const updateQuickDraftField = <K extends keyof QuickDraftForm>(
    key: K,
    value: QuickDraftForm[K]
  ) => {
    setQuickDraftForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleGenerateQuickDraft = async () => {
    if (quickDraftForm.goal.trim().length < 3) {
      setQuickDraftError("Goal must be at least 3 characters.")
      return
    }

    if (!quickDraftForm.contactName.trim()) {
      setQuickDraftError("Contact name is required.")
      return
    }

    if (!quickDraftForm.company.trim()) {
      setQuickDraftError("Company is required.")
      return
    }

    setQuickDraftError(null)
    setQuickDraftLoading(true)
    try {
      const response = await supabaseAuthedFetch("/api/v1/ai/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          use_case: inferredUseCase,
          tone: quickDraftForm.tone,
          goal: quickDraftForm.goal.trim(),
          contact: {
            firstName: quickDraftForm.contactName.trim(),
            company: quickDraftForm.company.trim(),
          },
          sender: {
            name: "{{userName}}",
          },
        }),
      })

      const payload = await response.json().catch(() => null)
      if (response.status === 402) {
        const quotaMessage = "AI quota exhausted. Upgrade your plan to continue."
        setQuickDraftError(quotaMessage)
        showToast.error(quotaMessage)
        return
      }

      if (!response.ok || !payload?.success) {
        throw new Error(readApiErrorMessage(payload))
      }

      setQuickDraftResult({
        subject: String(payload.subject || ""),
        body: String(payload.body || ""),
      })
    } catch (error) {
      setQuickDraftError(
        error instanceof Error ? error.message : "Failed to generate quick draft"
      )
    } finally {
      setQuickDraftLoading(false)
    }
  }

  const handleQuickDraftCopy = async () => {
    if (!quickDraftResult) return

    try {
      await navigator.clipboard.writeText(
        `Subject: ${quickDraftResult.subject}\n\n${quickDraftResult.body}`
      )
      showToast.success("Draft copied to clipboard")
    } catch {
      showToast.error("Failed to copy draft")
    }
  }

  const handleQuickDraftSaveAsTemplate = () => {
    if (!quickDraftResult) return

    const namePrefix =
      inferredUseCase === "job_seeker"
        ? "Job Outreach"
        : inferredUseCase === "smb_sales"
          ? "Sales Outreach"
          : "Outreach"

    const templateName = quickDraftForm.company.trim()
      ? `${namePrefix} - ${quickDraftForm.company.trim()}`
      : `${namePrefix} Draft`

    const variables = extractVariables(
      `${quickDraftResult.subject} ${quickDraftResult.body}`
    )

    setEditingTemplate({
      id: "",
      name: templateName,
      subject: quickDraftResult.subject,
      body: quickDraftResult.body,
      tone: quickDraftForm.tone,
      category: inferredUseCase === "general" ? "general" : inferredUseCase,
      use_case: inferredUseCase,
      is_system: false,
      is_default: false,
      variables,
      usage_count: 0,
    })
    setQuickDraftOpen(false)
    setEditorOpen(true)
  }

  return (
    <DashboardShell>
      <ExtensionTemplatesSyncBanner />

      <div className="flex gap-6">
        <aside className="sticky top-6 hidden w-56 flex-shrink-0 self-start space-y-3 md:block">
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 text-sm"
          />

          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              className="justify-start gap-1.5"
              style={{ backgroundColor: "#7C3AED", color: "#fff" }}
              onClick={handleNew}
            >
              <Plus className="h-4 w-4" />
              New
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="justify-start gap-1.5"
              onClick={handleOpenQuickDraft}
            >
              <WandSparkles className="h-4 w-4" />
              Quick Draft
            </Button>
          </div>

          <nav className="space-y-0.5 pt-1">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.key

              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-violet-50 font-medium text-violet-700"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {tab.key === "mine" ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        isActive
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {counts.mine}
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        isActive ? "text-violet-500" : "text-muted-foreground"
                      )}
                    >
                      {counts[tab.key]}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1
                className="text-2xl font-semibold text-[#2D2B55]"
                style={{ fontFamily: "Fraunces, serif" }}
              >
                Templates
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredTemplates.length} template
                {filteredTemplates.length !== 1 ? "s" : ""}
                {activeTab !== "all"
                  ? ` in ${TABS.find((tab) => tab.key === activeTab)?.label}`
                  : ""}
              </p>
            </div>

            <div className="w-full space-y-2 md:hidden">
              <Input
                placeholder="Search templates..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  style={{ backgroundColor: "#7C3AED", color: "#fff" }}
                  onClick={handleNew}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  New Template
                </Button>
                <Button size="sm" variant="outline" onClick={handleOpenQuickDraft}>
                  <WandSparkles className="mr-1.5 h-4 w-4" />
                  Quick Draft
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-48 animate-pulse rounded-xl bg-muted" />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {search ? "No templates match your search" : "No templates yet"}
              </p>
              {!search && activeTab === "mine" && (
                <Button
                  size="sm"
                  className="mt-4"
                  style={{ backgroundColor: "#7C3AED", color: "#fff" }}
                  onClick={handleNew}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Create your first template
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={handleUse}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                  onSaveToExtension={handleSaveToExtension}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-6 right-4 z-40 flex items-center gap-2 md:hidden">
        <Button
          size="icon"
          variant="outline"
          className="h-12 w-12 rounded-full border-violet-200 bg-white shadow-lg"
          onClick={handleOpenQuickDraft}
          aria-label="Quick Draft"
        >
          <WandSparkles className="h-5 w-5" />
        </Button>
        <Button
          size="icon"
          className="h-12 w-12 rounded-full shadow-lg"
          style={{ backgroundColor: "#7C3AED", color: "#fff" }}
          onClick={handleNew}
          aria-label="New Template"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <TemplateEditorSheet
        open={editorOpen}
        template={editingTemplate}
        isSaving={isSaving}
        onOpenChange={setEditorOpen}
        onSave={handleSave}
      />

      <UseTemplateDialog
        open={useDialogOpen}
        template={usingTemplate}
        onOpenChange={setUseDialogOpen}
      />

      <Dialog
        open={quickDraftOpen}
        onOpenChange={(open) => {
          setQuickDraftOpen(open)
          if (!open) {
            setQuickDraftError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Quick Draft</DialogTitle>
            <DialogDescription>
              Generate a draft in seconds, then save it as a template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {quickDraftError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {quickDraftError}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="qd-goal">Goal</Label>
              <Textarea
                id="qd-goal"
                rows={3}
                placeholder="Get a reply for a 15-minute intro call"
                value={quickDraftForm.goal}
                onChange={(event) => updateQuickDraftField("goal", event.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="qd-contact">Contact Name</Label>
                <Input
                  id="qd-contact"
                  placeholder="Avery"
                  value={quickDraftForm.contactName}
                  onChange={(event) =>
                    updateQuickDraftField("contactName", event.target.value)
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qd-company">Company</Label>
                <Input
                  id="qd-company"
                  placeholder="Acme"
                  value={quickDraftForm.company}
                  onChange={(event) =>
                    updateQuickDraftField("company", event.target.value)
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Tone</Label>
              <Select
                value={quickDraftForm.tone}
                onValueChange={(value) => updateQuickDraftField("tone", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((tone) => (
                    <SelectItem key={tone} value={tone}>
                      {tone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              onClick={() => void handleGenerateQuickDraft()}
              disabled={quickDraftLoading}
              className="w-full"
              style={{ backgroundColor: "#7C3AED", color: "#fff" }}
            >
              {quickDraftLoading ? "Generating..." : "Generate Draft"}
            </Button>

            {quickDraftResult && (
              <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <TemplatePreview
                  subject={quickDraftResult.subject}
                  body={quickDraftResult.body}
                  className="border-slate-200 bg-white"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleQuickDraftSaveAsTemplate}
                    style={{ backgroundColor: "#7C3AED", color: "#fff" }}
                  >
                    Save as Template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleQuickDraftCopy()}
                  >
                    <Copy className="mr-1.5 h-4 w-4" />
                    Copy to Clipboard
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuickDraftOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
