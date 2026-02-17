"use client"

import Link from 'next/link'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog'

type UpgradePromptProps = {
  variant: 'banner' | 'modal'
  feature: string
  used: number
  limit: number
  open?: boolean
  onDismiss?: () => void
}

export function UpgradePrompt({ variant, feature, used, limit, open, onDismiss }: UpgradePromptProps) {
  const featureLabel = feature === 'email_generation' ? 'email generations' : 'AI draft generations'
  const message = `You've used ${used} of ${limit} ${featureLabel} this month.`

  if (variant === 'modal') {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onDismiss?.() }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upgrade to Pro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-sm text-muted-foreground">
              Upgrade to Pro to unlock higher limits and premium features.
            </p>
            <div className="flex gap-3">
              <Button asChild className="flex-1">
                <Link href="/dashboard/upgrade">Upgrade to Pro</Link>
              </Button>
              <Button variant="outline" onClick={onDismiss}>
                Maybe later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2">
      <p className="text-sm text-amber-800 font-medium">
        {message}{' '}
        <Link href="/dashboard/upgrade" className="underline font-semibold hover:text-amber-900">
          Upgrade to Pro
        </Link>
      </p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="ml-4 text-amber-600 hover:text-amber-800"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
