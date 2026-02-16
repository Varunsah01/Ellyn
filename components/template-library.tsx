"use client"

import { useMemo, useState } from 'react'
import { Filter, Plus, Search } from 'lucide-react'

import { TemplateCard } from '@/components/template-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TEMPLATE_CATEGORIES } from '@/lib/template-presets'
import type { TemplateLibraryItem } from '@/lib/template-types'

interface TemplateLibraryProps {
  templates: TemplateLibraryItem[]
  loading: boolean
  onCreateNew: () => void
  onEditTemplate: (template: TemplateLibraryItem) => void
  onDuplicateTemplate: (template: TemplateLibraryItem) => void
  onDeleteTemplate: (template: TemplateLibraryItem) => void
  onUseTemplate: (template: TemplateLibraryItem) => void
}

type SortOption = 'most-used' | 'recently-used' | 'alphabetical'

export function TemplateLibrary({
  templates,
  loading,
  onCreateNew,
  onEditTemplate,
  onDuplicateTemplate,
  onDeleteTemplate,
  onUseTemplate,
}: TemplateLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('most-used')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    const bySearch = templates.filter((template) => {
      if (!normalizedQuery) return true

      const haystack = [
        template.name,
        template.subject,
        template.body,
        template.category,
        template.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })

    const byCategory =
      categoryFilter === 'all'
        ? bySearch
        : bySearch.filter((template) => template.category === categoryFilter)

    const sorted = [...byCategory]

    if (sortOption === 'alphabetical') {
      sorted.sort((a, b) => a.name.localeCompare(b.name))
      return sorted
    }

    if (sortOption === 'recently-used') {
      sorted.sort((a, b) => toTimestamp(b.lastUsedAt || b.updatedAt || b.createdAt) - toTimestamp(a.lastUsedAt || a.updatedAt || a.createdAt))
      return sorted
    }

    sorted.sort((a, b) => b.useCount - a.useCount)
    return sorted
  }, [templates, searchQuery, categoryFilter, sortOption])

  const presetTemplates = filtered.filter((template) => template.isDefault)
  const customTemplates = filtered.filter((template) => !template.isDefault)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search templates, tags, or content"
            className="pl-9"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={sortOption} onValueChange={(value) => setSortOption(value as SortOption)}>
            <SelectTrigger className="min-w-[170px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="most-used">Most used</SelectItem>
              <SelectItem value="recently-used">Recently used</SelectItem>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="min-w-[170px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {TEMPLATE_CATEGORIES.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={onCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <p className="text-lg font-semibold text-slate-900">Create your first template</p>
          <p className="mt-1 text-sm text-slate-500">
            Build outreach templates for referrals, networking, and follow-ups in under two minutes.
          </p>
          <Button className="mt-4" onClick={onCreateNew}>
            <Plus className="mr-2 h-4 w-4" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Preset Templates</h2>
              <p className="text-sm text-slate-500">Curated templates for the most common outreach scenarios.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {presetTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={onEditTemplate}
                  onDuplicate={onDuplicateTemplate}
                  onDelete={onDeleteTemplate}
                  onUseNow={onUseTemplate}
                />
              ))}
            </div>
            {presetTemplates.length === 0 ? <p className="text-sm text-slate-500">No preset templates match your filters.</p> : null}
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Custom Templates</h2>
              <p className="text-sm text-slate-500">Your personal templates for specific outreach workflows.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {customTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onEdit={onEditTemplate}
                  onDuplicate={onDuplicateTemplate}
                  onDelete={onDeleteTemplate}
                  onUseNow={onUseTemplate}
                />
              ))}
            </div>
            {customTemplates.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                No custom templates yet. Create one to save your own outreach style.
              </div>
            ) : null}
          </section>
        </div>
      )}
    </div>
  )
}

function toTimestamp(value: string | undefined): number {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}
