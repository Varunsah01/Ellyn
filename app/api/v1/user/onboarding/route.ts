import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

const stepSchema = z.object({
  step: z.enum([
    'persona_selected',
    'extension_installed',
    'first_contact',
    'first_draft',
    'first_sequence',
    'profile_complete',
  ]),
})

const ALL_ONBOARDING_STEPS = [
  'persona_selected',
  'extension_installed',
  'first_contact',
  'first_draft',
  'first_sequence',
  'profile_complete',
] as const

type OnboardingStep = (typeof ALL_ONBOARDING_STEPS)[number]

type OnboardingProfileRow = {
  onboarding_completed: boolean | null
  onboarding_steps_completed: string[] | null
}

function normalizeSteps(value: unknown): OnboardingStep[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set<string>(ALL_ONBOARDING_STEPS)
  return value.filter(
    (item): item is OnboardingStep =>
      typeof item === 'string' && allowed.has(item)
  )
}

function areAllStepsComplete(steps: readonly string[]): boolean {
  return ALL_ONBOARDING_STEPS.every((step) => steps.includes(step))
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

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = stepSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const supabase = await createServiceRoleClient()
  const { data: existing, error: existingError } = await supabase
    .from('user_profiles')
    .select('onboarding_completed, onboarding_steps_completed')
    .eq('id', user.id)
    .maybeSingle<OnboardingProfileRow>()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  const existingSteps = normalizeSteps(existing?.onboarding_steps_completed)
  const nextSteps = existingSteps.includes(parsed.data.step)
    ? existingSteps
    : [...existingSteps, parsed.data.step]
  const onboardingCompleted =
    Boolean(existing?.onboarding_completed) || areAllStepsComplete(nextSteps)

  const { data: updated, error: updateError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: user.id,
        onboarding_steps_completed: nextSteps,
        onboarding_completed: onboardingCompleted,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('onboarding_steps_completed, onboarding_completed')
    .single<OnboardingProfileRow>()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    steps_completed: normalizeSteps(updated.onboarding_steps_completed),
    onboarding_completed: Boolean(updated.onboarding_completed),
  })
}

export async function PATCH() {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = await createServiceRoleClient()
  const { data: existing, error: existingError } = await supabase
    .from('user_profiles')
    .select('onboarding_steps_completed')
    .eq('id', user.id)
    .maybeSingle<{ onboarding_steps_completed: string[] | null }>()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  const steps = normalizeSteps(existing?.onboarding_steps_completed)
  const { data: updated, error: updateError } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: user.id,
        onboarding_completed: true,
        onboarding_steps_completed: steps,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('onboarding_steps_completed, onboarding_completed')
    .single<OnboardingProfileRow>()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({
    steps_completed: normalizeSteps(updated.onboarding_steps_completed),
    onboarding_completed: Boolean(updated.onboarding_completed),
  })
}
