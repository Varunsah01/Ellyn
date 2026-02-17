"use client"

import { useMemo, useState } from 'react'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { TemplateEditor } from '@/components/TemplateEditor'
import { TemplateLibrary } from '@/components/TemplateLibrary'
import { useToast } from '@/hooks/useToast'
import { EmailTemplate, useSequences } from '@/lib/hooks/useSequences'
import { TEMPLATE_PRESETS, type TemplateCategory } from '@/lib/template-presets'
import type { EditableTemplate, TemplateLibraryItem } from '@/lib/template-types'

const CATEGORY_ICON_MAP: Record<TemplateCategory, string> = {
  recruiter: '??',
  referral: '??',
  advice: '??',
  'follow-up': '??',
  networking: '??',
  'thank-you': '??',
  startup: '??',
  custom: '?',
}

const CATEGORY_KEYWORDS: Array<{ category: TemplateCategory; keywords: string[] }> = [
  { category: 'recruiter', keywords: ['recruiter', 'hiring', 'talent'] },
  { category: 'referral', keywords: ['referral', 'refer'] },
  { category: 'advice', keywords: ['advice', 'learn', 'informational'] },
  { category: 'follow-up', keywords: ['follow up', 'follow-up', 'following up'] },
  { category: 'networking', keywords: ['alumni', 'network', 'connect'] },
  { category: 'thank-you', keywords: ['thank you', 'thanks'] },
  { category: 'startup', keywords: ['startup', 'mission', 'founder'] },
]

const EMPTY_EDITOR_TEMPLATE: EditableTemplate = {
  name: '',
  subject: '',
  body: '',
  category: 'custom',
  tags: [],
  icon: '??',
}

export default function TemplatesPage() {
  const { templates, loading, refreshTemplates } = useSequences()
  const { toast } = useToast()

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editorTemplate, setEditorTemplate] = useState<EditableTemplate | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const mergedTemplates = useMemo<TemplateLibraryItem[]>(() => {
    const dbTemplates = templates.map(mapApiTemplate)

    const existingByName = new Set(dbTemplates.map((item) => normalizeKey(item.name)))

    const presetItems: TemplateLibraryItem[] = TEMPLATE_PRESETS.filter(
      (preset) => !existingByName.has(normalizeKey(preset.name))
    ).map((preset) => ({
      id: `preset:${preset.key}`,
      presetKey: preset.key,
      name: preset.name,
      subject: preset.subject,
      body: preset.body,
      category: preset.category,
      tags: preset.tags,
      icon: preset.icon,
      description: preset.description,
      useCount: preset.useCount,
      isDefault: true,
    }))

    return [...dbTemplates, ...presetItems]
  }, [templates])

  const handleCreateNew = () => {
    setEditorTemplate(EMPTY_EDITOR_TEMPLATE)
    setIsEditorOpen(true)
  }

  const handleEditTemplate = (template: TemplateLibraryItem) => {
    setEditorTemplate(mapLibraryToEditable(template))
    setIsEditorOpen(true)
  }

  const handleUseTemplate = (template: TemplateLibraryItem) => {
    const editable = mapLibraryToEditable({
      ...template,
      useCount: template.useCount + 1,
      lastUsedAt: new Date().toISOString(),
    })

    setEditorTemplate(editable)
    setIsEditorOpen(true)
  }

  const handleDuplicateTemplate = (template: TemplateLibraryItem) => {
    setEditorTemplate({
      ...mapLibraryToEditable(template),
      id: undefined,
      name: `${template.name} (Copy)`,
      isDefault: false,
    })
    setIsEditorOpen(true)
  }

  const handleDeleteTemplate = async (template: TemplateLibraryItem) => {
    if (template.id.startsWith('preset:') || template.isDefault) {
      toast({
        title: 'Preset template',
        description: 'Preset templates cannot be deleted. Duplicate and customize instead.',
      })
      return
    }

    const shouldDelete = window.confirm(`Delete "${template.name}"?`)
    if (!shouldDelete) {
      return
    }

    try {
      const response = await fetch(`/api/v1/templates/${template.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error(`Delete failed (${response.status})`)
      }

      toast({
        title: 'Template deleted',
        description: `${template.name} has been removed.`,
      })

      await refreshTemplates()
    } catch (error) {
      toast({
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Could not delete template.',
        variant: 'destructive',
      })
    }
  }

  const handleSaveTemplate = async (template: EditableTemplate) => {
    if (!template.name.trim() || !template.subject.trim() || !template.body.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Name, subject, and body are required.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)

    try {
      const isExistingTemplate = Boolean(template.id && !template.id.startsWith('preset:'))
      const method = isExistingTemplate ? 'PATCH' : 'POST'
      const url = isExistingTemplate ? `/api/v1/templates/${template.id}` : '/api/v1/templates'

      const payload = {
        name: template.name,
        subject: template.subject,
        body: template.body,
        category: template.category,
        tags: template.tags,
        icon: template.icon,
        use_count: template.useCount ?? 0,
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || `Save failed (${response.status})`)
      }

      toast({
        title: isExistingTemplate ? 'Template updated' : 'Template created',
        description: `${template.name} saved successfully.`,
      })

      setIsEditorOpen(false)
      setEditorTemplate(null)
      await refreshTemplates()
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Could not save template.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        <PageHeader
          title="Templates"
          description="AI-powered outreach templates for recruiter outreach, referrals, follow-ups, and networking."
        />

        <TemplateLibrary
          templates={mergedTemplates}
          loading={loading}
          onCreateNew={handleCreateNew}
          onEditTemplate={handleEditTemplate}
          onDuplicateTemplate={handleDuplicateTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onUseTemplate={handleUseTemplate}
        />
      </div>

      <TemplateEditor
        open={isEditorOpen}
        template={editorTemplate}
        isSaving={isSaving}
        onOpenChange={setIsEditorOpen}
        onSave={handleSaveTemplate}
      />
    </DashboardShell>
  )
}

function mapApiTemplate(template: EmailTemplate): TemplateLibraryItem {
  const category = inferCategory(template)
  const tags = normalizeTags(template.tags, category)

  return {
    id: template.id,
    name: template.name,
    subject: template.subject,
    body: template.body,
    isDefault: Boolean(template.is_default),
    category,
    tags,
    icon: template.icon?.trim() || CATEGORY_ICON_MAP[category],
    useCount: Number(template.use_count || 0),
    createdAt: template.created_at,
    updatedAt: template.updated_at || undefined,
    lastUsedAt: template.last_used_at || undefined,
    description: template.description || undefined,
  }
}

function mapLibraryToEditable(template: TemplateLibraryItem): EditableTemplate {
  return {
    id: template.id,
    presetKey: template.presetKey,
    name: template.name,
    subject: template.subject,
    body: template.body,
    category: template.category,
    tags: [...template.tags],
    icon: template.icon,
    isDefault: template.isDefault,
    useCount: template.useCount,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  }
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeTags(rawTags: unknown, category: TemplateCategory): string[] {
  if (Array.isArray(rawTags) && rawTags.length > 0) {
    const tags = rawTags
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)

    if (tags.length > 0) {
      return tags
    }
  }

  return [category]
}

function inferCategory(template: EmailTemplate): TemplateCategory {
  if (template.category) {
    const normalized = template.category.toLowerCase().replace('_', '-')
    const valid = [
      'recruiter',
      'referral',
      'advice',
      'follow-up',
      'networking',
      'thank-you',
      'startup',
      'custom',
    ]

    if (valid.includes(normalized)) {
      return normalized as TemplateCategory
    }
  }

  const haystack = `${template.name} ${template.subject}`.toLowerCase()

  for (const rule of CATEGORY_KEYWORDS) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
      return rule.category
    }
  }

  return template.is_default ? 'recruiter' : 'custom'
}

