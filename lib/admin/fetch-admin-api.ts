import 'server-only'

// Server-side fetch helper for admin API routes.
// Forwards the session cookie so admin routes stay authenticated.
// Used only in Server Components inside /admin/dashboard.

import { cookies } from 'next/headers'

export async function fetchAdminApi<T>(path: string): Promise<T> {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll()
    .map(c => `${c.name}=${c.value}`)
    .join('; ')

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')

  const headers: Record<string, string> = { Cookie: cookieHeader }

  // Fail closed: verification admin routes require this header.
  const adminSecret = process.env.ADMIN_API_SECRET?.trim()
  if (!adminSecret) {
    throw new Error('ADMIN_API_SECRET is required for admin API requests')
  }
  headers['x-admin-secret'] = adminSecret

  const res = await fetch(`${baseUrl}${path}`, {
    cache: 'no-store',
    headers,
  })

  if (!res.ok) throw new Error(`Admin API error: ${path} -> ${res.status}`)
  return res.json() as Promise<T>
}
