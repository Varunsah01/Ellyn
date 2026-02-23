import { NextRequest, NextResponse } from 'next/server'

import {
  authenticateExtensionRequest,
  buildContactUpsertPayload,
  buildRateLimitHeaders,
  consumeUserSyncRateLimit,
  optionsWithCors,
  parseExtensionContactData,
  withCors,
} from '@/app/api/extension/_lib/sync-utils'

export const runtime = 'nodejs'

export async function OPTIONS(request: NextRequest) {
  return optionsWithCors(request)
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateExtensionRequest(request)
  if (!authResult.ok) {
    return authResult.response
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return withCors(
      request,
      NextResponse.json(
        {
          error: 'Invalid JSON body',
        },
        { status: 400 }
      )
    )
  }

  const parsed = parseExtensionContactData(body)
  if (!parsed.data || parsed.error) {
    return withCors(
      request,
      NextResponse.json(
        {
          error: parsed.error || 'Invalid contact payload',
        },
        { status: 400 }
      )
    )
  }

  const rateLimit = consumeUserSyncRateLimit(authResult.user.id, 1)
  const rateLimitHeaders = buildRateLimitHeaders(rateLimit)
  if (!rateLimit.allowed) {
    return withCors(
      request,
      NextResponse.json(
        {
          error: 'Rate limit exceeded. Maximum 100 contacts per hour.',
        },
        { status: 429 }
      ),
      rateLimitHeaders
    )
  }

  const payload = buildContactUpsertPayload(parsed.data, authResult.user.id)

  const { data, error } = await authResult.supabase
    .from('contacts')
    .upsert(payload, {
      onConflict: 'user_id,first_name,last_name,company',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (error) {
    return withCors(
      request,
      NextResponse.json(
        {
          error: error.message,
        },
        { status: 500 }
      ),
      rateLimitHeaders
    )
  }

  // Best-effort heartbeat for extension connection diagnostics.
  await authResult.supabase.rpc('extension_heartbeat', {
    p_user_id: authResult.user.id,
  })

  return withCors(
    request,
    NextResponse.json(
      {
        contact: data,
      },
      { status: 200 }
    ),
    rateLimitHeaders
  )
}
