"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ChevronDown,
  Loader2,
  Rocket,
  Sparkles,
  WandSparkles,
} from "lucide-react"
import { TemplatePreview } from "@/components/TemplatePreview"
import { Button } from "@/components/ui/Button"
import { Label } from "@/components/ui/Label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs"
import { Textarea } from "@/components/ui/Textarea"
import { useSubscription } from "@/context/SubscriptionContext"
import { usePersona } from "@/context/PersonaContext"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"
import { markOnboardingStepComplete } from "@/lib/onboarding"
import { showToast } from "@/lib/toast"

const TONE_OPTIONS = [
  "professional",
  "friendly",
  "direct",
  "warm",
  "consultative",
  "executive",
  "enthusiastic",
  "value-first",
  "light",
  "confident",
  "collaborative",
] as const

type UseCase = "job_seeker" | "smb_sales" | "general"

type CandidateDraft = {
  subject: string
  body: string
}

interface AiDraftPanelProps {
  subject: string
  body: string
  tone: string
  useCase: string
  contact?: {
    firstName?: string
    company?: string
    role?: string
  }
  sender?: {
    name?: string
    context?: string
  }
  onApplySubject: (subject: string) => void
  onApplyBody: (body: string) => void
  onBusyChange?: (busy: boolean) => void
}

function normalizeUseCase(raw: string): UseCase {
  if (raw === "job_seeker" || raw === "smb_sales" || raw === "general") {
    return raw
  }
  return "general"
}

function readErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "Request failed"
  }

  const raw = payload as {
    error?: unknown
    data?: { error?: unknown }
  }

  if (typeof raw.error === "string" && raw.error.trim()) {
    return raw.error
  }

  if (typeof raw.data?.error === "string" && raw.data.error.trim()) {
    return raw.data.error
  }

  return "Request failed"
}

export function AiDraftPanel({
  subject,
  body,
  tone,
  useCase,
  contact,
  sender,
  onApplySubject,
  onApplyBody,
  onBusyChange,
}: AiDraftPanelProps) {
  const { quota, isLoading: isQuotaLoading } = useSubscription()
  const { refreshOnboardingSteps } = usePersona()

  const [expanded, setExpanded] = useState(false)
  const [instructions, setInstructions] = useState("")
  const [goal, setGoal] = useState("")
  const [targetTone, setTargetTone] = useState<string>(tone || "professional")

  const [error, setError] = useState<string | null>(null)
  const [loadingAction, setLoadingAction] = useState<"enhance" | "draft" | "tone" | null>(null)

  const [enhancedDraft, setEnhancedDraft] = useState<CandidateDraft | null>(null)
  const [generatedDraft, setGeneratedDraft] = useState<CandidateDraft | null>(null)
  const [toneAdjustedBody, setToneAdjustedBody] = useState<string | null>(null)

  const normalizedUseCase = useMemo(() => normalizeUseCase(useCase), [useCase])
  const isBusy = loadingAction !== null
  const remainingAiQuota = Math.max(0, quota.ai_draft.limit - quota.ai_draft.used)

  useEffect(() => {
    onBusyChange?.(isBusy)
  }, [isBusy, onBusyChange])

  useEffect(() => {
    setTargetTone(tone || "professional")
  }, [tone])

  const handleEnhance = async () => {
    if (!subject.trim() || !body.trim()) {
      setError("Add both subject and body before enhancing.")
      return
    }

    setError(null)
    setLoadingAction("enhance")
    try {
      const response = await supabaseAuthedFetch("/api/v1/ai/enhance-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          body,
          tone,
          use_case: normalizedUseCase,
          instructions: instructions.trim() || undefined,
          contact,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (response.status === 402) {
        const quotaMessage = "AI quota exhausted. Upgrade your plan to continue."
        setError(quotaMessage)
        showToast.error(quotaMessage)
        return
      }

      if (!response.ok || !payload?.success) {
        throw new Error(readErrorMessage(payload))
      }

      setEnhancedDraft({
        subject: String(payload.subject || ""),
        body: String(payload.body || ""),
      })
      markOnboardingStepComplete("first_draft").then(() => refreshOnboardingSteps())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhancement failed")
    } finally {
      setLoadingAction(null)
    }
  }

  const handleGenerateDraft = async () => {
    if (goal.trim().length < 3) {
      setError("Please add a clear goal for this email.")
      return
    }

    setError(null)
    setLoadingAction("draft")
    try {
      const response = await supabaseAuthedFetch("/api/v1/ai/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          use_case: normalizedUseCase,
          tone,
          goal: goal.trim(),
          contact: {
            firstName: contact?.firstName?.trim() || "there",
            company: contact?.company?.trim() || "your company",
            role: contact?.role?.trim() || undefined,
          },
          sender: {
            name: sender?.name?.trim() || "{{userName}}",
            context: sender?.context?.trim() || undefined,
          },
        }),
      })

      const payload = await response.json().catch(() => null)
      if (response.status === 402) {
        const quotaMessage = "AI quota exhausted. Upgrade your plan to continue."
        setError(quotaMessage)
        showToast.error(quotaMessage)
        return
      }

      if (!response.ok || !payload?.success) {
        throw new Error(readErrorMessage(payload))
      }

      setGeneratedDraft({
        subject: String(payload.subject || ""),
        body: String(payload.body || ""),
      })
      markOnboardingStepComplete("first_draft").then(() => refreshOnboardingSteps())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft generation failed")
    } finally {
      setLoadingAction(null)
    }
  }

  const handleAdjustTone = async () => {
    if (!body.trim()) {
      setError("Add body content before adjusting tone.")
      return
    }

    setError(null)
    setLoadingAction("tone")
    try {
      const response = await supabaseAuthedFetch("/api/v1/ai/adjust-tone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body,
          fromTone: tone,
          toTone: targetTone,
        }),
      })

      const payload = await response.json().catch(() => null)
      if (response.status === 402) {
        const quotaMessage = "AI quota exhausted. Upgrade your plan to continue."
        setError(quotaMessage)
        showToast.error(quotaMessage)
        return
      }

      if (!response.ok || !payload?.success) {
        throw new Error(readErrorMessage(payload))
      }

      setToneAdjustedBody(String(payload.body || ""))
      markOnboardingStepComplete("first_draft").then(() => refreshOnboardingSteps())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tone rewrite failed")
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold text-slate-800">
            AI Draft Assistant
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {isQuotaLoading
              ? "AI quota: --"
              : `AI quota: ${remainingAiQuota} left`}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${
              expanded ? "rotate-180" : ""
            }`}
          />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t"
          >
            <div className="space-y-4 p-4">
              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              {isBusy && (
                <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                  <div className="h-1 w-full animate-pulse bg-gradient-to-r from-slate-200 via-slate-300 to-slate-200" />
                  <div className="space-y-2 p-3">
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-3/5 animate-pulse rounded bg-slate-200" />
                  </div>
                </div>
              )}

              <Tabs defaultValue="enhance">
                <TabsList className="w-full">
                  <TabsTrigger value="enhance" className="flex-1">
                    Enhance
                  </TabsTrigger>
                  <TabsTrigger value="draft" className="flex-1">
                    Draft from Scratch
                  </TabsTrigger>
                  <TabsTrigger value="tone" className="flex-1">
                    Adjust Tone
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="enhance" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-enhance-instructions">
                      Any specific instructions? (optional)
                    </Label>
                    <Textarea
                      id="ai-enhance-instructions"
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                      placeholder="Example: make it shorter and more conversational"
                      rows={3}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleEnhance()}
                    disabled={loadingAction !== null}
                    className="gap-2"
                  >
                    {loadingAction === "enhance" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Enhance with AI
                  </Button>

                  {enhancedDraft && (
                    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-700">Subject diff</p>
                        <p className="text-xs text-slate-500 line-through">
                          {subject}
                        </p>
                        <p className="text-xs font-medium text-emerald-700">
                          {enhancedDraft.subject}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-slate-700">Body diff</p>
                        <p className="whitespace-pre-wrap text-xs text-slate-500 line-through">
                          {body}
                        </p>
                        <p className="whitespace-pre-wrap text-xs font-medium text-emerald-700">
                          {enhancedDraft.body}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            onApplySubject(enhancedDraft.subject)
                            onApplyBody(enhancedDraft.body)
                            setEnhancedDraft(null)
                          }}
                        >
                          Apply Changes
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setEnhancedDraft(null)}
                        >
                          Discard
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="draft" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-goal">What&apos;s your goal for this email?</Label>
                    <Textarea
                      id="ai-goal"
                      value={goal}
                      onChange={(event) => setGoal(event.target.value)}
                      rows={3}
                      placeholder="Example: Book a 15-minute intro call"
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleGenerateDraft()}
                    disabled={loadingAction !== null}
                    className="gap-2"
                  >
                    {loadingAction === "draft" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4" />
                    )}
                    Generate Draft
                  </Button>

                  {generatedDraft && (
                    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <TemplatePreview
                        subject={generatedDraft.subject}
                        body={generatedDraft.body}
                        className="border-slate-200 bg-white"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          onApplySubject(generatedDraft.subject)
                          onApplyBody(generatedDraft.body)
                        }}
                      >
                        Use This Draft
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="tone" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="ai-target-tone">Target tone</Label>
                    <Select value={targetTone} onValueChange={setTargetTone}>
                      <SelectTrigger id="ai-target-tone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TONE_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleAdjustTone()}
                    disabled={loadingAction !== null}
                    className="gap-2"
                  >
                    {loadingAction === "tone" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <WandSparkles className="h-4 w-4" />
                    )}
                    Rewrite Tone
                  </Button>

                  {toneAdjustedBody && (
                    <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                      <pre className="whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-3 text-xs text-slate-700">
                        {toneAdjustedBody}
                      </pre>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          onApplyBody(toneAdjustedBody)
                          setToneAdjustedBody(null)
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-muted-foreground">
                AI drafts are suggestions. Review placeholders and context before saving.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
