import { NextRequest, NextResponse } from 'next/server'
import { clear } from '@/lib/cache/redis'
import { captureApiException } from '@/lib/monitoring/sentry'

export const dynamic = 'force-dynamic'

const EMAIL_VERIFICATION_PATTERN = 'email:verification:*'
const MX_VERIFICATION_PATTERN    = 'cache:mx-verification:*'

/**
 * DELETE /api/admin/verification-cache
 *
 * Purges verification caches from Redis/in-memory store.
 * Accepts an optional `?scope=email|mx|all` query param (default: email).
 *
 * Protected by the same x-admin-secret guard used across admin routes.
 */
export async function DELETE(request: NextRequest) {
  const adminSecret = process.env.ADMIN_API_SECRET?.trim()
  if (adminSecret) {
    const provided = request.headers.get('x-admin-secret')?.trim()
    if (provided !== adminSecret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const scope = request.nextUrl.searchParams.get('scope') ?? 'email'

  try {
    let deleted = 0

    if (scope === 'email' || scope === 'all') {
      deleted += await clear(EMAIL_VERIFICATION_PATTERN)
    }
    if (scope === 'mx' || scope === 'all') {
      deleted += await clear(MX_VERIFICATION_PATTERN)
    }

    console.log(`[verification-cache] Purged ${deleted} keys (scope=${scope})`)

    return NextResponse.json({
      success: true,
      deleted,
      scope,
      clearedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[verification-cache] Clear failed:', err)
    captureApiException(err, { route: '/api/admin/verification-cache', method: 'DELETE' })
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 })
  }
}
