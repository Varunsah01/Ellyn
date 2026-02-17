"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { PlanBadge } from '@/components/subscription/PlanBadge'
import { useSubscription } from '@/context/SubscriptionContext'

const settingsNav = [
  { label: 'Account', href: '/dashboard/settings' },
  { label: 'Billing & Plan', href: '/dashboard/settings/billing' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { plan_type } = useSubscription()

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="hidden w-48 shrink-0 md:block">
        <nav className="space-y-1">
          {settingsNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <span>{item.label}</span>
              {item.href === '/dashboard/settings/billing' && (
                <PlanBadge plan={plan_type === 'pro' ? 'pro' : 'free'} />
              )}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile tab navigation */}
      <div className="flex gap-1 md:hidden border-b pb-2 mb-2 w-full flex-wrap">
        {settingsNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              pathname === item.href
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Page content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
