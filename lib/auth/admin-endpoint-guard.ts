import { NextRequest, NextResponse } from 'next/server'

type AdminGuardResult =
  | { ok: true; clientIp: string }
  | { ok: false; response: NextResponse }

function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim()
    if (first) return normalizeIp(first)
  }

  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) {
    return normalizeIp(realIp)
  }

  return 'unknown'
}

function normalizeIp(rawIp: string): string {
  let ip = rawIp.trim()
  if (!ip) return 'unknown'

  if (ip.startsWith('[') && ip.includes(']')) {
    ip = ip.slice(1, ip.indexOf(']'))
  }

  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7)
  }

  const colonCount = (ip.match(/:/g) || []).length
  if (colonCount === 1 && ip.includes('.')) {
    ip = ip.split(':')[0] ?? ip
  }

  return ip
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return null

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) return null

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

function secureEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return diff === 0
}

function parseIpWhitelist(): string[] {
  const raw = process.env.ADMIN_IP_WHITELIST?.trim()
  if (!raw) return []

  return raw
    .split(',')
    .map((ip) => normalizeIp(ip))
    .filter(Boolean)
}

/**
 * Require admin endpoint access.
 * @param {NextRequest} request - Request input.
 * @returns {AdminGuardResult} Computed AdminGuardResult.
 * @example
 * requireAdminEndpointAccess(request)
 */
export function requireAdminEndpointAccess(request: NextRequest): AdminGuardResult {
  const debugEnabled = process.env.ENABLE_DEBUG_ENDPOINTS?.trim().toLowerCase() === 'true'
  if (!debugEnabled) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Not Found' }, { status: 404 }),
    }
  }

  const secretToken = process.env.SECRET_ADMIN_TOKEN?.trim()
  if (!secretToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'SECRET_ADMIN_TOKEN is not configured' },
        { status: 503 }
      ),
    }
  }

  const suppliedToken = extractBearerToken(request)
  if (!suppliedToken || !secureEquals(suppliedToken, secretToken)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const clientIp = getClientIp(request)
  const whitelist = parseIpWhitelist()
  if (whitelist.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'ADMIN_IP_WHITELIST is not configured' },
        { status: 503 }
      ),
    }
  }

  if (!whitelist.includes('*') && !whitelist.includes(clientIp)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { ok: true, clientIp }
}

type AdminEndpointGuardResult = {
  allowed: boolean
  response: NextResponse | null
  clientIp?: string
}

/**
 * Backward-compatible async admin guard helper.
 * Normalizes result shape for routes expecting `{ allowed, response }`.
 */
export async function adminEndpointGuard(
  request: NextRequest | Request
): Promise<AdminEndpointGuardResult> {
  const guard = requireAdminEndpointAccess(request as NextRequest)
  if (guard.ok) {
    return { allowed: true, response: null, clientIp: guard.clientIp }
  }

  return { allowed: false, response: guard.response }
}
