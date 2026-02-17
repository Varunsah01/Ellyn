"use client"

import { useState } from 'react'

import { useSubscription } from '@/context/SubscriptionContext'
import { UpgradePrompt } from './UpgradePrompt'

export function QuotaWarningBanner() {
  const { plan_type, quota, isLoading } = useSubscription()
  const [dismissed, setDismissed] = useState(false)

  if (isLoading || dismissed || plan_type === 'pro') return null

  const emailNearLimit = quota.email.used >= Math.floor(quota.email.limit * 0.8)
  const aiDraftNearLimit = quota.ai_draft.used >= Math.floor(quota.ai_draft.limit * 0.8)

  if (emailNearLimit) {
    return (
      <UpgradePrompt
        variant="banner"
        feature="email_generation"
        used={quota.email.used}
        limit={quota.email.limit}
        onDismiss={() => setDismissed(true)}
      />
    )
  }

  if (aiDraftNearLimit) {
    return (
      <UpgradePrompt
        variant="banner"
        feature="ai_draft"
        used={quota.ai_draft.used}
        limit={quota.ai_draft.limit}
        onDismiss={() => setDismissed(true)}
      />
    )
  }

  return null
}
