import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

import { getAuthenticatedUserFromRequest } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

type AllowedResult = { allowed: true; user: User }
type DeniedResult = { allowed: false; user?: never; response: NextResponse }
type PersonaGuardResult = AllowedResult | DeniedResult

export async function requirePersona(
  request: Request,
  requiredPersona: 'job_seeker' | 'smb_sales'
): Promise<PersonaGuardResult> {
  let user: User
  try {
    user = await getAuthenticatedUserFromRequest(request)
  } catch {
    return {
      allowed: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const supabase = await createServiceRoleClient()
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('persona')
    .eq('id', user.id)
    .single()

  if (profile?.persona !== requiredPersona) {
    return {
      allowed: false,
      response: NextResponse.json(
        { error: `This feature requires ${requiredPersona} mode` },
        { status: 403 }
      ),
    }
  }

  return { allowed: true, user }
}
