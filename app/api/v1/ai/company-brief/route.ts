import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createVersionedHandler } from '@/app/api/v1/_utils'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { callLLMWithFallback } from '@/lib/llm-client'
import { captureApiException } from '@/lib/monitoring/sentry'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'

const CompanyBriefRequestSchema = z.object({
  company_name: z.string().trim().min(2).max(160),
  company_page_url: z.string().trim().max(400).optional(),
})

const BASE_SYSTEM_PROMPT = [
  'You write short factual company blurbs.',
  'Return ONLY valid JSON (no markdown, no prose outside JSON).',
  'Use this exact shape:',
  '{"intro_brief":"","sector":"","specialization":"","year_of_incorporation":""}',
  'Rules:',
  '- intro_brief: max 2 sentences, concise and factual.',
  '- sector: short phrase.',
  '- specialization: short phrase.',
  '- year_of_incorporation: 4-digit year when known, else empty string.',
  '- If uncertain, use empty string.',
].join('\n')

type CompanyBriefPayload = {
  intro_brief: string
  sector: string
  specialization: string
  year_of_incorporation: string
}

function buildPrompt(input: z.infer<typeof CompanyBriefRequestSchema>): string {
  return [
    `Company name: ${input.company_name}`,
    input.company_page_url ? `Company LinkedIn URL: ${input.company_page_url}` : null,
    'Provide a brief intro and the requested metadata fields.',
    'Return only JSON.',
  ]
    .filter(Boolean)
    .join('\n')
}

function parseLlmJson(raw: string): unknown {
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

function normalizeField(value: unknown, maxLength: number): string {
  const normalized = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return ''

  const lower = normalized.toLowerCase()
  const blocked = new Set([
    'unknown',
    'n/a',
    'na',
    'none',
    'null',
    'not available',
    'not found',
    '-',
    '--',
  ])
  if (blocked.has(lower)) return ''

  return normalized.slice(0, maxLength)
}

function normalizeYear(value: unknown): string {
  const normalized = normalizeField(value, 20)
  if (!normalized) return ''
  const match = normalized.match(/\b(18|19|20)\d{2}\b/)
  return match ? match[0] : ''
}

function normalizeCompanyBrief(data: unknown): CompanyBriefPayload {
  const source = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>

  return {
    intro_brief: normalizeField(source.intro_brief, 420),
    sector: normalizeField(source.sector, 140),
    specialization: normalizeField(source.specialization, 180),
    year_of_incorporation: normalizeYear(source.year_of_incorporation),
  }
}

function hasMeaningfulCompanyBrief(payload: CompanyBriefPayload): boolean {
  return Boolean(
    payload.intro_brief ||
      payload.sector ||
      payload.specialization ||
      payload.year_of_incorporation
  )
}

function buildCompanyBriefFallback(companyName: string): CompanyBriefPayload {
  const safeCompany = normalizeField(companyName, 160)
  const label = safeCompany || 'This company'
  return {
    intro_brief: `${label} is listed on LinkedIn. Detailed company insights are unavailable right now.`,
    sector: '',
    specialization: '',
    year_of_incorporation: '',
  }
}

async function postHandler(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)

    const rl = await checkApiRateLimit(`ai-company-brief:${user.id}`, 20, 60)
    if (!rl.allowed) {
      return rateLimitExceeded(rl.resetAt)
    }

    let payload: unknown
    try {
      payload = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = CompanyBriefRequestSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }

    let data: CompanyBriefPayload = buildCompanyBriefFallback(parsed.data.company_name)
    let provider = 'fallback'
    let model = 'local-fallback'
    let fallbackUsed = true

    try {
      const llm = await callLLMWithFallback({
        systemPrompt: BASE_SYSTEM_PROMPT,
        userPrompt: buildPrompt(parsed.data),
        maxTokens: 280,
        temperature: 0.2,
        action: 'company_brief',
      })

      const normalized = normalizeCompanyBrief(parseLlmJson(llm.text))
      if (hasMeaningfulCompanyBrief(normalized)) {
        data = normalized
      }

      provider = llm.provider
      model = llm.model
      fallbackUsed = llm.provider !== 'gemini'
    } catch (llmError) {
      console.warn('[company-brief] LLM chain failed. Returning deterministic fallback brief.', {
        error: llmError instanceof Error ? llmError.message : String(llmError),
      })
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        provider,
        model,
        fallbackUsed,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    captureApiException(error, {
      route: '/api/v1/ai/company-brief',
      method: 'POST',
    })

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate company brief',
      },
      { status: 500 }
    )
  }
}

export const POST = createVersionedHandler(postHandler as never)
