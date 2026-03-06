import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createVersionedHandler } from '@/app/api/v1/_utils'
import { geminiGenerate } from '@/lib/ai/gemini'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { QuotaExceededError, incrementAIDraftGeneration } from '@/lib/quota'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'

const AdjustToneSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
  fromTone: z.string().trim().min(1).max(80),
  toTone: z.string().trim().min(1).max(80),
})

const AdjustToneResponseSchema = z.object({
  body: z.string().trim().min(1),
})

const SYSTEM_PROMPT =
  'You rewrite email copy while preserving meaning. Keep every {{variable}} placeholder exactly unchanged. Return ONLY valid JSON: { body: string }. Do not add explanations.'

async function postHandler(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)

    const rl = await checkApiRateLimit(`ai-adjust-tone:${user.id}`, 10, 60)
    if (!rl.allowed) {
      return rateLimitExceeded(rl.resetAt)
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = AdjustToneSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    try {
      await incrementAIDraftGeneration(user.id)
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return NextResponse.json(
          {
            error: 'quota_exceeded',
            feature: error.feature,
            used: error.used,
            limit: error.limit,
            plan_type: error.plan_type,
            upgrade_url: '/dashboard/upgrade',
          },
          { status: 402 }
        )
      }
      throw error
    }

    const data = parsed.data
    const userPrompt = [
      `Current tone: ${data.fromTone}`,
      `Target tone: ${data.toTone}`,
      'Rewrite this email body to the target tone.',
      'Keep meaning unchanged.',
      'Keep the output word count within +/-20% of the original.',
      'Keep all {{variables}} exactly as-is.',
      'Email body:',
      data.body,
      'Return only JSON with key body.',
    ].join('\n')

    const raw = await geminiGenerate({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxOutputTokens: 600,
      temperature: 0.6,
    })

    const parsedModel = AdjustToneResponseSchema.safeParse(parseGeminiJson(raw))
    if (!parsedModel.success) {
      return NextResponse.json(
        { error: 'Failed to parse Gemini output' },
        { status: 502 }
      )
    }

    const body = preserveTemplatePlaceholders(data.body, parsedModel.data.body)

    return NextResponse.json({
      success: true,
      body,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    captureApiException(error, {
      route: '/api/v1/ai/adjust-tone',
      method: 'POST',
    })

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to adjust tone',
      },
      { status: 500 }
    )
  }
}

function parseGeminiJson(raw: string): unknown {
  const normalized = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  const firstBrace = normalized.indexOf('{')
  const lastBrace = normalized.lastIndexOf('}')

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error('Gemini output was not JSON')
  }

  return JSON.parse(normalized.slice(firstBrace, lastBrace + 1))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractPlaceholders(source: string): Map<string, string> {
  const placeholders = new Map<string, string>()
  const regex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g

  let match: RegExpExecArray | null
  while ((match = regex.exec(source)) !== null) {
    const key = String(match[1] || '').trim()
    if (!key || placeholders.has(key)) continue
    placeholders.set(key, `{{${key}}}`)
  }

  return placeholders
}

function preserveTemplatePlaceholders(original: string, rewritten: string): string {
  const requiredPlaceholders = extractPlaceholders(original)
  if (requiredPlaceholders.size === 0) return rewritten

  let output = rewritten
  for (const [key, token] of requiredPlaceholders.entries()) {
    const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g')
    if (pattern.test(output)) {
      output = output.replace(pattern, token)
      continue
    }

    output = `${output}${output.trim().length === 0 ? '' : '\n'}${token}`
  }

  return output
}

export const POST = createVersionedHandler(postHandler as never)
