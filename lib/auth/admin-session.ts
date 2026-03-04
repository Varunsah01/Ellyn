import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

export const COOKIE_NAME = 'ellyn_admin_session'
export const SESSION_DURATION_MS = 8 * 60 * 60 * 1000 // 8 hours

function getSecret(): Buffer {
  const hex = process.env.ADMIN_SESSION_SECRET?.trim()
  if (!hex || hex.length < 32) {
    throw new Error('ADMIN_SESSION_SECRET must be at least 32 characters')
  }
  return Buffer.from(hex, 'utf-8')
}

function sign(payload: string): string {
  const sig = createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url')
  return `${payload}.${sig}`
}

function verify(token: string): string | null {
  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return null
  const payload = token.slice(0, lastDot)
  const provided = token.slice(lastDot + 1)
  const expected = createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url')
  try {
    if (!timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return payload
}

export function createSessionToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ username, exp: Date.now() + SESSION_DURATION_MS })
  ).toString('base64url')
  return sign(payload)
}

export function parseSessionToken(token: string): string | null {
  const payload = verify(token)
  if (!payload) return null
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'))
    if (typeof data.exp !== 'number' || Date.now() > data.exp) return null
    return data.username ?? null
  } catch {
    return null
  }
}

export async function getAdminSession(): Promise<string | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return parseSessionToken(token)
}

export function getAdminSessionFromRequest(request: NextRequest): string | null {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return parseSessionToken(token)
}
