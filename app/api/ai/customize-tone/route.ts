import { NextRequest, NextResponse } from 'next/server'

import { checkAiRateLimit, getRateLimitIdentifier } from '@/lib/ai-rate-limit'
import { getGeminiClient } from '@/lib/gemini'
import { buildPrompt, getPromptConfig } from '@/lib/template-prompts'
import { CustomizeToneSchema, formatZodError } from '@/lib/validation/schemas'
import { captureApiException } from '@/lib/monitoring/sentry'

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
  details?: Array<{ path: string; message: string; code: string }>
}

/**
 * Handle POST requests for `/api/ai/customize-tone`.
 * @param {NextRequest} request - Request input.
 * @returns {Promise<NextResponse<CustomizeToneResponse>>} JSON response for the POST /api/ai/customize-tone request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/ai/customize-tone
 * fetch('/api/ai/customize-tone', { method: 'POST' })
 */
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

    const parsed = CustomizeToneSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed.',
          details: formatZodError(parsed.error),
          cost: 0,
        },
        { status: 400 }
      )
    }
    const { draft, targetTone } = parsed.data

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
    captureApiException(error, { route: '/api/ai/customize-tone', method: 'POST' })

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

/**
 * Handle GET requests for `/api/ai/customize-tone`.
 * @returns {unknown} JSON response for the GET /api/ai/customize-tone request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/ai/customize-tone
 * fetch('/api/ai/customize-tone')
 */
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
