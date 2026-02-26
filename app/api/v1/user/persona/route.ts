import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { checkApiRateLimit, rateLimitExceeded } from '@/lib/rate-limit'

const patchSchema = z.object({
  persona: z.enum(['job_seeker', 'smb_sales']),
})

const PERSONA_SELECTED_STEP = 'persona_selected'

type PersonaValue = z.infer<typeof patchSchema>['persona']

type PersonaProfileRow = {
  persona: PersonaValue | null
  onboarding_completed: boolean | null
  onboarding_steps_completed: string[] | null
  extension_last_seen: string | null
}

type PersonaMutationRow = {
  persona: PersonaValue | null
  onboarding_steps_completed: string[] | null
}

function normalizeSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

export async function GET() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('persona, onboarding_completed, onboarding_steps_completed, extension_last_seen')
    .eq('id', user.id)
    .maybeSingle<PersonaProfileRow>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({
      persona: null,
      onboarding_completed: false,
      onboarding_steps_completed: [],
      extension_last_seen: null,
    })
  }

  return NextResponse.json({
    persona: data.persona,
    onboarding_completed: Boolean(data.onboarding_completed),
    onboarding_steps_completed: normalizeSteps(data.onboarding_steps_completed),
    extension_last_seen: data.extension_last_seen,
  })
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limit: 10 persona changes/hour per user
  const rl = await checkApiRateLimit(`persona:${user.id}`, 10, 3600)
  if (!rl.allowed) return rateLimitExceeded(rl.resetAt)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServiceRoleClient()

  const { data: existing, error: existingError } = await supabase
    .from('user_profiles')
    .select('persona, onboarding_steps_completed')
    .eq('id', user.id)
    .maybeSingle<PersonaMutationRow>()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  const existingSteps = normalizeSteps(existing?.onboarding_steps_completed)
  const isFirstPersonaSet =
    !existing || existing.persona === null || existing.persona === 'job_seeker'
  const shouldAppendPersonaStep =
    isFirstPersonaSet && !existingSteps.includes(PERSONA_SELECTED_STEP)
  const nextSteps = shouldAppendPersonaStep
    ? [...existingSteps, PERSONA_SELECTED_STEP]
    : existingSteps

  const updatePayload: {
    id: string
    persona: PersonaValue
    updated_at: string
    onboarding_steps_completed?: string[]
  } = {
    id: user.id,
    persona: parsed.data.persona,
    updated_at: new Date().toISOString(),
  }

  if (shouldAppendPersonaStep || !existing) {
    updatePayload.onboarding_steps_completed = nextSteps
  }

  const { data: updated, error: updateError } = await supabase
    .from('user_profiles')
    .upsert(updatePayload, { onConflict: 'id' })
    .select('persona, onboarding_steps_completed')
    .single<PersonaMutationRow>()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    persona: updated.persona ?? parsed.data.persona,
    onboarding_steps_completed: normalizeSteps(
      updated.onboarding_steps_completed ?? nextSteps
    ),
  })
}
