"use client"

import { ArrowLeft, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface SetupStepProps {
  fullName: string
  currentRole: string
  targetRole: string
  aiApiKey: string
  onChange: (field: "fullName" | "currentRole" | "targetRole" | "aiApiKey", value: string) => void
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
  error?: string | null
}

export function SetupStep({
  fullName,
  currentRole,
  targetRole,
  aiApiKey,
  onChange,
  onBack,
  onSubmit,
  isSubmitting,
  error,
}: SetupStepProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-fraunces font-bold">Quick Setup</h2>
        <p className="text-muted-foreground">
          Personalize Ellyn so your outreach feels authentic and consistent.
        </p>
      </div>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Your name (used in signatures)</Label>
          <Input
            id="fullName"
            placeholder="Varun Kumar"
            value={fullName}
            onChange={(event) => onChange("fullName", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currentRole">Current role</Label>
          <Input
            id="currentRole"
            placeholder="Software Engineer"
            value={currentRole}
            onChange={(event) => onChange("currentRole", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetRole">Target role</Label>
          <Input
            id="targetRole"
            placeholder="Product Manager"
            value={targetRole}
            onChange={(event) => onChange("targetRole", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="aiApiKey">AI API key (optional)</Label>
          <Input
            id="aiApiKey"
            type="password"
            placeholder="sk-..."
            value={aiApiKey}
            onChange={(event) => onChange("aiApiKey", event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used to generate AI drafts if you want to bring your own key.
          </p>
        </div>
        {error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {isSubmitting ? "Saving..." : "Start Using Ellyn"}
        </Button>
      </div>
    </div>
  )
}
