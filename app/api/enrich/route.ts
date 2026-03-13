import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  estimateCompanySize,
  generateSmartEmailPatternsCached,
  type EmailPattern,
} from '@/lib/enhanced-email-patterns'
import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { captureApiException } from '@/lib/monitoring/sentry'
import { verifyDomainMX } from '@/lib/mx-verification'
import { incrementEmailGeneration, QuotaExceededError } from '@/lib/quota'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'
import { resolveDomain } from '@/lib/domain-resolution-service'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { verifyEmailEmailable } from '@/lib/emailable-verification'
import { GoogleGenerativeAI } from '@google/generative-ai'

const enrichSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  companyName: z.string().trim().min(1),
  role: z.string().trim().min(1).optional(),
})

type RankedCandidate = {
  email: string
  pattern: string
  confidence: number
}

type EnrichResponse = {
  success: true
  result: {
    email: string
    pattern: string
    confidence: number
    verified: boolean
    badge: 'verified' | 'most_probable' | 'domain_no_mx'
    verificationSource?: 'emailable' | 'mx_only'
  }
  domain: string
  metadata: {
    companySize: string
    emailProvider: string
    domainSource: string
    patternsChecked: number
  }
}

function quotaExceededResponse(error: QuotaExceededError) {
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

function normalizeNamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function buildFallbackCandidates(firstName: string, lastName: string, domain: string): RankedCandidate[] {
  const first = normalizeNamePart(firstName)
  const last = normalizeNamePart(lastName)
  const firstInitial = first.slice(0, 1)

  const rawCandidates: RankedCandidate[] = [
    { email: `${first}.${last}@${domain}`, pattern: 'first.last', confidence: 85 },
    { email: `${firstInitial}${last}@${domain}`, pattern: 'flast', confidence: 75 },
    { email: `${first}${last}@${domain}`, pattern: 'firstlast', confidence: 68 },
    { email: `${first}@${domain}`, pattern: 'first', confidence: 62 },
    { email: `${last}.${first}@${domain}`, pattern: 'last.first', confidence: 50 },
    { email: `${firstInitial}.${last}@${domain}`, pattern: 'f.last', confidence: 45 },
  ]

  return rawCandidates.filter((candidate) => candidate.email.includes('@'))
}

function dedupeAndFillCandidates(
  baseCandidates: EmailPattern[],
  firstName: string,
  lastName: string,
  domain: string
): RankedCandidate[] {
  const unique = new Map<string, RankedCandidate>()

  for (const candidate of baseCandidates) {
    const email = String(candidate.email || '').trim().toLowerCase()
    if (!email) continue

    const normalizedCandidate: RankedCandidate = {
      email,
      pattern: String(candidate.pattern || 'unknown').trim().toLowerCase() || 'unknown',
      confidence: Math.max(0, Math.min(100, Number(candidate.confidence) || 0)),
    }

    if (!unique.has(normalizedCandidate.email)) {
      unique.set(normalizedCandidate.email, normalizedCandidate)
    }
  }

  const fallback = buildFallbackCandidates(firstName, lastName, domain)
  for (const candidate of fallback) {
    if (!unique.has(candidate.email)) {
      unique.set(candidate.email, candidate)
    }
    if (unique.size >= 6) break
  }

  const output = Array.from(unique.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6)

  if (output.length === 0) {
    return fallback.slice(0, 6)
  }

  return output
}

async function rankWithGeminiOrFallback(
  candidates: RankedCandidate[],
  context: {
    firstName: string
    lastName: string
    domain: string
    role?: string
  }
): Promise<RankedCandidate[]> {
  const fallbackTopTwo = candidates.slice(0, 2)

  if (!process.env.GOOGLE_AI_API_KEY?.trim()) {
    return fallbackTopTwo
  }

  const prompt = [
    'Rank the 6 email candidates by probability for the target person.',
    `Name: ${context.firstName} ${context.lastName}`,
    `Domain: ${context.domain}`,
    `Role: ${context.role || 'unknown'}`,
    'Candidates:',
    ...candidates.map((candidate, index) => `${index + 1}. ${candidate.email} (${candidate.pattern}, ${candidate.confidence})`),
    'Return only JSON with shape: {"ranked":["email1","email2"]}',
  ].join('\n')

  try {
    const geminiClient = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
    const model = geminiClient.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
    const llmResponse = await model.generateContent(prompt)
    const llmText = llmResponse.response.text()?.trim() ?? ''
    if (!llmText) {
      return fallbackTopTwo
    }

    const cleaned = llmText.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim()
    const firstBrace = cleaned.indexOf('{')
    const lastBrace = cleaned.lastIndexOf('}')
    if (firstBrace === -1 || lastBrace === -1) return fallbackTopTwo

    const parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as {
      ranked?: unknown
    }

    if (!Array.isArray(parsed.ranked)) {
      return fallbackTopTwo
    }

    const rankedEmails = parsed.ranked
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)

    const rankedCandidates: RankedCandidate[] = []
    for (const email of rankedEmails) {
      const candidate = candidates.find((item) => item.email === email)
      if (candidate && !rankedCandidates.some((item) => item.email === candidate.email)) {
        rankedCandidates.push(candidate)
      }
      if (rankedCandidates.length >= 2) break
    }

    if (rankedCandidates.length < 2) {
      for (const fallbackCandidate of fallbackTopTwo) {
        if (!rankedCandidates.some((item) => item.email === fallbackCandidate.email)) {
          rankedCandidates.push(fallbackCandidate)
        }
        if (rankedCandidates.length >= 2) break
      }
    }

    return rankedCandidates.slice(0, 2)
  } catch {
    return fallbackTopTwo
  }
}

function buildSuccessResponse(params: {
  result: EnrichResponse['result']
  domain: string
  companySize: string
  emailProvider: string
  domainSource: string
  patternsChecked: number
}): EnrichResponse {
  return {
    success: true,
    result: params.result,
    domain: params.domain,
    metadata: {
      companySize: params.companySize,
      emailProvider: params.emailProvider,
      domainSource: params.domainSource,
      patternsChecked: params.patternsChecked,
    },
  }
}

function normalizeDomainSourceForAnalytics(source: string): string {
  const normalized = String(source || '').trim().toLowerCase()
  if (normalized === 'known_db' || normalized === 'known-db') return 'known_database'
  if (normalized === 'google-search' || normalized === 'google_search') return 'google_search'
  if (normalized === 'llm') return 'llm_prediction'
  return normalized || 'unknown'
}

function logDomainResolutionAsync(params: {
  userId: string
  companyName: string
  domain: string | null
  domainSource: string
  confidence: number
  layersAttempted: Array<{ layer: string; result: string }>
}): void {
  void (async () => {
    try {
      const supabase = await createServiceRoleClient()
      await supabase.from('domain_resolution_logs').insert({
        user_id: params.userId,
        company_name: params.companyName,
        domain: params.domain,
        domain_source: normalizeDomainSourceForAnalytics(params.domainSource),
        mx_valid: null,
        attempted_layers: params.layersAttempted,
        confidence_score: params.confidence,
      })
    } catch {
      // Fire-and-forget logging should never block API response.
    }
  })()
}

export async function POST(request: NextRequest) {
  try {
    let userId = ''
    try {
      const user = await getAuthenticatedUserFromRequest(request)
      userId = user.id
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
      throw error
    }

    const payload = await request.json().catch(() => null)
    const parsed = enrichSchema.safeParse(payload)

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

    const { firstName, lastName, companyName, role } = parsed.data

    const rl = await checkApiRateLimit(`enrich:${userId}`, 60, 3600)
    if (!rl.allowed) {
      return rateLimitExceeded(rl.resetAt)
    }

    try {
      await incrementEmailGeneration(userId)
    } catch (error) {
      if (error instanceof QuotaExceededError) {
        return quotaExceededResponse(error)
      }
      throw error
    }

    // Phase 1: Domain resolution cascade.
    const resolved = await resolveDomain(companyName)

    if (!resolved) {
      logDomainResolutionAsync({
        userId,
        companyName,
        domain: null,
        domainSource: 'unresolved',
        confidence: 0,
        layersAttempted: [{ layer: 'cascade', result: 'failed' }],
      })

      return NextResponse.json(
        {
          success: false,
          error: 'Could not resolve domain for company. Please provide the company website URL directly.',
          suggestion: true,
        },
        { status: 400 }
      )
    }

    const domain = resolved.domain

    // Phase 2: Pattern generation and ranking.
    const companySize = estimateCompanySize(domain)

    const generatedCandidates = await generateSmartEmailPatternsCached(
      firstName,
      lastName,
      {
        domain,
        estimatedSize: companySize,
      },
      role
    )

    const candidates = dedupeAndFillCandidates(generatedCandidates, firstName, lastName, domain)
    const ranked = await rankWithGeminiOrFallback(candidates, {
      firstName,
      lastName,
      domain,
      role,
    })

    const top = ranked[0] ?? candidates[0]
    if (!top) {
      throw new Error('Failed to generate email candidates')
    }

    // Phase 3: Verification (MX always first, then up to two Abstract checks).
    const mxInfo = await verifyDomainMX(domain)

    if (!mxInfo.hasMX) {
      const response = buildSuccessResponse({
        result: {
          email: top.email,
          pattern: top.pattern,
          confidence: 20,
          verified: false,
          badge: 'domain_no_mx',
          verificationSource: 'mx_only',
        },
        domain,
        companySize,
        emailProvider: mxInfo.provider || 'Unknown',
        domainSource: resolved.source,
        patternsChecked: 1,
      })

      logDomainResolutionAsync({
        userId,
        companyName,
        domain,
        domainSource: resolved.source,
        confidence: resolved.confidence,
        layersAttempted: [{ layer: resolved.source, result: 'hit' }],
      })

      return NextResponse.json(response)
    }

    const emailableKey = process.env.EMAILABLE_API_KEY?.trim()

    if (!emailableKey) {
      const response = buildSuccessResponse({
        result: {
          email: top.email,
          pattern: top.pattern,
          confidence: top.confidence,
          verified: false,
          badge: 'most_probable',
          verificationSource: 'mx_only',
        },
        domain,
        companySize,
        emailProvider: mxInfo.provider || 'Unknown',
        domainSource: resolved.source,
        patternsChecked: 1,
      })

      logDomainResolutionAsync({
        userId,
        companyName,
        domain,
        domainSource: resolved.source,
        confidence: resolved.confidence,
        layersAttempted: [{ layer: resolved.source, result: 'hit' }],
      })

      return NextResponse.json(response)
    }

    const verificationCandidates = ranked.slice(0, 2)
    let checked = 0

    for (const candidate of verificationCandidates) {
      const verification = await verifyEmailEmailable(candidate.email)
      checked += 1

      if (verification.deliverability === 'DELIVERABLE') {
        const response = buildSuccessResponse({
          result: {
            email: candidate.email,
            pattern: candidate.pattern,
            confidence: Math.max(candidate.confidence, 90),
            verified: true,
            badge: 'verified',
            verificationSource: 'emailable',
          },
          domain,
          companySize,
          emailProvider: mxInfo.provider || 'Unknown',
          domainSource: resolved.source,
          patternsChecked: checked,
        })

        logDomainResolutionAsync({
          userId,
          companyName,
          domain,
          domainSource: resolved.source,
          confidence: resolved.confidence,
          layersAttempted: [{ layer: resolved.source, result: 'hit' }],
        })

        return NextResponse.json(response)
      }

      if (checked >= 2) break
    }

    const response = buildSuccessResponse({
      result: {
        email: top.email,
        pattern: top.pattern,
        confidence: top.confidence,
        verified: false,
        badge: 'most_probable',
      },
      domain,
      companySize,
      emailProvider: mxInfo.provider || 'Unknown',
      domainSource: resolved.source,
      patternsChecked: Math.max(1, checked),
    })

    logDomainResolutionAsync({
      userId,
      companyName,
      domain,
      domainSource: resolved.source,
      confidence: resolved.confidence,
      layersAttempted: [{ layer: resolved.source, result: 'hit' }],
    })

    return NextResponse.json(response)
  } catch (error) {
    captureApiException(error, { route: '/api/enrich', method: 'POST' })

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Enrichment failed',
      },
      { status: 500 }
    )
  }
}
