"use client"

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type PlanType = 'free' | 'starter' | 'pro'

export type QuotaInfo = {
  email: { used: number; limit: number }
  ai_draft: { used: number; limit: number }
  reset_date: string | null
}

export type SubscriptionState = {
  plan_type: PlanType
  subscription_status: string | null
  current_period_end: string | null
  quota: QuotaInfo
  isLoading: boolean
  refresh: () => void
}

const defaultState: SubscriptionState = {
  plan_type: 'free',
  subscription_status: null,
  current_period_end: null,
  quota: {
    email: { used: 0, limit: 50 },
    ai_draft: { used: 0, limit: 0 },
    reset_date: null,
  },
  isLoading: true,
  refresh: () => {},
}

const SubscriptionContext = createContext<SubscriptionState>(defaultState)

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<SubscriptionState, 'refresh'>>({
    plan_type: 'free',
    subscription_status: null,
    current_period_end: null,
    quota: {
      email: { used: 0, limit: 50 },
      ai_draft: { used: 0, limit: 0 },
      reset_date: null,
    },
    isLoading: true,
  })

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/subscription/status')
      if (!res.ok) return
      const data = await res.json()
      setState({
        plan_type: data.plan_type ?? 'free',
        subscription_status: data.subscription_status ?? null,
        current_period_end: data.current_period_end ?? null,
        quota: data.quota ?? {
          email: { used: 0, limit: 50 },
          ai_draft: { used: 0, limit: 0 },
          reset_date: null,
        },
        isLoading: false,
      })
    } catch {
      setState((prev) => ({ ...prev, isLoading: false }))
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  return (
    <SubscriptionContext.Provider value={{ ...state, refresh: fetchStatus }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

export function useSubscription() {
  return useContext(SubscriptionContext)
}
