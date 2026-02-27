"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Eye, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import {
  EMAIL_TEMPLATE_PRESETS,
  PRESET_CATEGORY_META,
  type EmailTemplatePreset,
} from "@/lib/email-template-presets"
import { usePersona } from "@/context/PersonaContext"

type FilterTab =
  | "all"
  | "job_search"
  | "networking"
  | "sales_outreach"
  | "enterprise"
  | "follow_up"

interface Props {
  onSelectPreset: (preset: EmailTemplatePreset) => void
  onBlankCanvas: () => void
}

function toneLabel(tone: EmailTemplatePreset["tone"]): string {
  return tone.charAt(0).toUpperCase() + tone.slice(1)
}

function variablesPreview(variables: string[]): string[] {
  return variables.slice(0, 4)
}

function EmptyTemplateCard({
  onSelect,
  label,
}: {
  onSelect: () => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="border border-dashed rounded-xl bg-card p-5 flex flex-col items-center justify-center text-center gap-2 hover:border-primary/40 hover:bg-muted/20 transition-colors min-h-[244px]"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-dashed">
        <Plus className="h-5 w-5 text-muted-foreground" />
      </span>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-xs text-muted-foreground">Write your own from scratch</p>
    </button>
  )
}

function TemplateCard({
  preset,
  onPreview,
  onUse,
}: {
  preset: EmailTemplatePreset
  onPreview: () => void
  onUse: () => void
}) {
  const badge = PRESET_CATEGORY_META[preset.category]
  const visibleVariables = variablesPreview(preset.variables)
  const hiddenCount = Math.max(preset.variables.length - visibleVariables.length, 0)

  return (
    <div className="border rounded-xl bg-card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <Badge
        variant="outline"
        className={`self-start text-[10px] font-bold tracking-wider px-2 py-0.5 ${badge.className}`}
      >
        {badge.label.toUpperCase()}
      </Badge>

      <div>
        <h3 className="text-sm font-semibold leading-snug flex items-center gap-1.5">
          <span className="text-base" aria-hidden="true">
            {preset.icon}
          </span>
          <span>{preset.name}</span>
        </h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {preset.description}
        </p>
      </div>

      <Badge
        variant="outline"
        className="self-start text-[10px] font-medium text-muted-foreground"
      >
        Tone: {toneLabel(preset.tone)}
      </Badge>

      <div className="flex flex-wrap gap-1">
        {visibleVariables.map((variable) => (
          <Badge
            key={variable}
            variant="secondary"
            className="text-[10px] font-medium"
          >
            {`{{${variable}}}`}
          </Badge>
        ))}
        {hiddenCount > 0 && (
          <Badge variant="secondary" className="text-[10px] font-medium">
            +{hiddenCount} more
          </Badge>
        )}
      </div>

      <div className="flex gap-2 mt-auto pt-1">
        <Button variant="outline" size="sm" className="flex-1" onClick={onPreview}>
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          Preview
        </Button>
        <Button size="sm" className="flex-1" onClick={onUse}>
          Use Template
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function PreviewModal({
  preset,
  isOpen,
  onClose,
  onUse,
}: {
  preset: EmailTemplatePreset
  isOpen: boolean
  onClose: () => void
  onUse: () => void
}) {
  const badge = PRESET_CATEGORY_META[preset.category]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={`text-[10px] font-bold tracking-wider px-2 py-0.5 ${badge.className}`}
            >
              {badge.label.toUpperCase()}
            </Badge>
          </div>
          <DialogTitle className="flex items-center gap-2">
            <span aria-hidden="true">{preset.icon}</span>
            <span>{preset.name}</span>
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{preset.description}</p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="rounded-lg border p-3">
            <p className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground mb-1">
              Subject
            </p>
            <p className="text-sm font-medium">{preset.subject}</p>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground mb-2">
              Body
            </p>
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed font-mono text-foreground">
              {preset.body}
            </pre>
          </div>

          <div className="rounded-lg border p-3">
            <p className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground mb-2">
              Variables
            </p>
            <div className="flex flex-wrap gap-1">
              {preset.variables.map((variable) => (
                <Badge
                  key={variable}
                  variant="secondary"
                  className="text-[10px] font-medium"
                >
                  {`{{${variable}}}`}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onUse}>
            Use Template
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EmailTemplateGallery({
  onSelectPreset,
  onBlankCanvas,
}: Props) {
  const { isJobSeeker, persona } = usePersona()
  const defaultTab: FilterTab = isJobSeeker ? "job_search" : "sales_outreach"

  const [activeTab, setActiveTab] = useState<FilterTab>(defaultTab)
  const [search, setSearch] = useState("")
  const [previewPreset, setPreviewPreset] = useState<EmailTemplatePreset | null>(null)

  useEffect(() => {
    setActiveTab(persona === "job_seeker" ? "job_search" : "sales_outreach")
  }, [persona])

  const allowedCategories = useMemo<ReadonlyArray<string>>(
    () =>
      isJobSeeker
        ? (["job_search", "networking", "follow_up"] as const)
        : (["sales_outreach", "enterprise", "follow_up"] as const),
    [isJobSeeker]
  )

  const filteredPresets = useMemo(() => {
    const query = search.trim().toLowerCase()

    return EMAIL_TEMPLATE_PRESETS.filter((preset) => {
      const presetCategory = String(preset.category || "")
      const personaAllowed = allowedCategories.includes(presetCategory)

      if (!personaAllowed) return false

      const matchesTab =
        activeTab === "all"
          ? true
          : presetCategory === activeTab

      const matchesSearch =
        query.length === 0 ||
        preset.name.toLowerCase().includes(query) ||
        preset.description.toLowerCase().includes(query)

      return matchesTab && matchesSearch
    })
  }, [activeTab, allowedCategories, search])

  const tabs: Array<{ value: FilterTab; label: string }> = isJobSeeker
    ? [
        { value: "all", label: "All" },
        { value: "job_search", label: "Job Search" },
        { value: "networking", label: "Networking" },
        { value: "follow_up", label: "Follow-Up" },
      ]
    : [
        { value: "all", label: "All" },
        { value: "sales_outreach", label: "Sales Outreach" },
        { value: "enterprise", label: "Enterprise" },
        { value: "follow_up", label: "Follow-Up" },
      ]

  const heading = isJobSeeker
    ? "Start from a job search template"
    : "Start from a sales template"
  const subtitle = isJobSeeker
    ? "Templates for recruiters, hiring managers & networking contacts"
    : "Cold outreach, meeting requests & follow-up sequences"
  const blankLabel = isJobSeeker
    ? "Blank Job Search Template"
    : "Blank Sales Template"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{heading}</h2>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <EmptyTemplateCard onSelect={onBlankCanvas} label={blankLabel} />

        {filteredPresets.map((preset) => (
          <TemplateCard
            key={preset.id}
            preset={preset}
            onPreview={() => setPreviewPreset(preset)}
            onUse={() => onSelectPreset(preset)}
          />
        ))}

        {filteredPresets.length === 0 && (
          <div className="border border-dashed rounded-xl p-6 text-center flex items-center justify-center sm:col-span-1 lg:col-span-2">
            <div>
              <p className="text-sm font-medium">No templates match your search</p>
              <p className="text-xs text-muted-foreground mt-1">
                Try a different category or search term
              </p>
            </div>
          </div>
        )}
      </div>

      {previewPreset && (
        <PreviewModal
          preset={previewPreset}
          isOpen={Boolean(previewPreset)}
          onClose={() => setPreviewPreset(null)}
          onUse={() => {
            onSelectPreset(previewPreset)
            setPreviewPreset(null)
          }}
        />
      )}
    </div>
  )
}
