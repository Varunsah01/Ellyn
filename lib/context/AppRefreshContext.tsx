"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

export type RefreshScope =
  | "contacts"
  | "leads"
  | "deals"
  | "stages"
  | "analytics"
  | "sequences"

type LegacyScope = "stats" | "all"
type ScopeInput = RefreshScope | LegacyScope
type ListenerScope = RefreshScope | "all"
type Listener = () => void

export type LastRefreshMap = Record<RefreshScope, number>

const REFRESH_SCOPES: RefreshScope[] = [
  "contacts",
  "leads",
  "deals",
  "stages",
  "analytics",
  "sequences",
]

function buildInitialLastRefresh(): LastRefreshMap {
  const now = Date.now()
  return {
    contacts: now,
    leads: now,
    deals: now,
    stages: now,
    analytics: now,
    sequences: now,
  }
}

function normalizeScopes(input: ScopeInput | ScopeInput[]): ListenerScope[] {
  const values = Array.isArray(input) ? input : [input]
  const scopes = new Set<ListenerScope>()

  for (const rawScope of values) {
    if (rawScope === "all") {
      for (const scope of REFRESH_SCOPES) scopes.add(scope)
      scopes.add("all")
      continue
    }

    if (rawScope === "stats") {
      scopes.add("analytics")
      continue
    }

    scopes.add(rawScope)
  }

  return [...scopes]
}

interface AppRefreshContextValue {
  triggerRefresh: (scope: ScopeInput | ScopeInput[]) => void
  lastRefresh: LastRefreshMap
  subscribe: (scope: ListenerScope, cb: Listener) => void
  unsubscribe: (scope: ListenerScope, cb: Listener) => void
}

const AppRefreshContext = createContext<AppRefreshContextValue>({
  triggerRefresh: () => {},
  lastRefresh: buildInitialLastRefresh(),
  subscribe: () => {},
  unsubscribe: () => {},
})

export function AppRefreshProvider({ children }: { children: ReactNode }) {
  const [lastRefresh, setLastRefresh] = useState<LastRefreshMap>(() =>
    buildInitialLastRefresh()
  )
  const listenersRef = useRef<Map<ListenerScope, Set<Listener>>>(new Map())

  const subscribe = useCallback((scope: ListenerScope, cb: Listener) => {
    if (!listenersRef.current.has(scope)) {
      listenersRef.current.set(scope, new Set())
    }
    listenersRef.current.get(scope)?.add(cb)
  }, [])

  const unsubscribe = useCallback((scope: ListenerScope, cb: Listener) => {
    listenersRef.current.get(scope)?.delete(cb)
  }, [])

  const triggerRefresh = useCallback((scopeInput: ScopeInput | ScopeInput[]) => {
    const resolvedScopes = normalizeScopes(scopeInput).filter(
      (scope): scope is RefreshScope => scope !== "all"
    )

    if (resolvedScopes.length === 0) return

    const now = Date.now()
    setLastRefresh((previous) => {
      const next: LastRefreshMap = { ...previous }
      for (const scope of resolvedScopes) {
        next[scope] = now
      }
      return next
    })

    const listeners = listenersRef.current
    for (const scope of resolvedScopes) {
      listeners.get(scope)?.forEach((listener) => listener())
    }
    listeners.get("all")?.forEach((listener) => listener())
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const originalFetch = window.fetch.bind(window)

    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      const header = response.headers.get("X-Trigger-Refresh")

      if (header) {
        const scopes = header
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean) as ScopeInput[]
        if (scopes.length > 0) triggerRefresh(scopes)
      }

      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [triggerRefresh])

  const contextValue = useMemo<AppRefreshContextValue>(
    () => ({
      triggerRefresh,
      lastRefresh,
      subscribe,
      unsubscribe,
    }),
    [lastRefresh, subscribe, triggerRefresh, unsubscribe]
  )

  return (
    <AppRefreshContext.Provider value={contextValue}>
      {children}
    </AppRefreshContext.Provider>
  )
}

export function useAppRefresh() {
  return useContext(AppRefreshContext).triggerRefresh
}

export function useLastRefresh() {
  return useContext(AppRefreshContext).lastRefresh
}

export function useRefreshListener(
  scope: ScopeInput | ScopeInput[],
  callback: () => void
) {
  const { subscribe, unsubscribe } = useContext(AppRefreshContext)

  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  const stableCallback = useCallback(() => callbackRef.current(), [])
  const resolvedScopes = useMemo(() => normalizeScopes(scope), [scope])
  const scopeKey = resolvedScopes.join(",")

  useEffect(() => {
    const scopes = scopeKey
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean) as ListenerScope[]

    for (const currentScope of scopes) {
      subscribe(currentScope, stableCallback)
    }

    return () => {
      for (const currentScope of scopes) {
        unsubscribe(currentScope, stableCallback)
      }
    }
  }, [scopeKey, stableCallback, subscribe, unsubscribe])
}
