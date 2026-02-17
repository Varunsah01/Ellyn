import { cn } from '@/lib/utils'

type PlanBadgeProps = {
  plan: 'free' | 'pro'
  className?: string
}

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  if (plan === 'pro') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
          'bg-gradient-to-r from-blue-500 to-purple-600 text-white',
          className
        )}
      >
        ✦ Pro
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        'bg-muted text-muted-foreground',
        className
      )}
    >
      Free
    </span>
  )
}
