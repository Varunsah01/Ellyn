import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createVersionedHandler } from '@/app/api/v1/_utils'
import { geminiGenerate } from '@/lib/ai/gemini'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { QuotaExceededError, incrementAIDraftGeneration } from '@/lib/quota'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'

const DraftEmailSchema = z.object({
  use_case: z.enum(['job_seeker', 'smb_sales', 'general']),
  tone: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(3).max(500),
  contact: z.object({
    firstName: z.string().trim().min(1).max(120),
    company: z.string().trim().min(1).max(160),
    role: z.string().trim().max(160).optional(),
  }),
  sender: z.object({
    name: z.string().trim().min(1).max(120),
    context: z.string().trim().max(300).optional(),
  }),
  extra_instructions: z.string().trim().max(1000).optional(),
})

const DraftResponseSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
})

const BASE_SYSTEM_PROMPT =
  'You write high-reply cold emails. Preserve all {{variable}} placeholders exactly. Return ONLY valid JSON: { subject: string, body: string }. Never include explanations.'

async function postHandler(request: NextRequest) {
  try {
    const user = await getAuthenticatedUserFromRequest(request)

    const rl = await checkApiRateLimit(`ai-draft-email:${user.id}`, 10, 60)
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

    const parsed = DraftEmailSchema.safeParse(payload)
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
    const userPrompt = buildDraftPrompt(data)

    const raw = await geminiGenerate({
      systemPrompt: `${BASE_SYSTEM_PROMPT}\n${personaInstruction(data.use_case)}`,
      userPrompt,
      maxOutputTokens: 650,
      temperature: 0.7,
    })

    const parsedModel = DraftResponseSchema.safeParse(parseGeminiJson(raw))
    if (!parsedModel.success) {
      return NextResponse.json(
        { error: 'Failed to parse Gemini output' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      subject: parsedModel.data.subject,
      body: parsedModel.data.body,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    captureApiException(error, {
      route: '/api/v1/ai/draft-email',
      method: 'POST',
    })

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to draft email' },
      { status: 500 }
    )
  }
}

function buildDraftPrompt(input: z.infer<typeof DraftEmailSchema>): string {
  return [
    'Generate a brand-new email draft.',
    `Use case: ${input.use_case}`,
    `Tone: ${input.tone}`,
    `Goal: ${input.goal}`,
    `Recipient first name: ${input.contact.firstName}`,
    `Recipient company: ${input.contact.company}`,
    input.contact.role ? `Recipient role: ${input.contact.role}` : null,
    `Sender name: ${input.sender.name}`,
    input.sender.context ? `Sender context: ${input.sender.context}` : null,
    input.extra_instructions
      ? `Extra instructions: ${input.extra_instructions}`
      : null,
    'Return only JSON with keys subject and body.',
  ]
    .filter(Boolean)
    .join('\n')
}

function personaInstruction(
  useCase: z.infer<typeof DraftEmailSchema>['use_case']
): string {
  if (useCase === 'job_seeker') {
    return 'For job seekers: be warm and concise, avoid buzzwords, and reference shared interests when possible.'
  }

  if (useCase === 'smb_sales') {
    return 'For sales outreach: lead with pain, include one clear CTA, and keep the body under 120 words.'
  }

  return 'For general outreach: use neutral professional language with a clear and respectful ask.'
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

export const POST = createVersionedHandler(postHandler as never)
