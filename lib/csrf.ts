import csrf from 'edge-csrf'
import { NextRequest, NextResponse } from 'next/server'

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export const CSRF_HEADER_NAME = 'X-CSRF-Token'
export const CSRF_FORM_FIELD = '_csrf'
export const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_SECRET_COOKIE_NAME = '_csrfSecret'

function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase())
}

function parseCsrfTokenFromJsonBody(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return ''

  const asObj = payload as Record<string, unknown>
  const rawValue = asObj[CSRF_FORM_FIELD] ?? asObj.csrf_token ?? asObj.csrfToken
  return typeof rawValue === 'string' ? rawValue : ''
}

async function getTokenFromRequestBody(request: NextRequest): Promise<string> {
  const contentType = (request.headers.get('content-type') || '').toLowerCase()

  if (contentType.includes('application/json') || contentType.includes('application/ld+json')) {
    try {
      const body = await request.clone().json()
      return parseCsrfTokenFromJsonBody(body)
    } catch {
      return ''
    }
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    try {
      const formData = await request.clone().formData()
      const rawValue =
        formData.get(CSRF_FORM_FIELD) ??
        formData.get('csrf_token') ??
        formData.get('csrfToken')
      return typeof rawValue === 'string' ? rawValue : ''
    } catch {
      return ''
    }
  }

  return ''
}

function shouldBypassCsrfValidation(request: NextRequest): boolean {
  if (!isMutatingMethod(request.method)) return false

  const hasSecretCookie = Boolean(request.cookies.get(CSRF_SECRET_COOKIE_NAME)?.value)
  const hasBearerAuth = /^Bearer\s+.+/i.test(request.headers.get('authorization') || '')

  // Bearer-token clients (extensions/external integrations) are not cookie-authenticated
  // and are generally not vulnerable to CSRF in the browser sense.
  return hasBearerAuth && !hasSecretCookie
}

const csrfProtect = csrf({
  cookie: {
    name: CSRF_SECRET_COOKIE_NAME,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    httpOnly: true,
    path: '/',
  },
  token: {
    responseHeader: CSRF_HEADER_NAME,
    value: async (request) => {
      const headerToken = request.headers.get(CSRF_HEADER_NAME) || request.headers.get('x-csrf-token')
      if (headerToken) return headerToken
      return getTokenFromRequestBody(request)
    },
  },
})

/**
 * Apply csrf protection.
 * @param {NextRequest} request - Request input.
 * @param {NextResponse} response - Response input.
 * @returns {Promise<NextResponse | null>} Computed Promise<NextResponse | null>.
 * @throws {Error} If the operation fails.
 * @example
 * applyCsrfProtection(request, {})
 */
export async function applyCsrfProtection(
  request: NextRequest,
  response: NextResponse
): Promise<NextResponse | null> {
  if (shouldBypassCsrfValidation(request)) {
    return null
  }

  const csrfError = await csrfProtect(request, response)
  if (csrfError) {
    return NextResponse.json(
      {
        version: '1',
        data: {
          success: false,
          error: 'Invalid CSRF token',
          code: 'CSRF_INVALID',
        },
        success: false,
        error: 'Invalid CSRF token',
        code: 'CSRF_INVALID',
      },
      { status: 403 }
    )
  }

  const token = response.headers.get(CSRF_HEADER_NAME)
  if (token) {
    response.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: token,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      httpOnly: false,
      path: '/',
    })
  }

  return null
}

/**
 * Get csrf token from document.
 * @returns {string} Computed string.
 * @example
 * getCsrfTokenFromDocument()
 */
export function getCsrfTokenFromDocument(): string {
  if (typeof document === 'undefined') return ''

  const tokens = document.cookie.split(';')
  for (const token of tokens) {
    const [key, ...rest] = token.trim().split('=')
    if (key !== CSRF_COOKIE_NAME) continue
    return decodeURIComponent(rest.join('=') || '')
  }

  return ''
}

/**
 * With csrf headers.
 * @param {RequestInit} init - Init input.
 * @returns {RequestInit} Computed RequestInit.
 * @example
 * withCsrfHeaders(request)
 */
export function withCsrfHeaders(init?: RequestInit): RequestInit {
  const method = String(init?.method || 'GET').toUpperCase()
  if (!isMutatingMethod(method)) {
    return init || {}
  }

  const token = getCsrfTokenFromDocument()
  if (!token) {
    return init || {}
  }

  const headers = new Headers(init?.headers || {})
  if (!headers.has(CSRF_HEADER_NAME)) {
    headers.set(CSRF_HEADER_NAME, token)
  }

  return {
    ...(init || {}),
    headers,
  }
}

