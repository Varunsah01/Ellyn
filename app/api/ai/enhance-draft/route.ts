import { NextRequest, NextResponse } from 'next/server'

import { checkAiRateLimit, getRateLimitIdentifier } from '@/lib/ai-rate-limit'
import { getGeminiClient } from '@/lib/gemini'
import { buildPrompt, getPromptConfig, mapEnhanceAction } from '@/lib/template-prompts'

interface EnhanceDraftRequest {
  draft: string
  action: 'enhance' | 'shorten' | 'lengthen' | 'fix-grammar'
  additionalContext?: {
    tone?: string
    company?: string
    userName?: string
    userSchool?: string
  }
}

interface EnhanceDraftResponse {
  success: boolean
  enhancedDraft?: string
  originalLength: number
  newLength: number
  tokensUsed?: {
    input: number
    output: number
    total: number
  }
  cost: number
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<EnhanceDraftResponse>> {
  const startedAt = Date.now()

  try {
    const limiter = checkAiRateLimit(getRateLimitIdentifier(request))
    if (!limiter.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please retry later.',
          originalLength: 0,
          newLength: 0,
          cost: 0,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(limiter.retryAfterMs / 1000)),
          },
        }
      )
    }

    const body = (await request.json()) as Partial<EnhanceDraftRequest>
    const draft = body.draft?.trim() || ''
    const action = body.action || 'enhance'

    if (!draft) {
      return NextResponse.json(
        {
          success: false,
          error: 'Draft is required.',
          originalLength: 0,
          newLength: 0,
          cost: 0,
        },
        { status: 400 }
      )
    }

    if (!['enhance', 'shorten', 'lengthen', 'fix-grammar'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action.',
          originalLength: countWords(draft),
          newLength: countWords(draft),
          cost: 0,
        },
        { status: 400 }
      )
    }

    const promptAction = mapEnhanceAction(action)
    const promptConfig = getPromptConfig(promptAction)

    const prompt = buildPrompt(promptAction, {
      draft,
      tone: body.additionalContext?.tone || 'professional',
      company: body.additionalContext?.company || 'the company',
      userName: body.additionalContext?.userName || 'the candidate',
      userSchool: body.additionalContext?.userSchool || 'their school',
    })

    const gemini = getGeminiClient()
    const output = await gemini.generateText({
      prompt,
      systemPrompt: promptConfig.systemPrompt,
      temperature: promptConfig.temperature,
      maxTokens: promptConfig.maxTokens,
      action: `enhance-${action}`,
    })

    const enhancedDraft = sanitizeGeneratedText(output.text)

    console.log('[AI] enhance-draft completed', {
      action,
      durationMs: Date.now() - startedAt,
      tokens: output.tokensUsed,
      costUsd: output.cost,
    })

    return NextResponse.json({
      success: true,
      enhancedDraft,
      originalLength: countWords(draft),
      newLength: countWords(enhancedDraft),
      tokensUsed: output.tokensUsed,
      cost: output.cost,
    })
  } catch (error) {
    console.error('[AI] enhance-draft failed', {
      error: toErrorMessage(error),
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json(
      {
        success: false,
        error: toErrorMessage(error),
        originalLength: 0,
        newLength: 0,
        cost: 0,
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: 'Method not allowed. Use POST.',
      originalLength: 0,
      newLength: 0,
      cost: 0,
    },
    { status: 405 }
  )
}

function sanitizeGeneratedText(text: string): string {
  const stripped = text
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim()

  return stripped
}

function countWords(text: string): number {
  if (!text.trim()) return 0
  return text.trim().split(/\s+/).length
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}
