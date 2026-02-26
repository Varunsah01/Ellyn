"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Textarea } from "@/components/ui/Textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { STAGE_ORDER, STAGE_CONFIG, type Deal, type DealStage } from "./types"

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "SGD"] as const

interface ContactOption {
  id: string
  name: string
  company: string | null
}

interface DealFormDialogProps {
  deal?: Deal | null
  open: boolean
  contacts: ContactOption[]
  onClose: () => void
  onSave: (data: DealFormData) => Promise<void>
}

export interface DealFormData {
  title: string
  company: string
  value: number | null
  currency: string
  stage: DealStage
  probability: number
  expected_close: string | null
  notes: string
  tags: string[]
  contact_id: string | null
}

export function DealFormDialog({
  deal,
  open,
  contacts,
  onClose,
  onSave,
}: DealFormDialogProps) {
  const [form, setForm] = useState<DealFormData>({
    title: "",
    company: "",
    value: null,
    currency: "USD",
    stage: "prospecting",
    probability: 50,
    expected_close: null,
    notes: "",
    tags: [],
    contact_id: null,
  })
  const [tagInput, setTagInput] = useState("")
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    if (deal) {
      setForm({
        title: deal.title,
        company: deal.company,
        value: deal.value,
        currency: deal.currency,
        stage: deal.stage,
        probability: deal.probability,
        expected_close: deal.expected_close,
        notes: deal.notes ?? "",
        tags: deal.tags ?? [],
        contact_id: deal.contact_id,
      })
    } else {
      setForm({
        title: "",
        company: "",
        value: null,
        currency: "USD",
        stage: "prospecting",
        probability: 50,
        expected_close: null,
        notes: "",
        tags: [],
        contact_id: null,
      })
    }
    setErrors({})
    setTagInput("")
  }, [open, deal])

  const handleContactChange = (id: string) => {
    const contact = contacts.find((c) => c.id === id)
    setForm((f) => ({
      ...f,
      contact_id: id === "none" ? null : id,
      company:
        id !== "none" && contact?.company ? contact.company : f.company,
    }))
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (!tag || form.tags.includes(tag)) return
    setForm((f) => ({ ...f, tags: [...f.tags, tag] }))
    setTagInput("")
  }

  const removeTag = (tag: string) => {
    setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))
  }

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = "Title is required"
    if (!form.company.trim()) e.company = "Company is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deal ? "Edit Deal" : "New Deal"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="deal-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="deal-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Enterprise CRM Licence"
              className={cn(errors.title && "border-destructive")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Company */}
          <div className="space-y-1.5">
            <Label htmlFor="deal-company">
              Company <span className="text-destructive">*</span>
            </Label>
            <Input
              id="deal-company"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              placeholder="Acme Corp"
              className={cn(errors.company && "border-destructive")}
            />
            {errors.company && (
              <p className="text-xs text-destructive">{errors.company}</p>
            )}
          </div>

          {/* Link to Contact */}
          <div className="space-y-1.5">
            <Label>Link to Contact</Label>
            <Select
              value={form.contact_id ?? "none"}
              onValueChange={handleContactChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contact (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.company ? ` · ${c.company}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value + Currency */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="deal-value">Deal Value</Label>
              <Input
                id="deal-value"
                type="number"
                min="0"
                value={form.value ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    value: e.target.value === "" ? null : parseFloat(e.target.value),
                  }))
                }
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Stage */}
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select
              value={form.stage}
              onValueChange={(v) => setForm((f) => ({ ...f, stage: v as DealStage }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Probability */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Probability</Label>
              <span className="text-sm font-semibold tabular-nums">
                {form.probability}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={form.probability}
              onChange={(e) =>
                setForm((f) => ({ ...f, probability: parseInt(e.target.value) }))
              }
              className="w-full h-2 rounded-full appearance-none bg-muted cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Expected close date */}
          <div className="space-y-1.5">
            <Label htmlFor="deal-close">Expected Close Date</Label>
            <Input
              id="deal-close"
              type="date"
              value={form.expected_close ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  expected_close: e.target.value || null,
                }))
              }
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="deal-notes">Notes</Label>
            <Textarea
              id="deal-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Any notes about this deal..."
              className="min-h-[80px] resize-none text-sm"
            />
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); addTag() }
                }}
                placeholder="Add tag + Enter"
                className="text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={addTag}>
                Add
              </Button>
            </div>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Saving…" : deal ? "Save Changes" : "Create Deal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
