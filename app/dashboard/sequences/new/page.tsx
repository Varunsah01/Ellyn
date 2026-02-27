"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { SequenceTemplateGallery } from "@/components/sequences/SequenceTemplateGallery"
import { SequenceBuilder } from "@/components/SequenceBuilder"
import { Button } from "@/components/ui/Button"
import { ArrowLeft } from "lucide-react"
import { SequenceStep } from "@/lib/types/sequence"
import { showToast } from "@/lib/toast"
import { usePersona } from "@/context/PersonaContext"

type PageState =
  | { view: "gallery" }
  | { view: "builder"; initialName: string; initialSteps: SequenceStep[] }

export default function NewSequencePage() {
  const router = useRouter()
  const { isJobSeeker } = usePersona()
  const [state, setState] = useState<PageState>({ view: "gallery" })

  const galleryTitle = isJobSeeker
    ? "New Job Search Sequence"
    : "New Sales Sequence"

  const galleryDescription = isJobSeeker
    ? "Choose a job search template or build from scratch."
    : "Choose a sales template or build from scratch."

  const handleSelectTemplate = (name: string, steps: SequenceStep[]) => {
    setState({ view: "builder", initialName: name, initialSteps: steps })
    showToast.success("Template loaded — customize and save")
  }

  const handleBlankCanvas = () => {
    setState({ view: "builder", initialName: "", initialSteps: [] })
  }

  const handleBack = () => {
    setState({ view: "gallery" })
  }

  if (state.view === "builder") {
    return (
      <DashboardShell>
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to templates
            </Button>
          </div>
          <PageHeader
            title="Create Sequence"
            description="Build a multi-step outreach sequence with follow-ups."
          />
          <SequenceBuilder
            initialName={state.initialName}
            initialSteps={state.initialSteps}
            onSaved={(sequenceId) =>
              router.push(`/dashboard/sequences/${sequenceId}/enroll`)
            }
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
          title={galleryTitle}
          description={galleryDescription}
        />
        <SequenceTemplateGallery
          onSelectTemplate={handleSelectTemplate}
          onBlankCanvas={handleBlankCanvas}
        />
      </div>
    </DashboardShell>
  )
}
