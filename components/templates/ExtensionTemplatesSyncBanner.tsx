"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { cn } from "@/lib/utils"
import {
  extensionDeleteTemplate,
  extensionSendMessage,
  isExtensionInstalled,
  type SavedTemplate,
} from "@/lib/extension-bridge"
import { showToast } from "@/lib/toast"

const DISMISS_KEY = "ellyn_ext_banner_dismissed"
const INSTALL_URL =
  process.env.NEXT_PUBLIC_EXTENSION_URL?.trim() || "/extension-auth"

function normalizeTemplate(input: unknown): SavedTemplate | null {
  if (!input || typeof input !== "object") return null

  const raw = input as Record<string, unknown>
  const id = String(raw.id || "").trim()
  const name = String(raw.name || "").trim()
  const subject = String(raw.subject || "").trim()
  const body = String(raw.body || "").trim()

  if (!id || !name || !subject || !body) return null

  const variables = Array.isArray(raw.variables)
    ? raw.variables
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    : []

  return {
    id,
    name,
    subject,
    body,
    tone: String(raw.tone || "professional").trim() || "professional",
    category: String(raw.category || "general").trim() || "general",
    use_case: String(raw.use_case || "general").trim() || "general",
    variables,
    savedAt:
      String(raw.savedAt || "").trim() || new Date().toISOString(),
  }
}

function readDismissedState(): boolean {
  if (typeof window === "undefined") return false

  try {
    return localStorage.getItem(DISMISS_KEY) === "1"
  } catch {
    return false
  }
}

function writeDismissedState(value: boolean) {
  if (typeof window === "undefined") return

  try {
    if (value) {
      localStorage.setItem(DISMISS_KEY, "1")
      return
    }
    localStorage.removeItem(DISMISS_KEY)
  } catch {
    // Ignore localStorage errors in restricted contexts.
  }
}

export function ExtensionTemplatesSyncBanner({ className }: { className?: string }) {
  const [isInstalled, setIsInstalled] = useState<boolean>(() =>
    isExtensionInstalled()
  )
  const [dismissed, setDismissed] = useState<boolean>(false)
  const [checking, setChecking] = useState(true)
  const [templates, setTemplates] = useState<SavedTemplate[]>([])
  const [manageOpen, setManageOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const templateCount = templates.length

  const loadFromExtension = useCallback(async () => {
    setChecking(true)
    try {
      const response = await extensionSendMessage("ELLYN_GET_TEMPLATES")
      if (!response.success) {
        setIsInstalled(false)
        setTemplates([])
        return
      }

      const rows = Array.isArray(response.templates)
        ? response.templates
            .map((item) => normalizeTemplate(item))
            .filter((item): item is SavedTemplate => Boolean(item))
        : []

      setIsInstalled(true)
      setTemplates(rows)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    setDismissed(readDismissedState())
    void loadFromExtension()
  }, [loadFromExtension])

  useEffect(() => {
    const onTemplatesUpdated = () => {
      void loadFromExtension()
    }

    window.addEventListener(
      "ellyn-extension-templates-updated",
      onTemplatesUpdated
    )
    return () => {
      window.removeEventListener(
        "ellyn-extension-templates-updated",
        onTemplatesUpdated
      )
    }
  }, [loadFromExtension])

  const handleDismiss = () => {
    setDismissed(true)
    writeDismissedState(true)
  }

  const handleManageOpenChange = (open: boolean) => {
    setManageOpen(open)
    if (open) {
      void loadFromExtension()
    }
  }

  const handleDelete = async (templateId: string) => {
    setDeletingId(templateId)
    try {
      const result = await extensionDeleteTemplate(templateId)
      if (!result.success) {
        throw new Error(result.error || "Failed to delete template")
      }

      showToast.success("Template removed from extension")
      await loadFromExtension()
    } catch (error) {
      showToast.error(
        error instanceof Error ? error.message : "Failed to delete template"
      )
    } finally {
      setDeletingId(null)
    }
  }

  const sortedTemplates = useMemo(
    () =>
      [...templates].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
      ),
    [templates]
  )

  if (checking && !isInstalled) {
    return null
  }

  if (!isInstalled) {
    if (dismissed) return null

    return (
      <div
        className={cn(
          "mb-4 flex flex-col gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
          className
        )}
      >
        <p className="text-sky-900">
          📥 Install the Ellyn Chrome Extension to use templates directly on
          LinkedIn →
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
            <a href={INSTALL_URL} target="_blank" rel="noreferrer">
              Install Extension
            </a>
          </Button>
          <Button size="sm" variant="outline" onClick={handleDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          "mb-4 flex flex-col gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
          className
        )}
      >
        <p className="text-emerald-900">
          🔌 Extension connected — {templateCount} template
          {templateCount === 1 ? "" : "s"} saved to your extension
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleManageOpenChange(true)}
        >
          Manage
        </Button>
      </div>

      <Dialog open={manageOpen} onOpenChange={handleManageOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Saved in Extension</DialogTitle>
            <DialogDescription>
              Templates currently available in your Chrome extension draft view.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
            {sortedTemplates.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-slate-600">
                No templates saved in extension yet.
              </div>
            ) : (
              sortedTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {template.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {template.category} · {template.tone}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1 text-red-700 hover:bg-red-50 hover:text-red-700"
                    onClick={() => void handleDelete(template.id)}
                    disabled={deletingId === template.id}
                  >
                    {deletingId === template.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Delete
                  </Button>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
