"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { BookmarkPlus, Check, Loader2, XCircle } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/Button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/Popover"
import {
  extensionSaveTemplate,
  isExtensionInstalled,
  type SavedTemplate,
} from "@/lib/extension-bridge"
import { showToast } from "@/lib/toast"
import { cn } from "@/lib/utils"

const INSTALL_URL =
  process.env.NEXT_PUBLIC_EXTENSION_URL?.trim() || "/extension-auth"

export type ExtensionTemplateInput = {
  id?: string | null
  name: string
  subject: string
  body: string
  tone?: string | null
  category?: string | null
  use_case?: string | null
  variables?: string[] | null
}

type SaveResult = {
  success: boolean
  error?: string
  savedTemplateId: string | null
}

function normalizeTemplate(input: ExtensionTemplateInput): SavedTemplate {
  const fallbackId = `template_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)}`

  const dedupedVariables = Array.from(
    new Set(
      (input.variables ?? [])
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )

  return {
    id: String(input.id || "").trim() || fallbackId,
    name: input.name.trim(),
    subject: input.subject.trim(),
    body: input.body,
    tone: String(input.tone ?? "professional").trim() || "professional",
    category: String(input.category ?? "general").trim() || "general",
    use_case: String(input.use_case ?? "general").trim() || "general",
    variables: dedupedVariables,
    savedAt: new Date().toISOString(),
  }
}

function isMissingExtensionError(error?: string): boolean {
  const message = String(error || "").toLowerCase()
  if (!message) return false

  return (
    message.includes("not installed") ||
    message.includes("extension not found") ||
    message.includes("receiving end does not exist") ||
    message.includes("could not establish connection")
  )
}

export function useSaveToExtension() {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSavedId, setLastSavedId] = useState<string | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const saveTemplate = useCallback(
    async (input: ExtensionTemplateInput): Promise<SaveResult> => {
      const template = normalizeTemplate(input)

      setIsSaving(true)
      try {
        const result = await extensionSaveTemplate(template)

        if (result.success) {
          setLastSavedId(template.id)
          setLastError(null)
          return {
            success: true,
            savedTemplateId: template.id,
          }
        }

        setLastError(result.error || "Extension not installed")
        return {
          success: false,
          error: result.error || "Extension not installed",
          savedTemplateId: null,
        }
      } finally {
        setIsSaving(false)
      }
    },
    []
  )

  return { saveTemplate, isSaving, lastSavedId, lastError }
}

type SaveToExtensionButtonProps = Omit<ButtonProps, "onClick"> & {
  template: ExtensionTemplateInput
  onSaved?: (savedTemplateId: string | null) => void
  onError?: () => void
}

export function SaveToExtensionButton({
  template,
  onSaved,
  onError,
  className,
  children,
  ...buttonProps
}: SaveToExtensionButtonProps) {
  const { saveTemplate } = useSaveToExtension()
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  )
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [extensionAvailable, setExtensionAvailable] = useState<boolean>(() =>
    isExtensionInstalled()
  )
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanedTemplateId = useMemo(
    () => String(template.id || "").trim(),
    [template.id]
  )

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current)
        resetTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (extensionAvailable) return

    const interval = setInterval(() => {
      const installed = isExtensionInstalled()
      if (installed) {
        setExtensionAvailable(true)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [extensionAvailable])

  const handleSaveFailure = useCallback(
    (error?: string) => {
      setStatus("error")

      if (isMissingExtensionError(error)) {
        setExtensionAvailable(false)
        onError?.()
        return
      }

      if (error) {
        showToast.error(error)
      }

      onError?.()
    },
    [onError]
  )

  const handleClick = useCallback(async () => {
    setStatus("saving")
    const result = await saveTemplate(template)

    if (!result.success) {
      handleSaveFailure(result.error)
      return
    }

    setExtensionAvailable(true)
    setStatus("saved")
    onSaved?.(cleanedTemplateId || result.savedTemplateId)

    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current)
    }

    resetTimerRef.current = setTimeout(() => {
      setStatus("idle")
      resetTimerRef.current = null
    }, 2500)
  }, [cleanedTemplateId, handleSaveFailure, onSaved, saveTemplate, template])

  const icon = status === "saving" ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : status === "saved" ? (
    <Check className="h-4 w-4 text-emerald-600" />
  ) : status === "error" ? (
    <XCircle className="h-4 w-4 text-red-600" />
  ) : (
    <BookmarkPlus className="h-4 w-4" />
  )

  const label =
    status === "saving"
      ? "Saving..."
      : status === "saved"
      ? "Saved!"
      : status === "error"
      ? "Extension not found"
      : "Save to Extension"

  const button = (
    <Button
      type="button"
      variant="outline"
      onClick={() => void handleClick()}
      disabled={status === "saving"}
      className={cn(
        "transition-all duration-200",
        status === "error" && "border-red-200 text-red-700 hover:bg-red-50",
        className
      )}
      {...buttonProps}
    >
      {icon}
      {children ?? label}
    </Button>
  )

  if (extensionAvailable) {
    return button
  }

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <span
          className="inline-flex"
          onMouseEnter={() => setPopoverOpen(true)}
          onMouseLeave={() => setPopoverOpen(false)}
        >
          {button}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-64 p-3"
        onMouseEnter={() => setPopoverOpen(true)}
        onMouseLeave={() => setPopoverOpen(false)}
      >
        <p className="text-xs font-semibold text-slate-800">
          Extension not installed
        </p>
        <p className="mt-1 text-xs text-slate-600">
          Install the Ellyn Chrome extension to use templates directly on
          LinkedIn.
        </p>
        <a
          href={INSTALL_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex text-xs font-medium text-violet-700 underline underline-offset-2 hover:text-violet-800"
        >
          Install Extension
        </a>
      </PopoverContent>
    </Popover>
  )
}
