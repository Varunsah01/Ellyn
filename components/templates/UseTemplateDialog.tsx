"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Copy, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { showToast } from "@/lib/toast"
import {
  extractVariables,
  fillVariables,
  PREDEFINED_VARIABLES,
} from "@/lib/template-variables"
import type { TemplateItem } from "@/components/templates/TemplateCard"

// Splits text into segments for rendering with variable highlights
type Segment =
  | { type: "text"; value: string }
  | { type: "filled"; value: string }
  | { type: "unfilled"; value: string }

function segmentText(text: string, vars: Record<string, string>): Segment[] {
  const segments: Segment[] = []
  const re = /\{\{([^}]+)\}\}/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, m.index) })
    }
    const varName = (m[1] ?? "").trim()
    const filled = vars[varName]
    if (filled) {
      segments.push({ type: "filled", value: filled })
    } else {
      segments.push({ type: "unfilled", value: m[0] })
    }
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) })
  }
  return segments
}

interface UseTemplateDialogProps {
  open: boolean
  template: TemplateItem | null
  onOpenChange: (open: boolean) => void
}

export function UseTemplateDialog({
  open,
  template,
  onOpenChange,
}: UseTemplateDialogProps) {
  const [vars, setVars] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState(false)

  const detectedVars = useMemo(
    () =>
      template
        ? extractVariables(`${template.subject} ${template.body}`)
        : [],
    [template]
  )

  // Reset when template changes
  useEffect(() => {
    setVars({})
    setCopied(false)
  }, [template])

  const filledSubject = template
    ? fillVariables(template.subject, vars)
    : ""
  const filledBody = template ? fillVariables(template.body, vars) : ""

  const subjectSegments = template
    ? segmentText(template.subject, vars)
    : []
  const bodySegments = template ? segmentText(template.body, vars) : []

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(filledBody)
      setCopied(true)
      showToast.success("Body copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast.error("Could not copy to clipboard")
    }
  }

  const handleGmail = () => {
    const url = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(
      filledSubject
    )}&body=${encodeURIComponent(filledBody)}`
    window.open(url, "_blank", "noopener,noreferrer")
  }

  if (!template) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-[#2D2B55]">
            Use: {template.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Variable inputs — left panel */}
          {detectedVars.length > 0 && (
            <div className="w-52 flex-shrink-0 space-y-3 overflow-y-auto pr-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Fill Variables
              </p>
              {detectedVars.map((varName) => {
                const predefined = PREDEFINED_VARIABLES[varName]
                return (
                  <div key={varName} className="space-y-1">
                    <Label className="text-xs">
                      {predefined?.label ??
                        varName.replace(/_/g, " ")}
                    </Label>
                    <Input
                      value={vars[varName] ?? ""}
                      onChange={(e) =>
                        setVars((prev) => ({
                          ...prev,
                          [varName]: e.target.value,
                        }))
                      }
                      placeholder={`{{${varName}}}`}
                      className="h-7 text-xs"
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Preview — right panel */}
          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto">
            {/* Subject */}
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Subject
              </p>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {subjectSegments.map((seg, i) =>
                  seg.type === "unfilled" ? (
                    <mark
                      key={i}
                      className="rounded bg-amber-100 px-0.5 text-amber-800"
                    >
                      {seg.value}
                    </mark>
                  ) : (
                    <span key={i}>{seg.value}</span>
                  )
                )}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Body
              </p>
              <div className="min-h-[200px] whitespace-pre-wrap rounded-md border bg-muted/30 px-3 py-2 text-sm leading-relaxed">
                {bodySegments.map((seg, i) =>
                  seg.type === "unfilled" ? (
                    <mark
                      key={i}
                      className="rounded bg-amber-100 px-0.5 text-amber-800"
                    >
                      {seg.value}
                    </mark>
                  ) : (
                    <span key={i}>{seg.value}</span>
                  )
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => void handleCopy()}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            {copied ? "Copied!" : "Copy Body"}
          </Button>
          <Button
            className="gap-1.5"
            style={{ backgroundColor: "#7C3AED", color: "#fff" }}
            onClick={handleGmail}
          >
            <ExternalLink className="h-4 w-4" />
            Open in Gmail
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
