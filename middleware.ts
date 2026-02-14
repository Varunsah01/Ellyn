import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  // Keep middleware no-op if environment variables are not configured yet.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

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

  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*'],
}

