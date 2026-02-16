import type { TemplateCategory } from '@/lib/template-presets'

export interface TemplateLibraryItem {
  id: string
  name: string
  subject: string
  body: string
  isDefault: boolean
  category: TemplateCategory
  tags: string[]
  icon: string
  useCount: number
  description?: string
  createdAt?: string
  updatedAt?: string
  lastUsedAt?: string
  presetKey?: string
}

export interface EditableTemplate {
  id?: string
  name: string
  subject: string
  body: string
  category: TemplateCategory
  tags: string[]
  icon: string
  isDefault?: boolean
  useCount?: number
  createdAt?: string
  updatedAt?: string
  presetKey?: string
}
