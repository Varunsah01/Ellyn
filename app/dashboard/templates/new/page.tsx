"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { EmailTemplateEditor } from "@/components/templates/EmailTemplateEditor"
import { EmailTemplateGallery } from "@/components/templates/EmailTemplateGallery"
import { Button } from "@/components/ui/Button"
import { type EmailTemplatePreset } from "@/lib/email-template-presets"
import { showToast } from "@/lib/toast"

type PageState =
  | { view: "gallery" }
  | {
      view: "editor"
      initialName: string
      initialSubject: string
      initialBody: string
      initialCategory: string
      initialTone: string
      initialVariables: string[]
    }

function toEditorStateFromPreset(preset: EmailTemplatePreset): Extract<PageState, { view: "editor" }> {
  return {
    view: "editor",
    initialName: preset.name,
    initialSubject: preset.subject,
    initialBody: preset.body,
    initialCategory: preset.category,
    initialTone: preset.tone,
    initialVariables: preset.variables,
  }
}

function blankEditorState(): Extract<PageState, { view: "editor" }> {
  return {
    view: "editor",
    initialName: "",
    initialSubject: "",
    initialBody: "",
    initialCategory: "",
    initialTone: "",
    initialVariables: [],
  }
}

export default function NewTemplatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initializedFromModeRef = useRef(false)

  const [state, setState] = useState<PageState>({ view: "gallery" })

  useEffect(() => {
    if (initializedFromModeRef.current) return
    initializedFromModeRef.current = true

    if (searchParams.get("mode") === "blank") {
      setState(blankEditorState())
    }
  }, [searchParams])

  const handleSelectPreset = (preset: EmailTemplatePreset) => {
    setState(toEditorStateFromPreset(preset))
    showToast.success("Template loaded - customize and save")
  }

  const handleBlankCanvas = () => {
    setState(blankEditorState())
  }

  const handleBack = () => {
    setState({ view: "gallery" })
  }

  const handleSaved = (_templateId: string) => {
    router.push("/dashboard/templates")
    window.setTimeout(() => {
      router.refresh()
    }, 0)
  }

  if (state.view === "editor") {
    return (
      <DashboardShell>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
              {"\u2190 Back to templates"}
            </Button>
          </div>
          <PageHeader
            title="Create Template"
            description="Build and save a reusable email template."
          />
          <EmailTemplateEditor
            initialName={state.initialName}
            initialSubject={state.initialSubject}
            initialBody={state.initialBody}
            initialCategory={state.initialCategory}
            initialTone={state.initialTone}
            initialVariables={state.initialVariables}
            onSaved={handleSaved}
            onCancel={handleBack}
          />
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="New Template"
          description="Choose a template to get started, or write your own."
        />
        <EmailTemplateGallery
          onSelectPreset={handleSelectPreset}
          onBlankCanvas={handleBlankCanvas}
        />
      </div>
    </DashboardShell>
  )
}
