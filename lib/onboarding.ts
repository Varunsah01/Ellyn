"use client"

export type OnboardingState = {
  step: number
  completed: boolean
  dismissed: boolean
  tourPending: boolean
  tourCompleted: boolean
  tourDismissed: boolean
}

const ONBOARDING_STORAGE_KEY = "ellyn:onboarding"
const CLIENT_ID_STORAGE_KEY = "ellyn:clientId"

const defaultState: OnboardingState = {
  step: 1,
  completed: false,
  dismissed: false,
  tourPending: false,
  tourCompleted: false,
  tourDismissed: false,
}

const isBrowser = () => typeof window !== "undefined"

const safeParse = <T,>(value: string | null, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/**
 * Get a stable anonymous client ID, generating one on first use.
 */
export const getClientId = () => {
  if (!isBrowser()) return ""
  const existing = window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)
  if (existing) return existing
  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `client_${Math.random().toString(36).slice(2, 10)}${Date.now()}`
  window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, generated)
  return generated
}

/**
 * Read the current tour-related onboarding state from localStorage.
 */
export const getOnboardingState = (): OnboardingState => {
  if (!isBrowser()) return defaultState
  return safeParse(window.localStorage.getItem(ONBOARDING_STORAGE_KEY), defaultState)
}

/**
 * Merge a partial update into the onboarding state in localStorage.
 */
export const setOnboardingState = (partial: Partial<OnboardingState>) => {
  if (!isBrowser()) return
  const current = getOnboardingState()
  const next = { ...current, ...partial }
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next))
}

/**
 * Mark a specific onboarding step as complete in the backend database.
 * The backend handles merging the steps and ensuring idempotency.
 */
export const markOnboardingStepComplete = async (step: string) => {
  if (!isBrowser()) return null
  try {
    const res = await fetch("/api/v1/user/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    })
    if (!res.ok) {
      throw new Error(`Failed to mark onboarding step complete: ${res.statusText}`)
    }
    return await res.json()
  } catch (error) {
    console.error("Error marking onboarding step complete:", error)
    return null
  }
}
