import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { adminEndpointGuard } from '@/lib/auth/admin-endpoint-guard'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { captureApiException } from '@/lib/monitoring/sentry'

const PatternSchema = z.object({
  company_domain: z.string().min(1).max(255),
  pattern: z.string().min(1).max(50),
  success_count: z.number().int().min(0).default(0),
  failure_count: z.number().int().min(0).default(0),
  confidence_boost: z.number().int().min(-30).max(30).default(0),
})

const RequestSchema = z.object({
  patterns: z.array(PatternSchema).min(1).max(5000),
})

const BATCH_SIZE = 100

export async function POST(request: NextRequest) {
  const guard = await adminEndpointGuard(request)
  if (!guard.allowed) return guard.response!

  try {
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { patterns } = parsed.data
    const supabase = await createServiceRoleClient()

    let totalUpserted = 0
    const errors: string[] = []

    for (let i = 0; i < patterns.length; i += BATCH_SIZE) {
      const batch = patterns.slice(i, i + BATCH_SIZE).map((p) => ({
        company_domain: p.company_domain,
        pattern: p.pattern,
        success_count: p.success_count,
        failure_count: p.failure_count,
        confidence_boost: p.confidence_boost,
        injected: true,
        last_verified: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase
        .from('learned_patterns')
        .upsert(batch, { onConflict: 'company_domain,pattern' })

      if (error) {
        errors.push(`Batch ${i / BATCH_SIZE + 1}: ${error.message}`)
      } else {
        totalUpserted += batch.length
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      upserted: totalUpserted,
      total: patterns.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    captureApiException(error, { route: '/api/admin/inject-patterns', method: 'POST' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
