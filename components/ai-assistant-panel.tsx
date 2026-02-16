"use client"

import { useMemo, useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  Palette,
  PencilLine,
  Scissors,
  Sparkles,
  StretchHorizontal,
  Target,
  Wand2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

export type AssistantTone = 'professional' | 'casual' | 'friendly' | 'formal' | 'enthusiastic'

type EnhanceAction = 'enhance' | 'shorten' | 'lengthen' | 'fix-grammar'

interface AIAssistantPanelProps {
  body: string
  templateType: string
  subject: string
  targetCompany?: string
  targetRole?: string
  userName: string
  userSchool?: string
  onApplyBody: (body: string) => void
  onApplyTemplate: (template: { subject: string; body: string }) => void
}

interface AiMeta {
  tokens: number
  cost: number
}

export function AIAssistantPanel({
  body,
  templateType,
  subject,
  targetCompany,
  targetRole,
  userName,
  userSchool,
  onApplyBody,
  onApplyTemplate,
}: AIAssistantPanelProps) {
  const { toast } = useToast()
  const [tone, setTone] = useState<AssistantTone>('professional')
  const [lengthTarget, setLengthTarget] = useState<'short' | 'medium' | 'long'>('medium')
  const [customInstructions, setCustomInstructions] = useState('')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [lastMeta, setLastMeta] = useState<AiMeta | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canRunDraftActions = useMemo(() => body.trim().length > 0, [body])

  const runEnhancement = async (action: EnhanceAction, label: string) => {
    if (!canRunDraftActions) {
      toast({
        title: 'Draft required',
        description: 'Add some draft content before using this action.',
        variant: 'destructive',
      })
      return
    }

    setError(null)
    setLoadingAction(label)

    try {
      const response = await fetch('/api/ai/enhance-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: body,
          action,
          additionalContext: {
            tone,
            company: targetCompany,
            userName,
            userSchool,
          },
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success || !data.enhancedDraft) {
        throw new Error(data.error || 'AI enhancement failed.')
      }

      onApplyBody(data.enhancedDraft)
      setLastMeta({
        tokens: data.tokensUsed?.total || 0,
        cost: data.cost || 0,
      })

      toast({
        title: 'Applied',
        description: `${label} updated your draft.`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected AI error'
      setError(message)
    } finally {
      setLoadingAction(null)
    }
  }

  const runToneCustomization = async () => {
    if (!canRunDraftActions) {
      toast({
        title: 'Draft required',
        description: 'Add some draft content before changing tone.',
        variant: 'destructive',
      })
      return
    }

    setError(null)
    setLoadingAction('Change tone')

    try {
      const response = await fetch('/api/ai/customize-tone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: body,
          targetTone: tone,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success || !data.customizedDraft) {
        throw new Error(data.error || 'Tone customization failed.')
      }

      onApplyBody(data.customizedDraft)
      setLastMeta({
        tokens: data.tokensUsed?.total || 0,
        cost: data.cost || 0,
      })

      toast({
        title: 'Applied',
        description: `Tone changed to ${tone}.`,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected AI error'
      setError(message)
    } finally {
      setLoadingAction(null)
    }
  }

  const runPersonalization = async () => {
    if (!canRunDraftActions) {
      toast({
        title: 'Draft required',
        description: 'Add some draft content before personalization.',
        variant: 'destructive',
      })
      return
    }

    setError(null)
    setLoadingAction('Add personalization')

    try {
      const enrichedDraft = `${body}\n\nPersonalization notes:\n- Company: ${targetCompany || 'target company'}\n- Role: ${targetRole || 'target role'}\n- Sender: ${userName}${userSchool ? ` (${userSchool})` : ''}`

      const response = await fetch('/api/ai/enhance-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: enrichedDraft,
          action: 'enhance',
          additionalContext: {
            tone,
            company: targetCompany,
            userName,
            userSchool,
          },
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success || !data.enhancedDraft) {
        throw new Error(data.error || 'Personalization failed.')
      }

      onApplyBody(data.enhancedDraft)
      setLastMeta({
        tokens: data.tokensUsed?.total || 0,
        cost: data.cost || 0,
      })

      toast({
        title: 'Applied',
        description: 'Personalized details were added.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected AI error'
      setError(message)
    } finally {
      setLoadingAction(null)
    }
  }

  const runGenerateFromScratch = async () => {
    setError(null)
    setLoadingAction('Start from scratch')

    try {
      const instructions = customInstructions.trim() || `Create a ${tone} outreach email with ${lengthTarget} length.`
      const response = await fetch('/api/ai/generate-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType,
          instructions,
          context: {
            userName,
            userSchool,
          },
          targetRole,
          targetCompany,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success || !data.template) {
        throw new Error(data.error || 'Template generation failed.')
      }

      onApplyTemplate(data.template)
      setLastMeta({
        tokens: data.tokensUsed?.total || 0,
        cost: data.cost || 0,
      })

      toast({
        title: 'Applied',
        description: 'Generated a new template draft.',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected AI error'
      setError(message)
    } finally {
      setLoadingAction(null)
    }
  }

  const actionItems = [
    {
      label: 'Enhance this draft',
      icon: Sparkles,
      onClick: () => runEnhancement('enhance', 'Enhance this draft'),
    },
    {
      label: 'Make it shorter',
      icon: Scissors,
      onClick: () => runEnhancement('shorten', 'Make it shorter'),
    },
    {
      label: 'Make it longer',
      icon: StretchHorizontal,
      onClick: () => runEnhancement('lengthen', 'Make it longer'),
    },
    {
      label: 'Fix grammar',
      icon: CheckCircle2,
      onClick: () => runEnhancement('fix-grammar', 'Fix grammar'),
    },
    {
      label: 'Change tone',
      icon: Palette,
      onClick: runToneCustomization,
    },
    {
      label: 'Add personalization',
      icon: Target,
      onClick: runPersonalization,
    },
    {
      label: 'Start from scratch',
      icon: Wand2,
      onClick: runGenerateFromScratch,
    },
  ]

  return (
    <Card className="border-blue-200/70 bg-gradient-to-b from-blue-50/70 via-white to-white">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-slate-900">
          <Sparkles className="h-4 w-4 text-violet-600" />
          AI Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2">
          {actionItems.map((action) => {
            const Icon = action.icon
            const isLoading = loadingAction === action.label

            return (
              <Button
                key={action.label}
                variant="outline"
                className="justify-start"
                onClick={action.onClick}
                disabled={Boolean(loadingAction)}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Icon className="mr-2 h-4 w-4" />}
                {isLoading ? 'Generating...' : action.label}
              </Button>
            )
          })}
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ai-tone">Tone</Label>
              <Select value={tone} onValueChange={(value) => setTone(value as AssistantTone)}>
                <SelectTrigger id="ai-tone" aria-label="Tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ai-length">Length</Label>
              <Select value={lengthTarget} onValueChange={(value) => setLengthTarget(value as 'short' | 'medium' | 'long')}>
                <SelectTrigger id="ai-length" aria-label="Length">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="ai-instructions">Custom Instructions</Label>
            <Input
              id="ai-instructions"
              value={customInstructions}
              onChange={(event) => setCustomInstructions(event.target.value)}
              placeholder="Example: Emphasize distributed systems experience"
            />
          </div>
        </div>

        {lastMeta && (
          <p className="text-xs text-slate-500">
            Used {lastMeta.tokens} tokens (~${lastMeta.cost.toFixed(4)})
          </p>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-600">
            <p>{error}</p>
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-red-600"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        <div className="rounded-md border border-blue-100 bg-blue-50 p-2 text-xs text-blue-700">
          <p>
            AI output is suggestion-only. Review before saving or sending.
          </p>
          <p className="mt-1">Current subject: {subject || 'Not set'}</p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <PencilLine className="h-3.5 w-3.5" />
          <span>Average AI operation target: under $0.001</span>
        </div>
      </CardContent>
    </Card>
  )
}
