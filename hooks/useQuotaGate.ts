"use client"

import { useCallback, useState } from 'react'

import { useSubscription } from '@/context/SubscriptionContext'
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt'

type Feature = 'email_generation' | 'ai_draft'

export function useQuotaGate(feature: Feature) {
  const { plan_type, quota } = useSubscription()
  const [modalOpen, setModalOpen] = useState(false)

  const quotaForFeature = feature === 'email_generation' ? quota.email : quota.ai_draft
  const remaining = quotaForFeature.limit - quotaForFeature.used
  const canUse = remaining > 0 || plan_type === 'pro'

  const openUpgradeModal = useCallback(() => {
    setModalOpen(true)
  }, [])

  const UpgradeModal = modalOpen
    ? () =>
        UpgradePrompt({
          variant: 'modal',
          feature,
          used: quotaForFeature.used,
          limit: quotaForFeature.limit,
          open: modalOpen,
          onDismiss: () => setModalOpen(false),
        })
    : null

  return {
    canUse,
    used: quotaForFeature.used,
    limit: quotaForFeature.limit,
    remaining,
    openUpgradeModal,
    UpgradeModal,
  }
}
