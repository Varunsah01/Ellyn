import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { applyCsrfProtection } from '@/lib/csrf'
import { applyRateLimitHeaders, enforceRateLimit, extractUserIdFromRequest } from '@/middleware/rate-limit'

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isApiRoute = pathname === '/api' || pathname.startsWith('/api/')
  const isVersionedApiRoute = pathname === '/api/v1' || pathname.startsWith('/api/v1/')
  const isUnversionedApiRoute = isApiRoute && !isVersionedApiRoute && pathname !== '/api'
  const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/')

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })
  let authenticatedUserId: string | null = extractUserIdFromRequest(request)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  const missingAuthConfig = !supabaseUrl || !supabaseAnonKey
  const isProtectedRoute = isApiRoute || isDashboardRoute

  if (missingAuthConfig && isProtectedRoute) {
    console.error('[middleware] Blocking protected route because Supabase auth config is missing.', {
      path: pathname,
      method: request.method,
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseAnonKey: Boolean(supabaseAnonKey),
    })

    if (isApiRoute) {
      return NextResponse.json(
        { error: 'Service unavailable: authentication is not configured.' },
        { status: 503 }
      )
    }

    const setupRequiredUrl = new URL('/setup-required', request.url)
    setupRequiredUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(setupRequiredUrl, { status: 307 })
  }

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })

          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })

          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user?.id) {
      authenticatedUserId = user.id
    }
  }

  const csrfErrorResponse = await applyCsrfProtection(request, response)
  if (csrfErrorResponse) {
    return csrfErrorResponse
  }

  if (isApiRoute) {
    const rateLimit = await enforceRateLimit(request, {
      userId: authenticatedUserId,
    })

    if (rateLimit.response) {
      return rateLimit.response
    }

    applyRateLimitHeaders(response, rateLimit.headers)

    if (isUnversionedApiRoute) {
      const rewrittenUrl = request.nextUrl.clone()
      rewrittenUrl.pathname = `/api/v1${pathname.slice('/api'.length)}`

      const rewriteResponse = NextResponse.rewrite(rewrittenUrl)
      response.cookies.getAll().forEach((cookie) => rewriteResponse.cookies.set(cookie))
      const csrfToken = response.headers.get('X-CSRF-Token')
      if (csrfToken) {
        rewriteResponse.headers.set('X-CSRF-Token', csrfToken)
      }
      applyRateLimitHeaders(rewriteResponse, rateLimit.headers)
      return rewriteResponse
    }
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*', '/auth/:path*', '/contact/:path*', '/api/:path*'],
}
