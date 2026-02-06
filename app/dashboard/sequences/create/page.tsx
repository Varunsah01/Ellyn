"use client"

import { useRouter } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PageHeader } from "@/components/dashboard/page-header"
import { SequenceBuilder } from "@/components/sequence-builder"

export default function CreateSequencePage() {
  const router = useRouter()

  return (
    <DashboardShell>
      <div className="max-w-5xl mx-auto space-y-6">
        <PageHeader
          title="Create Sequence"
          description="Build a multi-step outreach sequence with follow-ups."
        />

        <SequenceBuilder
          onSaved={(sequenceId) => router.push(`/dashboard/sequences/${sequenceId}/enroll`)}
          onCancel={() => router.push("/dashboard/sequences")}
        />
      </div>
    </DashboardShell>
  )
}
