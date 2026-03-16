import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { getAdminSessionFromRequest } from '@/lib/auth/admin-session'
import {
  ADMIN_LOOKUP_COST_EFFICIENCY_BOUNDS,
  getAdminRuntimeSettings,
  updateAdminRuntimeSettings,
} from '@/lib/admin/runtime-settings'

const SectionUpdateSchema = z.discriminatedUnion('section', [
  z.object({
    section: z.literal('fallbacks'),
    deepseekR1Enabled: z.boolean(),
  }),
  z.object({
    section: z.literal('lookup_cost'),
    lookupCostEfficiencyTarget: z
      .number()
      .int()
      .min(ADMIN_LOOKUP_COST_EFFICIENCY_BOUNDS.min)
      .max(ADMIN_LOOKUP_COST_EFFICIENCY_BOUNDS.max),
  }),
  z.object({
    section: z.literal('ip_whitelist'),
    adminIpWhitelist: z.array(z.string().min(1)).max(500),
  }),
])

async function requireAdminSession(request: NextRequest): Promise<NextResponse | null> {
  const session = await getAdminSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}

export async function GET(request: NextRequest) {
  const authError = await requireAdminSession(request)
  if (authError) return authError

  return NextResponse.json({
    success: true,
    data: getAdminRuntimeSettings(),
    bounds: ADMIN_LOOKUP_COST_EFFICIENCY_BOUNDS,
  })
}

export async function PATCH(request: NextRequest) {
  const authError = await requireAdminSession(request)
  if (authError) return authError

  const body = await request.json().catch(() => null)
  const parsed = SectionUpdateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const update = parsed.data

  if (update.section === 'fallbacks') {
    return NextResponse.json({
      success: true,
      data: updateAdminRuntimeSettings({ deepseekR1Enabled: update.deepseekR1Enabled }),
    })
  }

  if (update.section === 'lookup_cost') {
    return NextResponse.json({
      success: true,
      data: updateAdminRuntimeSettings({ lookupCostEfficiencyTarget: update.lookupCostEfficiencyTarget }),
    })
  }

  return NextResponse.json({
    success: true,
    data: updateAdminRuntimeSettings({ adminIpWhitelist: update.adminIpWhitelist }),
  })
}
