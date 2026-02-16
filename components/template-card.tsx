"use client"

import { Copy, Edit2, Play, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { TemplateLibraryItem } from '@/lib/template-types'

interface TemplateCardProps {
  template: TemplateLibraryItem
  onEdit: (template: TemplateLibraryItem) => void
  onDuplicate: (template: TemplateLibraryItem) => void
  onDelete: (template: TemplateLibraryItem) => void
  onUseNow: (template: TemplateLibraryItem) => void
}

export function TemplateCard({ template, onEdit, onDuplicate, onDelete, onUseNow }: TemplateCardProps) {
  return (
    <Card className="group relative h-full border-slate-200 bg-white transition-transform duration-200 hover:-translate-y-0.5 hover:border-blue-300">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-2xl">
              {template.icon}
            </span>
            <div>
              <h3 className="line-clamp-1 text-base font-semibold text-slate-900">{template.name}</h3>
              <p className="text-xs text-slate-500">{template.category}</p>
            </div>
          </div>
          <Badge variant={template.isDefault ? 'secondary' : 'outline'}>
            Used: {template.useCount}
          </Badge>
        </div>

        <p className="line-clamp-2 text-sm text-slate-600">{template.description || template.subject}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
          <p className="line-clamp-1 text-xs font-medium text-slate-600">Subject</p>
          <p className="line-clamp-1 text-sm text-slate-900">{template.subject}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {template.tags.slice(0, 3).map((tag) => (
            <Badge key={`${template.id}-${tag}`} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {template.tags.length > 3 && <Badge variant="outline">+{template.tags.length - 3}</Badge>}
        </div>

        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <Button variant="outline" size="icon" onClick={() => onDuplicate(template)} aria-label="Duplicate template">
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onEdit(template)} aria-label="Edit template">
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDelete(template)}
            className="text-red-500 hover:text-red-600"
            aria-label="Delete template"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button className="ml-auto" size="sm" onClick={() => onUseNow(template)}>
            <Play className="mr-1.5 h-3.5 w-3.5" />
            Use Now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
