"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Textarea } from "@/components/ui/Textarea"
import { StepBuilder } from "@/components/sequences/StepBuilder"
import { useSequences } from "@/lib/hooks/useSequences"
import { SequenceStep } from "@/lib/types/sequence"
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react"

interface SequenceBuilderProps {
  onSaved?: (sequenceId: string) => void
  onCancel?: () => void
}

/**
 * Render the SequenceBuilder component.
 * @param {SequenceBuilderProps} props - Component props.
 * @returns {unknown} JSX output for SequenceBuilder.
 * @example
 * <SequenceBuilder />
 */
export function SequenceBuilder({ onSaved, onCancel }: SequenceBuilderProps) {
  const router = useRouter()
  const { templates } = useSequences()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [goal, setGoal] = useState("")
  const [steps, setSteps] = useState<SequenceStep[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSave =
    name.trim().length > 0 &&
    steps.length > 0 &&
    steps.every((step) => step.subject.trim() && step.body.trim())

  const saveSequence = async (launch: boolean) => {
    if (!canSave) return
    setSaving(true)
    setError(null)

    try {
      const response = await fetch("/api/v1/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          goal: goal.trim(),
          status: launch ? "active" : "draft",
          steps,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save sequence")
      }

      const data = await response.json()
      const sequenceId = data.sequence?.id

      if (sequenceId) {
        onSaved?.(sequenceId)
        if (!onSaved) {
          router.push("/dashboard/sequences")
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save sequence")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sequence Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sequence-name">Sequence name</Label>
            <Input
              id="sequence-name"
              placeholder="e.g. Product Manager Outreach"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sequence-description">Description</Label>
            <Textarea
              id="sequence-description"
              placeholder="Briefly describe your goal for this outreach"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sequence-goal">Goal</Label>
            <Input
              id="sequence-goal"
              placeholder="Schedule 10 informational interviews"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sequence Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <StepBuilder
            steps={steps}
            onChange={setSteps}
            templates={templates.map((template) => ({
              id: template.id,
              name: template.name,
              subject: template.subject,
              body: template.body,
            }))}
          />
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={onCancel ?? (() => router.push("/dashboard/sequences"))}
        >
          Cancel
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => saveSequence(false)}
            disabled={!canSave || saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Draft
          </Button>
          <Button onClick={() => saveSequence(true)} disabled={!canSave || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save & Enroll Contacts
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

