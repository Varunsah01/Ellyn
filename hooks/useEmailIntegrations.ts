'use client'

import { useState, useEffect, useCallback } from 'react'
import type { GmailStatus, OutlookStatus } from '@/lib/types/integrations'

export interface IntegrationStatus {
  connected: boolean
  email: string | null
  connectedAt: string | null
  loading: boolean
  error: string | null
}

const DEFAULT_STATE: IntegrationStatus = {
  connected: false,
  email: null,
  connectedAt: null,
  loading: true,
  error: null,
}

export function useEmailIntegrations() {
  const [gmail, setGmail] = useState<IntegrationStatus>(DEFAULT_STATE)
  const [outlook, setOutlook] = useState<IntegrationStatus>(DEFAULT_STATE)

  const fetchStatus = useCallback(async () => {
    // Fetch both in parallel — never let one failure block the other
    const [gmailRes, outlookRes] = await Promise.allSettled([
      fetch('/api/gmail/status'),
      fetch('/api/outlook/status'),
    ])

    if (gmailRes.status === 'fulfilled' && gmailRes.value.ok) {
      const data: GmailStatus = await gmailRes.value.json()
      setGmail({
        connected: data.connected,
        email: data.gmailEmail ?? null,
        connectedAt: data.connectedAt ?? null,
        loading: false,
        error: null,
      })
    } else {
      setGmail(prev => ({ ...prev, loading: false, error: 'Could not load Gmail status' }))
    }

    if (outlookRes.status === 'fulfilled' && outlookRes.value.ok) {
      const data: OutlookStatus = await outlookRes.value.json()
      setOutlook({
        connected: data.connected,
        email: data.outlookEmail ?? null,
        connectedAt: data.connectedAt ?? null,
        loading: false,
        error: null,
      })
    } else {
      setOutlook(prev => ({ ...prev, loading: false, error: 'Could not load Outlook status' }))
    }
  }, [])

  useEffect(() => { void fetchStatus() }, [fetchStatus])

  const disconnectGmail = async () => {
    setGmail(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch('/api/gmail/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Disconnect failed')
      setGmail({ connected: false, email: null, connectedAt: null, loading: false, error: null })
    } catch {
      setGmail(prev => ({ ...prev, loading: false, error: 'Failed to disconnect Gmail' }))
    }
  }

  const disconnectOutlook = async () => {
    setOutlook(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch('/api/outlook/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Disconnect failed')
      setOutlook({ connected: false, email: null, connectedAt: null, loading: false, error: null })
    } catch {
      setOutlook(prev => ({ ...prev, loading: false, error: 'Failed to disconnect Outlook' }))
    }
  }

  return { gmail, outlook, disconnectGmail, disconnectOutlook, refetch: fetchStatus }
}
