import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Server-side layout that gates all /admin/* pages.
 *
 * Auth rules (applied in order):
 *  1. Must be signed in — redirects to /auth/login if not.
 *  2. If ADMIN_EMAILS env var is set (comma-separated list), the user's email
 *     must appear in that list — redirects to /dashboard if not.
 *  3. If ADMIN_EMAILS is empty/unset, any authenticated user is treated as
 *     admin (useful for single-owner deployments).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()

  const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    redirect('/dashboard')
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      // Server components cannot mutate cookies — no-op is intentional
      setAll() {},
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/admin')
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)

  if (adminEmails.length > 0 && !adminEmails.includes((user.email ?? '').toLowerCase())) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-6">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Admin
          </span>
          <a
            href="/admin/domain-accuracy"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Domain Accuracy
          </a>
          <a
            href="/admin/verification-stats"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Verification Stats
          </a>
          <div className="ml-auto">
            <a
              href="/dashboard"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to app
            </a>
          </div>
        </div>
      </nav>
      {children}
    </div>
  )
}
