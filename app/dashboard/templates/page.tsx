"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  BookOpen,
  Briefcase,
  Plus,
  TrendingUp,
  User,
} from "lucide-react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
  TemplateCard,
  type TemplateItem,
} from "@/components/templates/TemplateCard"
import { TemplateEditorSheet } from "@/components/templates/TemplateEditorSheet"
import { UseTemplateDialog } from "@/components/templates/UseTemplateDialog"
import { showToast } from "@/lib/toast"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"
import { cn } from "@/lib/utils"

type TabKey = "all" | "job_seeker" | "smb_sales" | "mine"

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "all", label: "All Templates", icon: BookOpen },
  { key: "job_seeker", label: "Job Search", icon: Briefcase },
  { key: "smb_sales", label: "Sales Outreach", icon: TrendingUp },
  { key: "mine", label: "My Templates", icon: User },
]

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
  use_count?: number
}

function mapTemplate(t: ApiTemplate): TemplateItem {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject,
    body: t.body,
    tone: t.tone,
    category: t.category,
    use_case: t.use_case,
    is_system: t.is_system ?? false,
    is_default: t.is_default ?? false,
    variables: t.variables ?? [],
    usage_count: t.use_count ?? 0,
  }
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
}

export default function TemplatesPage() {
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

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const [userRes, sysRes] = await Promise.all([
        supabaseAuthedFetch("/api/templates"),
        supabaseAuthedFetch("/api/templates/system"),
      ])
      const [userData, sysData] = await Promise.all([
        userRes.json() as Promise<{ templates?: ApiTemplate[] }>,
        sysRes.json() as Promise<{ templates?: ApiTemplate[] }>,
      ])
      setUserTemplates((userData.templates ?? []).map(mapTemplate))
      setSystemTemplates((sysData.templates ?? []).map(mapTemplate))
    } catch {
      showToast.error("Failed to load templates")
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

  const filteredTemplates = useMemo(() => {
    let list: TemplateItem[]
    if (activeTab === "mine") list = userTemplates
    else if (activeTab === "job_seeker")
      list = allTemplates.filter((t) => t.category === "job_seeker")
    else if (activeTab === "smb_sales")
      list = allTemplates.filter((t) => t.category === "smb_sales")
    else list = allTemplates

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q)
      )
    }
    return list
  }, [allTemplates, userTemplates, activeTab, search])

  const counts = useMemo(
    () => ({
      all: allTemplates.length,
      job_seeker: allTemplates.filter((t) => t.category === "job_seeker")
        .length,
      smb_sales: allTemplates.filter((t) => t.category === "smb_sales").length,
      mine: userTemplates.length,
    }),
    [allTemplates, userTemplates]
  )

  const handleNew = () => {
    setEditingTemplate(null)
    setEditorOpen(true)
  }

  const handleEdit = (t: TemplateItem) => {
    setEditingTemplate(t)
    setEditorOpen(true)
  }

  const handleDuplicate = (t: TemplateItem) => {
    setEditingTemplate({
      ...t,
      id: "",
      name: `${t.name} (Copy)`,
      is_system: false,
      is_default: false,
    })
    setEditorOpen(true)
  }

  const handleUse = (t: TemplateItem) => {
    // Increment usage count on the server (fire-and-forget)
    if (t.id && !t.is_system) {
      void supabaseAuthedFetch(`/api/templates/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ use_count: (t.usage_count ?? 0) + 1 }),
      }).catch(() => {})
    }
    setUsingTemplate(t)
    setUseDialogOpen(true)
  }

  const handleSave = async (form: SavePayload) => {
    setIsSaving(true)
    try {
      const isUpdate = Boolean(form.id)
      const url = isUpdate
        ? `/api/templates/${form.id}`
        : "/api/templates"
      const method = isUpdate ? "PATCH" : "POST"
      const res = await supabaseAuthedFetch(url, {
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
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Save failed")
      }
      showToast.success(isUpdate ? "Template updated" : "Template created")
      setEditorOpen(false)
      setEditingTemplate(null)
      await fetchTemplates()
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Save failed"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DashboardShell>
      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 self-start sticky top-6 space-y-3">
          <Input
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="w-full justify-start gap-2"
            style={{ backgroundColor: "#7C3AED", color: "#fff" }}
            onClick={handleNew}
          >
            <Plus className="h-4 w-4" />
            New Template
          </Button>
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
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      isActive
                        ? "text-violet-500"
                        : "text-muted-foreground"
                    )}
                  >
                    {counts[tab.key]}
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Main area */}
        <div className="min-w-0 flex-1">
          <div className="mb-5">
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
                ? ` in ${TABS.find((t) => t.key === activeTab)?.label}`
                : ""}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse rounded-xl bg-muted"
                />
              ))}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">
                {search
                  ? "No templates match your search"
                  : "No templates yet"}
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
              {filteredTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onUse={handleUse}
                  onEdit={handleEdit}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          )}
        </div>
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
    </DashboardShell>
  )
}
