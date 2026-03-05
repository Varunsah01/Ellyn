import { NextRequest, NextResponse } from 'next/server'
import { isAdminCredentialConfigValid, validateAdminCredentials } from '@/lib/auth/admin-credentials'
import { createSessionToken, COOKIE_NAME, SESSION_DURATION_MS } from '@/lib/auth/admin-session'

export const dynamic = 'force-dynamic'

// In-memory rate limit: max 5 attempts per IP per 15 minutes
const attempts = new Map<string, { count: number; resetAt: number }>()

export async function POST(request: NextRequest) {
  if (
    !process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD_HASH ||
    !process.env.ADMIN_SESSION_SECRET
  ) {
    return NextResponse.json(
      { error: 'Admin auth is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD_HASH, and ADMIN_SESSION_SECRET in environment variables.' },
      { status: 503 }
    )
  }

  if (!isAdminCredentialConfigValid()) {
    return NextResponse.json(
      { error: 'Admin auth is not securely configured. Ensure ADMIN_PASSWORD_HASH is a valid bcrypt hash.' },
      { status: 503 }
    )
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()
  const record = attempts.get(ip)

  if (record && now < record.resetAt) {
    if (record.count >= 5) {
      return NextResponse.json(
        { error: 'Too many login attempts. Try again in 15 minutes.' },
        { status: 429 }
      )
    }
    record.count++
  } else {
    attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 })
  }

  let body: { username?: string; password?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { username = '', password = '' } = body

  if (!validateAdminCredentials(username.trim(), password)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  attempts.delete(ip)

  const token = createSessionToken(username.trim())

  const response = NextResponse.json({ success: true })
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS / 1000,
    path: '/',
  })

  return response
}
