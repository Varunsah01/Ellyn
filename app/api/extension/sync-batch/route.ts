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

interface SyncBatchRequestBody {
  contacts?: unknown
}

export async function OPTIONS(request: NextRequest) {
  return optionsWithCors(request)
}

export async function POST(request: NextRequest) {
  const authResult = await authenticateExtensionRequest(request)
  if (!authResult.ok) {
    return authResult.response
  }

  let body: SyncBatchRequestBody
  try {
    body = (await request.json()) as SyncBatchRequestBody
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

  const contacts = Array.isArray(body?.contacts) ? body.contacts : null
  if (!contacts) {
    return withCors(
      request,
      NextResponse.json(
        {
          error: 'contacts array required',
        },
        { status: 400 }
      )
    )
  }

  if (contacts.length === 0) {
    return withCors(
      request,
      NextResponse.json(
        {
          error: 'contacts array cannot be empty',
        },
        { status: 400 }
      )
    )
  }

  const rateLimit = consumeUserSyncRateLimit(authResult.user.id, contacts.length)
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

  let synced = 0
  const errors: string[] = []

  for (let index = 0; index < contacts.length; index += 1) {
    const rawContact = contacts[index]
    const parsed = parseExtensionContactData(rawContact)

    if (!parsed.data || parsed.error) {
      errors.push(`contacts[${index}]: ${parsed.error || 'Invalid contact payload'}`)
      continue
    }

    const payload = buildContactUpsertPayload(parsed.data, authResult.user.id)

    const { error } = await authResult.supabase
      .from('contacts')
      .upsert(payload, {
        onConflict: 'user_id,first_name,last_name,company',
        ignoreDuplicates: false,
      })
      .select('id')
      .single()

    if (error) {
      errors.push(`contacts[${index}]: ${error.message}`)
      continue
    }

    synced += 1
  }

  if (synced > 0) {
    // Best-effort heartbeat for extension connection diagnostics.
    await authResult.supabase.rpc('extension_heartbeat', {
      p_user_id: authResult.user.id,
    })
  }

  return withCors(
    request,
    NextResponse.json({
      synced,
      errors,
    }),
    rateLimitHeaders
  )
}
