"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react"

// ─── Types ───────────────────────────────────────────────────────────────────

export type RefreshScope = "contacts" | "sequences" | "stats" | "all"

type Listener = () => void

interface AppRefreshContextValue {
  triggerRefresh: (scope: RefreshScope) => void
  subscribe: (scope: RefreshScope, cb: Listener) => void
  unsubscribe: (scope: RefreshScope, cb: Listener) => void
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AppRefreshContext = createContext<AppRefreshContextValue>({
  triggerRefresh: () => {},
  subscribe: () => {},
  unsubscribe: () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AppRefreshProvider({ children }: { children: ReactNode }) {
  // Listener registry lives in a ref — subscribe/unsubscribe never re-render
  const listenersRef = useRef<Map<RefreshScope, Set<Listener>>>(new Map())

  const subscribe = useCallback((scope: RefreshScope, cb: Listener) => {
    if (!listenersRef.current.has(scope)) {
      listenersRef.current.set(scope, new Set())
    }
    listenersRef.current.get(scope)!.add(cb)
  }, [])

  const unsubscribe = useCallback((scope: RefreshScope, cb: Listener) => {
    listenersRef.current.get(scope)?.delete(cb)
  }, [])

  const triggerRefresh = useCallback((scope: RefreshScope) => {
    const map = listenersRef.current
    const fire = (s: RefreshScope) => map.get(s)?.forEach((cb) => cb())

    if (scope === "all") {
      fire("contacts")
      fire("sequences")
      fire("stats")
    } else {
      fire(scope)
    }
    // 'all' listeners fire for every scope
    fire("all")
  }, [])

  // ── Global fetch interceptor ─────────────────────────────────────────────
  // Reads X-Trigger-Refresh from every response — no call-site changes needed
  useEffect(() => {
    if (typeof window === "undefined") return

    const original = window.fetch.bind(window)

    window.fetch = async (...args) => {
      const response = await original(...args)
      const header = response.headers.get("X-Trigger-Refresh")
      if (header) {
        header
          .split(",")
          .map((s) => s.trim() as RefreshScope)
          .forEach(triggerRefresh)
      }
      return response
    }

    return () => {
      window.fetch = original
    }
  }, [triggerRefresh])

  return (
    <AppRefreshContext.Provider value={{ triggerRefresh, subscribe, unsubscribe }}>
      {children}
    </AppRefreshContext.Provider>
  )
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Imperatively fire a refresh from anywhere in the tree. */
export function useAppRefresh() {
  return useContext(AppRefreshContext).triggerRefresh
}

/**
 * Subscribe to one or more refresh scopes.
 * The callback is always called with its latest reference (no stale-closure risk).
 */
export function useRefreshListener(
  scope: RefreshScope | RefreshScope[],
  callback: () => void
) {
  const { subscribe, unsubscribe } = useContext(AppRefreshContext)

  // Keep a stable ref to the latest callback
  const callbackRef = useRef(callback)
  useEffect(() => {
    callbackRef.current = callback
  })

  // Stable wrapper so the Set identity stays the same across renders
  const stableCallback = useCallback(() => callbackRef.current(), [])

  // Derive a stable string key to avoid array-reference churn in deps
  const scopeKey = Array.isArray(scope) ? scope.join(",") : scope

  useEffect(() => {
    const scopes = scopeKey.split(",") as RefreshScope[]
    scopes.forEach((s) => subscribe(s, stableCallback))
    return () => scopes.forEach((s) => unsubscribe(s, stableCallback))
  }, [subscribe, unsubscribe, stableCallback, scopeKey])
}
