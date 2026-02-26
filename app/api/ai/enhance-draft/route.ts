import { NextRequest, NextResponse } from 'next/server'

import { getGeminiClient } from '@/lib/gemini'
import { buildPrompt, getPromptConfig, mapEnhanceAction } from '@/lib/template-prompts'
import { EnhanceDraftSchema, formatZodError } from '@/lib/validation/schemas'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { incrementAIDraftGeneration, QuotaExceededError } from '@/lib/quota'
import { captureApiException } from '@/lib/monitoring/sentry'
import { get as getCache, set as setCache } from '@/lib/cache/redis'

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
  details?: Array<{ path: string; message: string; code: string }>
}

/**
 * Handle POST requests for `/api/ai/enhance-draft`.
 * @param {NextRequest} request - Request input.
 * @returns {Promise<NextResponse<EnhanceDraftResponse>>} JSON response for the POST /api/ai/enhance-draft request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/ai/enhance-draft
 * fetch('/api/ai/enhance-draft', { method: 'POST' })
 */
export async function POST(request: NextRequest): Promise<NextResponse<EnhanceDraftResponse>> {
  const startedAt = Date.now()

  try {
    const user = await getAuthenticatedUserFromRequest(request)

    const rateLimitKey = `ratelimit:ai-enhance:${user.id}`
    const rateLimit = await checkRateLimit(rateLimitKey, 20, 3600)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Try again in an hour.',
          originalLength: 0,
          newLength: 0,
          cost: 0,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      )
    }

    // Quota enforcement
    try {
      await incrementAIDraftGeneration(user.id)
    } catch (quotaErr) {
      if (quotaErr instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            success: false,
            error: 'quota_exceeded',
            feature: quotaErr.feature,
            used: quotaErr.used,
            limit: quotaErr.limit,
            plan_type: quotaErr.plan_type,
            upgrade_url: '/dashboard/upgrade',
            originalLength: 0,
            newLength: 0,
            cost: 0,
          } as unknown as EnhanceDraftResponse,
          { status: 402 }
        )
      }
      if (quotaErr instanceof Error && quotaErr.message === 'Unauthorized') {
        return NextResponse.json(
          { success: false, error: 'Unauthorized', originalLength: 0, newLength: 0, cost: 0 },
          { status: 401 }
        )
      }
      throw quotaErr
    }

    const parsed = EnhanceDraftSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed.',
          details: formatZodError(parsed.error),
          originalLength: 0,
          newLength: 0,
          cost: 0,
        },
        { status: 400 }
      )
    }
    const body = parsed.data
    const draft = body.draft
    const action = body.action

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
    captureApiException(error, { route: '/api/ai/enhance-draft', method: 'POST' })

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

/**
 * Handle GET requests for `/api/ai/enhance-draft`.
 * @returns {unknown} JSON response for the GET /api/ai/enhance-draft request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/ai/enhance-draft
 * fetch('/api/ai/enhance-draft')
 */
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

async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = Date.now()
  const windowStart = Math.floor(now / 1000 / windowSeconds)
  const windowKey = `${key}:${windowStart}`

  const current = Number((await getCache<number>(windowKey)) ?? 0)
  if (current >= limit) {
    const resetAtMs = (windowStart + 1) * windowSeconds * 1000
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
    }
  }

  const resetAtMs = (windowStart + 1) * windowSeconds * 1000
  const ttl = Math.max(1, Math.ceil((resetAtMs - now) / 1000))
  await setCache(windowKey, current + 1, ttl)

  return { allowed: true, retryAfterSeconds: 0 }
}
