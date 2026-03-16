'use client'

import { useEffect, useMemo, useState } from 'react'

type SettingsResponse = {
  success: boolean
  data: {
    deepseekR1Enabled: boolean
    lookupCostEfficiencyTarget: number
    adminIpWhitelist: string[]
  }
  bounds: {
    min: number
    max: number
  }
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const DEFAULT_BOUNDS = { min: 0, max: 100 }

function toCsv(values: string[]): string {
  return values.join(', ')
}

function parseWhitelistInput(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [deepseekR1Enabled, setDeepseekR1Enabled] = useState(true)
  const [lookupTarget, setLookupTarget] = useState(65)
  const [adminIpWhitelistInput, setAdminIpWhitelistInput] = useState('')
  const [bounds, setBounds] = useState(DEFAULT_BOUNDS)

  const [fallbackState, setFallbackState] = useState<SaveState>('idle')
  const [lookupState, setLookupState] = useState<SaveState>('idle')
  const [whitelistState, setWhitelistState] = useState<SaveState>('idle')

  const [fallbackError, setFallbackError] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [whitelistError, setWhitelistError] = useState<string | null>(null)

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true)
      setLoadError(null)

      try {
        const response = await fetch('/api/admin/settings', {
          method: 'GET',
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`Unable to load settings (HTTP ${response.status})`)
        }

        const payload = (await response.json()) as SettingsResponse
        setDeepseekR1Enabled(payload.data.deepseekR1Enabled)
        setLookupTarget(payload.data.lookupCostEfficiencyTarget)
        setAdminIpWhitelistInput(toCsv(payload.data.adminIpWhitelist))
        setBounds(payload.bounds)
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }

    void loadSettings()
  }, [])

  const whitelistEntries = useMemo(() => parseWhitelistInput(adminIpWhitelistInput), [adminIpWhitelistInput])

  const applyFallbacks = async () => {
    const previous = deepseekR1Enabled
    setFallbackError(null)
    setFallbackState('saving')

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'fallbacks', deepseekR1Enabled }),
      })

      if (!response.ok) {
        throw new Error(`Save failed (HTTP ${response.status})`)
      }

      setFallbackState('saved')
    } catch (error) {
      setDeepseekR1Enabled(previous)
      setFallbackState('error')
      setFallbackError(error instanceof Error ? error.message : 'Failed to save fallback settings')
    }
  }

  const applyLookupTarget = async () => {
    const previous = lookupTarget
    setLookupError(null)
    setLookupState('saving')

    try {
      const clamped = Math.min(bounds.max, Math.max(bounds.min, lookupTarget))
      setLookupTarget(clamped)

      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'lookup_cost', lookupCostEfficiencyTarget: clamped }),
      })

      if (!response.ok) {
        throw new Error(`Save failed (HTTP ${response.status})`)
      }

      setLookupState('saved')
    } catch (error) {
      setLookupTarget(previous)
      setLookupState('error')
      setLookupError(error instanceof Error ? error.message : 'Failed to save lookup target')
    }
  }

  const applyIpWhitelist = async () => {
    const previous = adminIpWhitelistInput
    setWhitelistError(null)
    setWhitelistState('saving')

    try {
      const normalized = parseWhitelistInput(adminIpWhitelistInput)
      setAdminIpWhitelistInput(toCsv(normalized))

      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'ip_whitelist', adminIpWhitelist: normalized }),
      })

      if (!response.ok) {
        throw new Error(`Save failed (HTTP ${response.status})`)
      }

      setWhitelistState('saved')
    } catch (error) {
      setAdminIpWhitelistInput(previous)
      setWhitelistState('error')
      setWhitelistError(error instanceof Error ? error.message : 'Failed to save ADMIN_IP_WHITELIST')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-white">Admin Settings</h1>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading settings…</p> : null}
      {loadError ? <p className="text-sm text-red-400 mb-4">{loadError}</p> : null}

      <div className="grid grid-cols-1 gap-4">
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-white">AI Fallbacks</h2>
          <p className="text-xs text-gray-400 mt-1 mb-4">Enable or disable fallback providers for enrich workflows.</p>

          <label className="flex items-center justify-between rounded-lg border border-gray-800 px-3 py-2 bg-gray-950/50">
            <span className="text-sm text-gray-200">DeepSeek R1</span>
            <input
              type="checkbox"
              checked={deepseekR1Enabled}
              onChange={(event) => {
                setDeepseekR1Enabled(event.target.checked)
                setFallbackState('idle')
              }}
              disabled={fallbackState === 'saving' || loading}
              className="h-4 w-4"
            />
          </label>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => void applyFallbacks()}
              disabled={fallbackState === 'saving' || loading}
              className="px-3 py-1.5 text-xs rounded-md bg-violet-700 hover:bg-violet-600 text-white disabled:opacity-60"
            >
              {fallbackState === 'saving' ? 'Applying…' : 'Apply fallback settings'}
            </button>
            {fallbackState === 'saved' ? <span className="text-xs text-emerald-400">Saved.</span> : null}
            {fallbackError ? <span className="text-xs text-red-400">{fallbackError}</span> : null}
          </div>
        </section>

        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-white">Lookup Cost Efficiency</h2>
          <p className="text-xs text-gray-400 mt-1">
            Radical cost efficiency target for lookups.
          </p>

          <div className="mt-4 rounded-lg border border-gray-800 p-3 bg-gray-950/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Current target</span>
              <span className="text-sm text-violet-300 font-medium">{lookupTarget}%</span>
            </div>
            <input
              type="range"
              min={bounds.min}
              max={bounds.max}
              value={lookupTarget}
              onChange={(event) => {
                setLookupTarget(Number(event.target.value))
                setLookupState('idle')
              }}
              disabled={lookupState === 'saving' || loading}
              className="w-full"
            />
            <div className="mt-2 text-[11px] text-gray-500 flex justify-between">
              <span>Min {bounds.min}%</span>
              <span>Max {bounds.max}%</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => void applyLookupTarget()}
              disabled={lookupState === 'saving' || loading}
              className="px-3 py-1.5 text-xs rounded-md bg-violet-700 hover:bg-violet-600 text-white disabled:opacity-60"
            >
              {lookupState === 'saving' ? 'Applying…' : 'Apply cost target'}
            </button>
            {lookupState === 'saved' ? <span className="text-xs text-emerald-400">Saved.</span> : null}
            {lookupError ? <span className="text-xs text-red-400">{lookupError}</span> : null}
          </div>
        </section>

        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-white">Admin IP Whitelist</h2>
          <p className="text-xs text-gray-400 mt-1">Editable CSV or multiline values for <code>ADMIN_IP_WHITELIST</code>.</p>

          <textarea
            value={adminIpWhitelistInput}
            onChange={(event) => {
              setAdminIpWhitelistInput(event.target.value)
              setWhitelistState('idle')
            }}
            rows={5}
            disabled={whitelistState === 'saving' || loading}
            className="mt-3 w-full rounded-lg border border-gray-800 bg-gray-950/50 text-sm text-gray-200 px-3 py-2"
            placeholder="127.0.0.1, 10.0.0.7\n::1"
          />
          <p className="mt-2 text-[11px] text-gray-500">Parsed entries: {whitelistEntries.length}</p>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => void applyIpWhitelist()}
              disabled={whitelistState === 'saving' || loading}
              className="px-3 py-1.5 text-xs rounded-md bg-violet-700 hover:bg-violet-600 text-white disabled:opacity-60"
            >
              {whitelistState === 'saving' ? 'Applying…' : 'Apply IP whitelist'}
            </button>
            {whitelistState === 'saved' ? <span className="text-xs text-emerald-400">Saved.</span> : null}
            {whitelistError ? <span className="text-xs text-red-400">{whitelistError}</span> : null}
          </div>
        </section>
      </div>
    </div>
  )
}
