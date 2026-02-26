"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import {
  Check,
  Copy,
  Download,
  Edit,
  Loader2,
  Trash2,
  Zap,
} from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card"
import { showToast } from "@/lib/toast"
import { cn } from "@/lib/utils"

export type TemplateItem = {
  id: string
  name: string
  subject: string
  body: string
  use_case?: string
  category?: string
  is_system?: boolean
  is_default?: boolean
  variables?: string[]
  tags?: string[]
  usage_count?: number
  tone?: string
}

interface TemplateCardProps {
  template: TemplateItem
  onUse: (t: TemplateItem) => void
  onEdit: (t: TemplateItem) => void
  onDuplicate: (t: TemplateItem) => void
  onDelete: (t: TemplateItem) => void
  onSaveToExtension: (t: TemplateItem) => Promise<boolean>
}

function formatUseCase(raw?: string) {
  if (!raw) return null
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function TemplateCard({
  template,
  onUse,
  onEdit,
  onDuplicate,
  onDelete,
  onSaveToExtension,
}: TemplateCardProps) {
  const isSystem = Boolean(template.is_system || template.is_default)
  const isAiEnhanced = Array.isArray(template.tags)
    ? template.tags.some((tag) => {
        const normalized = String(tag || "").trim().toLowerCase()
        return normalized === "ai_enhanced=true" || normalized === "ai_enhanced"
      })
    : false
  const [isSavingToExtension, setIsSavingToExtension] = useState(false)
  const [showSavedCheck, setShowSavedCheck] = useState(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current)
        savedTimerRef.current = null
      }
    }
  }, [])

  const handleSaveToExtension = async () => {
    setIsSavingToExtension(true)
    try {
      const ok = await onSaveToExtension(template)
      if (!ok) {
        showToast.error("Install the Ellyn extension to use this feature")
        return
      }

      setShowSavedCheck(true)
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current)
      }
      savedTimerRef.current = setTimeout(() => {
        setShowSavedCheck(false)
        savedTimerRef.current = null
      }, 2000)
    } finally {
      setIsSavingToExtension(false)
    }
  }

  const preview =
    template.body.length > 80
      ? template.body.slice(0, 80).trimEnd() + "..."
      : template.body

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: "0 8px 30px rgba(0,0,0,0.10)" }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="rounded-xl"
    >
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold leading-snug text-[#2D2B55]">
              {template.name}
            </CardTitle>
            {isSystem && (
              <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                Ellyn
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {template.use_case && (
              <Badge variant="secondary" className="w-fit text-[10px]">
                {formatUseCase(template.use_case)}
              </Badge>
            )}
            {isAiEnhanced && (
              <Badge className="w-fit bg-emerald-100 text-[10px] text-emerald-700 hover:bg-emerald-100">
                AI-Powered
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-3">
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {preview}
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-2 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {template.usage_count
                ? `Used ${template.usage_count} time${template.usage_count === 1 ? "" : "s"}`
                : "Not used yet"}
            </span>
            <Button
              size="sm"
              className={cn("h-7 px-2 text-xs")}
              style={{ backgroundColor: "#7C3AED", color: "#fff" }}
              onClick={() => onUse(template)}
            >
              <Zap className="mr-1 h-3 w-3" />
              Use
            </Button>
          </div>

          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onDuplicate(template)}
              title={isSystem ? "Duplicate to My Templates" : "Duplicate"}
              aria-label="Duplicate"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            {isSystem ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => onEdit(template)}
                title="Copy & Edit"
                aria-label="Copy and Edit"
              >
                Copy & Edit
              </Button>
            ) : (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onEdit(template)}
                title="Edit Template"
                aria-label="Edit"
              >
                <Edit className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => void handleSaveToExtension()}
              title="Save to Extension"
              aria-label="Save to Extension"
              disabled={isSavingToExtension}
            >
              {isSavingToExtension ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : showSavedCheck ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(template)}
              title="Delete"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
