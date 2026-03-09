import 'server-only'

import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) {
    return false
  }

  try {
    return timingSafeEqual(leftBuffer, rightBuffer)
  } catch {
    return false
  }
}

export function requireAdminApiSecret(request: NextRequest): NextResponse | null {
  const configured = process.env.ADMIN_API_SECRET?.trim()
  if (!configured) {
    return NextResponse.json(
      { error: 'ADMIN_API_SECRET is not configured' },
      { status: 503 }
    )
  }

  const provided = request.headers.get('x-admin-secret')?.trim() || ''
  if (!provided || !safeCompare(provided, configured)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}
