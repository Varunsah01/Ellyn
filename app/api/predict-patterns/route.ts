import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  estimateCompanySize,
  generateSmartEmailPatternsCached,
} from '@/lib/enhanced-email-patterns'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'

const bodySchema = z.object({
  domain: z.string().trim().min(3),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  role: z.string().trim().min(1).optional(),
})

function normalizeDomain(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    ?.split('?')[0]
    ?.split('#')[0] ?? ''
}

export async function POST(request: NextRequest) {
  try {
    await getAuthenticatedUserFromRequest(request)

    const payload = await request.json().catch(() => null)
    const parsed = bodySchema.safeParse(payload)

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 }
      )
    }

    const domain = normalizeDomain(parsed.data.domain)
    if (!domain) {
      return NextResponse.json({ error: 'Invalid domain' }, { status: 400 })
    }

    const companySize = estimateCompanySize(domain)
    const candidates = await generateSmartEmailPatternsCached(
      parsed.data.firstName,
      parsed.data.lastName,
      {
        domain,
        estimatedSize: companySize,
      },
      parsed.data.role
    )

    return NextResponse.json({
      success: true,
      domain,
      patterns: candidates.map((candidate) => ({
        email: candidate.email,
        pattern: candidate.pattern,
        confidence: candidate.confidence,
      })),
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to predict patterns',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use POST.',
    },
    { status: 405 }
  )
}
