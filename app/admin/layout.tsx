import Link from 'next/link'
import { AdminLogoutButton } from '@/components/admin/AdminLogoutButton'

export const metadata = { title: 'Ellyn Admin', robots: 'noindex' }

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 bg-gray-950/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-1">
          <span className="text-xs font-bold text-violet-400 uppercase tracking-widest mr-4">
            Ellyn Admin
          </span>

          <Link href="/admin/dashboard"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5
                       rounded-md hover:bg-gray-800">
            Dashboard
          </Link>
          <Link href="/admin/dashboard/users"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5
                       rounded-md hover:bg-gray-800">
            Users
          </Link>
          <Link href="/admin/dashboard/integrations"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5
                       rounded-md hover:bg-gray-800">
            Integrations
          </Link>
          <Link href="/admin/dashboard/domain-accuracy"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5
                       rounded-md hover:bg-gray-800">
            Domain Accuracy
          </Link>
          <Link href="/admin/dashboard/verification"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5
                       rounded-md hover:bg-gray-800">
            Verification
          </Link>

          <Link href="/admin/dashboard/health"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5
                       rounded-md hover:bg-gray-800">
            Health
          </Link>


          <Link href="/admin/dashboard/settings"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5
                       rounded-md hover:bg-gray-800">
            Settings
          </Link>
          <Link href="/admin/dashboard/webhooks"
            className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5
                       rounded-md hover:bg-gray-800">
            Webhooks
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <Link href="/dashboard"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
              ← Back to app
            </Link>
            <AdminLogoutButton />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}
