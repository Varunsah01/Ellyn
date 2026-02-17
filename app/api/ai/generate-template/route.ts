import { NextRequest, NextResponse } from 'next/server'

import { checkAiRateLimit, getRateLimitIdentifier } from '@/lib/ai-rate-limit'
import { getGeminiClient } from '@/lib/gemini'
import { buildPrompt, getPromptConfig } from '@/lib/template-prompts'
import { GenerateTemplateAiSchema, formatZodError } from '@/lib/validation/schemas'

interface GenerateTemplateResponse {
  success: boolean
  template?: {
    subject: string
    body: string
  }
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
 * Handle POST requests for `/api/ai/generate-template`.
 * @param {NextRequest} request - Request input.
 * @returns {Promise<NextResponse<GenerateTemplateResponse>>} JSON response for the POST /api/ai/generate-template request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {ValidationError} If the request payload fails validation.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // POST /api/ai/generate-template
 * fetch('/api/ai/generate-template', { method: 'POST' })
 */
export async function POST(request: NextRequest): Promise<NextResponse<GenerateTemplateResponse>> {
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

    const parsed = GenerateTemplateAiSchema.safeParse(await request.json())
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
    const body = parsed.data

    const instructions = body.instructions || 'Write a concise, high-response outreach email.'

    const promptConfig = getPromptConfig('generateFromScratch')
    const prompt = buildPrompt('generateFromScratch', {
      templateType: body.templateType,
      instructions,
      role: body.targetRole || 'hiring team member',
      company: body.targetCompany || 'target company',
      userName: body.context.userName,
      userSchool: body.context.userSchool || 'my school',
    })

    const gemini = getGeminiClient()
    const output = await gemini.generateText({
      prompt,
      systemPrompt: promptConfig.systemPrompt,
      temperature: promptConfig.temperature,
      maxTokens: promptConfig.maxTokens,
      action: 'generate-template',
    })

    const template = parseTemplatePayload(output.text)

    console.log('[AI] generate-template completed', {
      templateType: body.templateType,
      durationMs: Date.now() - startedAt,
      tokens: output.tokensUsed,
      costUsd: output.cost,
    })

    return NextResponse.json({
      success: true,
      template,
      tokensUsed: output.tokensUsed,
      cost: output.cost,
    })
  } catch (error) {
    console.error('[AI] generate-template failed', {
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

/**
 * Handle GET requests for `/api/ai/generate-template`.
 * @returns {unknown} JSON response for the GET /api/ai/generate-template request.
 * @throws {AuthenticationError} If the request is not authenticated.
 * @throws {Error} If an unexpected server error occurs.
 * @example
 * // GET /api/ai/generate-template
 * fetch('/api/ai/generate-template')
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

function parseTemplatePayload(raw: string): { subject: string; body: string } {
  const normalized = raw
    .replace(/```json\n?/gi, '')
    .replace(/```/g, '')
    .trim()

  const candidate = extractJsonObject(normalized)

  if (candidate) {
    try {
      const parsed = JSON.parse(candidate) as Partial<{ subject: string; body: string }>
      const subject = parsed.subject?.trim()
      const body = parsed.body?.trim()

      if (subject && body) {
        return { subject, body }
      }
    } catch {
      // fall through to non-JSON fallback
    }
  }

  return fallbackTemplateParse(normalized)
}

function extractJsonObject(text: string): string | null {
  if (text.startsWith('{') && text.endsWith('}')) {
    return text
  }

  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1)
  }

  return null
}

function fallbackTemplateParse(text: string): { subject: string; body: string } {
  const subjectMatch = text.match(/subject\s*[:\-]\s*(.+)/i)
  const subject = subjectMatch?.[1]?.trim() || 'Professional outreach regarding opportunities'

  const bodyMatch = text.match(/body\s*[:\-]\s*([\s\S]+)/i)
  const body = bodyMatch?.[1]?.trim() || text

  return {
    subject: subject.slice(0, 140),
    body: body.trim(),
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}
