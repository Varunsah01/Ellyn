import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createVersionedHandler } from '@/app/api/v1/_utils'
import { geminiGenerate } from '@/lib/ai/gemini'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { QuotaExceededError, incrementAIDraftGeneration } from '@/lib/quota'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'

const EnhanceTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  tone: z.string().trim().min(1).max(80),
  use_case: z.enum(['job_seeker', 'smb_sales', 'general']),
  instructions: z.string().trim().max(1000).optional(),
  contact: z
    .object({
      firstName: z.string().trim().max(120).optional(),
      company: z.string().trim().max(160).optional(),
      role: z.string().trim().max(160).optional(),
    })
    .optional(),
})

const EnhanceResponseSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
})

const SYSTEM_PROMPT =
  'You are an expert cold email copywriter. You write concise, human, non-salesy emails that get replies. Always preserve {{variable}} placeholders exactly as-is. Return ONLY valid JSON: { subject: string, body: string }. Never add preamble or explanation.'

async function postHandler(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)

    const rl = await checkApiRateLimit(`ai-enhance-template:${user.id}`, 10, 60)
    if (!rl.allowed) {
      return rateLimitExceeded(rl.resetAt)
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

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = EnhanceTemplateSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    const data = parsed.data
    const userPrompt = buildEnhancePrompt(data)
    const raw = await geminiGenerate({
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxOutputTokens: 700,
      temperature: 0.7,
    })

    const parsedModel = EnhanceResponseSchema.safeParse(parseGeminiJson(raw))
    if (!parsedModel.success) {
      return NextResponse.json(
        { error: 'Failed to parse Gemini output' },
        { status: 502 }
      )
    }

    const subject = preserveTemplatePlaceholders(
      data.subject,
      parsedModel.data.subject,
      ' '
    )
    const body = preserveTemplatePlaceholders(
      data.body,
      parsedModel.data.body,
      '\n'
    )

    return NextResponse.json({
      success: true,
      subject,
      body,
      model: 'gemini-flash',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    captureApiException(error, {
      route: '/api/v1/ai/enhance-template',
      method: 'POST',
    })

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to enhance template',
      },
      { status: 500 }
    )
  }
}

function buildEnhancePrompt(input: z.infer<typeof EnhanceTemplateSchema>): string {
  return [
    'Rewrite and improve this outreach template while preserving intent and placeholders.',
    `Use case: ${input.use_case}`,
    `Tone target: ${input.tone}`,
    `Current subject: ${input.subject}`,
    'Current body:',
    input.body,
    input.instructions ? `User instructions: ${input.instructions}` : null,
    input.contact?.firstName ? `Contact first name: ${input.contact.firstName}` : null,
    input.contact?.company ? `Contact company: ${input.contact.company}` : null,
    input.contact?.role ? `Contact role: ${input.contact.role}` : null,
    'Return only JSON with keys subject and body.',
  ]
    .filter(Boolean)
    .join('\n')
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

function preserveTemplatePlaceholders(
  original: string,
  rewritten: string,
  joiner: string
): string {
  const requiredPlaceholders = extractPlaceholders(original)
  if (requiredPlaceholders.size === 0) return rewritten

  let output = rewritten
  for (const [key, token] of requiredPlaceholders.entries()) {
    const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g')
    if (pattern.test(output)) {
      output = output.replace(pattern, token)
      continue
    }

    const separator = output.trim().length === 0 ? '' : joiner
    output = `${output}${separator}${token}`
  }

  return output
}

export const POST = createVersionedHandler(postHandler as never)
