import { NextRequest, NextResponse } from 'next/server'

import { checkAiRateLimit, getRateLimitIdentifier } from '@/lib/ai-rate-limit'
import { getGeminiClient } from '@/lib/gemini'
import { buildPrompt, getPromptConfig } from '@/lib/template-prompts'

interface CustomizeToneRequest {
  draft: string
  targetTone: 'professional' | 'casual' | 'friendly' | 'formal' | 'enthusiastic'
}

interface CustomizeToneResponse {
  success: boolean
  customizedDraft?: string
  tokensUsed?: {
    input: number
    output: number
    total: number
  }
  cost: number
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<CustomizeToneResponse>> {
  const startedAt = Date.now()

  try {
    const limiter = checkAiRateLimit(getRateLimitIdentifier(request))
    if (!limiter.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please retry later.',
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

    const body = (await request.json()) as Partial<CustomizeToneRequest>
    const draft = body.draft?.trim() || ''
    const targetTone = body.targetTone?.trim().toLowerCase() || ''

    if (!draft) {
      return NextResponse.json(
        {
          success: false,
          error: 'Draft is required.',
          cost: 0,
        },
        { status: 400 }
      )
    }

    const allowedTones = new Set(['professional', 'casual', 'friendly', 'formal', 'enthusiastic'])
    if (!allowedTones.has(targetTone)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid targetTone.',
          cost: 0,
        },
        { status: 400 }
      )
    }

    const promptConfig = getPromptConfig('changeTone')
    const prompt = buildPrompt('changeTone', {
      tone: targetTone,
      draft,
    })

    const gemini = getGeminiClient()
    const output = await gemini.generateText({
      prompt,
      systemPrompt: promptConfig.systemPrompt,
      temperature: promptConfig.temperature,
      maxTokens: promptConfig.maxTokens,
      action: 'customize-tone',
    })

    const customizedDraft = output.text
      .replace(/```[a-z]*\n?/gi, '')
      .replace(/```/g, '')
      .trim()

    console.log('[AI] customize-tone completed', {
      tone: targetTone,
      durationMs: Date.now() - startedAt,
      tokens: output.tokensUsed,
      costUsd: output.cost,
    })

    return NextResponse.json({
      success: true,
      customizedDraft,
      tokensUsed: output.tokensUsed,
      cost: output.cost,
    })
  } catch (error) {
    console.error('[AI] customize-tone failed', {
      error: toErrorMessage(error),
      durationMs: Date.now() - startedAt,
    })

    return NextResponse.json(
      {
        success: false,
        error: toErrorMessage(error),
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
      cost: 0,
    },
    { status: 405 }
  )
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}
