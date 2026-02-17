"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Sparkles, Wand2 } from 'lucide-react'

import { AIAssistantPanel } from '@/components/AiAssistantPanel'
import { TemplatePreview } from '@/components/TemplatePreview'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/Sheet'
import { Textarea } from '@/components/ui/Textarea'
import { useResponsive } from '@/hooks/useResponsive'
import { TEMPLATE_CATEGORIES, TEMPLATE_ICONS } from '@/lib/template-presets'
import type { EditableTemplate } from '@/lib/template-types'

interface TemplateEditorProps {
  open: boolean
  template: EditableTemplate | null
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (template: EditableTemplate) => Promise<void>
}

const VARIABLE_OPTIONS = [
  'firstName',
  'lastName',
  'fullName',
  'company',
  'role',
  'linkedinUrl',
  'userFirstName',
  'userLastName',
  'userName',
  'userSchool',
  'userMajor',
]

const EMPTY_TEMPLATE: EditableTemplate = {
  name: '',
  subject: '',
  body: '',
  category: 'custom',
  tags: [],
  icon: '📝',
}

/**
 * Render the TemplateEditor component.
 * @param {TemplateEditorProps} props - Component props.
 * @returns {unknown} JSX output for TemplateEditor.
 * @example
 * <TemplateEditor />
 */
export function TemplateEditor({ open, template, isSaving, onOpenChange, onSave }: TemplateEditorProps) {
  const { isMobile } = useResponsive()
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [draft, setDraft] = useState<EditableTemplate>(EMPTY_TEMPLATE)
  const [showVariableSuggestions, setShowVariableSuggestions] = useState(false)
  const [tagText, setTagText] = useState('')

  useEffect(() => {
    if (template) {
      setDraft({
        ...template,
        tags: template.tags || [],
      })
      setTagText((template.tags || []).join(', '))
      return
    }

    setDraft(EMPTY_TEMPLATE)
    setTagText('')
  }, [template, open])

  const wordCount = useMemo(() => {
    const value = draft.body.trim()
    if (!value) return 0
    return value.split(/\s+/).length
  }, [draft.body])

  const characterCount = draft.body.length

  const updateDraft = <K extends keyof EditableTemplate>(key: K, value: EditableTemplate[K]) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const insertVariableIntoBody = (variable: string) => {
    const textArea = textareaRef.current
    if (!textArea) {
      updateDraft('body', `${draft.body} {{${variable}}}`.trim())
      setShowVariableSuggestions(false)
      return
    }

    const start = textArea.selectionStart
    const end = textArea.selectionEnd
    const before = draft.body.slice(0, start)
    const after = draft.body.slice(end)

    const replacement = before.endsWith('{{') ? `${variable}}}` : `{{${variable}}}`
    const nextBody = `${before}${replacement}${after}`

    updateDraft('body', nextBody)
    setShowVariableSuggestions(false)

    const cursor = before.length + replacement.length
    window.requestAnimationFrame(() => {
      textArea.focus()
      textArea.setSelectionRange(cursor, cursor)
    })
  }

  const handleBodyKeyUp = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget
    const cursor = target.selectionStart
    const prefix = target.value.slice(0, cursor)

    setShowVariableSuggestions(prefix.endsWith('{{'))
  }

  const handleSave = async () => {
    await onSave({
      ...draft,
      tags: parseTags(tagText),
    })
  }

  const aiPanel = (
    <AIAssistantPanel
      body={draft.body}
      subject={draft.subject}
      templateType={draft.category}
      targetCompany="{{company}}"
      targetRole="{{role}}"
      userName='{{userName}}'
      userSchool='{{userSchool}}'
      onApplyBody={(body) => updateDraft('body', body)}
      onApplyTemplate={(generated) => {
        updateDraft('subject', generated.subject)
        updateDraft('body', generated.body)
        if (!draft.name.trim()) {
          updateDraft('name', 'AI Generated Template')
          updateDraft('icon', '✨')
        }
      }}
    />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{draft.id ? `Edit Template: ${draft.name}` : 'Create New Template'}</span>
            {isMobile ? (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Bot className="mr-2 h-4 w-4" />
                    AI Assistant
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-600" />
                      AI Assistant
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">{aiPanel}</div>
                </SheetContent>
              </Sheet>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Build reusable outreach templates with AI-assisted editing and live preview.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">Template Settings</h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="template-name">Name</Label>
                  <Input
                    id="template-name"
                    value={draft.name}
                    placeholder="To Recruiter"
                    onChange={(event) => updateDraft('name', event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-category">Category</Label>
                  <Select value={draft.category} onValueChange={(value) => updateDraft('category', value as EditableTemplate['category'])}>
                    <SelectTrigger id="template-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TEMPLATE_CATEGORIES.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="template-tags">Tags</Label>
                  <Input
                    id="template-tags"
                    value={tagText}
                    placeholder="recruiter, cold outreach"
                    onChange={(event) => setTagText(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label>Icon</Label>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATE_ICONS.map((icon) => (
                      <Button
                        key={icon}
                        type="button"
                        variant={draft.icon === icon ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => updateDraft('icon', icon)}
                        aria-label={`Use icon ${icon}`}
                      >
                        <span className="text-lg">{icon}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="space-y-1.5">
                <Label htmlFor="template-subject">Subject</Label>
                <Input
                  id="template-subject"
                  value={draft.subject}
                  placeholder="Interested in {{role}} opportunities at {{company}}"
                  onChange={(event) => updateDraft('subject', event.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="template-body">Body</Label>
                <div className="relative">
                  <Textarea
                    id="template-body"
                    ref={textareaRef}
                    value={draft.body}
                    className="min-h-[280px] font-mono text-sm"
                    onChange={(event) => updateDraft('body', event.target.value)}
                    onKeyUp={handleBodyKeyUp}
                    placeholder={`Hi {{firstName}},\n\nI noticed you are a {{role}} at {{company}}...`}
                  />
                  {showVariableSuggestions ? (
                    <div className="absolute bottom-3 left-3 right-3 z-30 rounded-md border border-slate-200 bg-white shadow-md">
                      <p className="border-b px-3 py-2 text-xs text-slate-500">Insert variable</p>
                      <div className="grid max-h-32 grid-cols-2 gap-1 overflow-auto p-2">
                        {VARIABLE_OPTIONS.map((variable) => (
                          <Button
                            key={variable}
                            type="button"
                            variant="ghost"
                            className="h-8 justify-start text-xs"
                            onClick={() => insertVariableIntoBody(variable)}
                          >
                            {`{{${variable}}}`}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{characterCount} characters</span>
                  <span>{wordCount} words</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-600">Variables</p>
                <div className="flex flex-wrap gap-2">
                  {VARIABLE_OPTIONS.map((variable) => (
                    <Badge
                      key={variable}
                      variant="outline"
                      className="cursor-pointer text-xs"
                      onClick={() => insertVariableIntoBody(variable)}
                    >
                      {`{{${variable}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <TemplatePreview subject={draft.subject} body={draft.body} />
          </div>

          {!isMobile ? <div>{aiPanel}</div> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !draft.name.trim() || !draft.subject.trim() || !draft.body.trim()}>
            {isSaving ? (
              <>
                <Wand2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Template'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function parseTags(raw: string): string[] {
  if (!raw.trim()) return []

  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}
