"use client"

import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export type OnboardingState = {
  step: number
  completed: boolean
  dismissed: boolean
  tourPending: boolean
  tourCompleted: boolean
  tourDismissed: boolean
}

export type UserPreferences = {
  fullName: string
  currentRole: string
  targetRole: string
  aiApiKey?: string
}

const ONBOARDING_STORAGE_KEY = "ellyn:onboarding"
const CLIENT_ID_STORAGE_KEY = "ellyn:clientId"
const PREFERENCES_STORAGE_KEY = "ellyn:preferences"

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

export const getOnboardingState = (): OnboardingState => {
  if (!isBrowser()) return defaultState
  return safeParse(window.localStorage.getItem(ONBOARDING_STORAGE_KEY), defaultState)
}

export const setOnboardingState = (partial: Partial<OnboardingState>) => {
  if (!isBrowser()) return
  const current = getOnboardingState()
  const next = { ...current, ...partial }
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(next))
}

export const getUserPreferences = (): UserPreferences => {
  if (!isBrowser()) {
    return { fullName: "", currentRole: "", targetRole: "", aiApiKey: "" }
  }
  return safeParse(window.localStorage.getItem(PREFERENCES_STORAGE_KEY), {
    fullName: "",
    currentRole: "",
    targetRole: "",
    aiApiKey: "",
  })
}

export const setUserPreferences = (preferences: UserPreferences) => {
  if (!isBrowser()) return
  window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences))
}

export const syncOnboardingState = async (partial: Partial<OnboardingState>) => {
  setOnboardingState(partial)

  if (!isSupabaseConfigured) return

  try {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id ?? null
    const clientId = getClientId()
    const payload = {
      client_id: clientId,
      user_id: userId,
      step: partial.step ?? getOnboardingState().step,
      completed: partial.completed ?? getOnboardingState().completed,
      dismissed: partial.dismissed ?? getOnboardingState().dismissed,
      tour_pending: partial.tourPending ?? getOnboardingState().tourPending,
      tour_completed: partial.tourCompleted ?? getOnboardingState().tourCompleted,
      tour_dismissed: partial.tourDismissed ?? getOnboardingState().tourDismissed,
      updated_at: new Date().toISOString(),
    }

    await supabase.from("user_onboarding").upsert(payload, {
      onConflict: "client_id",
    })
  } catch (error) {
    console.warn("Failed to sync onboarding state:", error)
  }
}

export const syncUserPreferences = async (preferences: UserPreferences) => {
  setUserPreferences(preferences)

  if (!isSupabaseConfigured) return

  try {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id ?? null
    const clientId = getClientId()

    await supabase.from("user_preferences").upsert(
      {
        client_id: clientId,
        user_id: userId,
        full_name: preferences.fullName,
        current_role: preferences.currentRole,
        target_role: preferences.targetRole,
        ai_api_key: preferences.aiApiKey ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id" }
    )
  } catch (error) {
    console.warn("Failed to sync user preferences:", error)
  }
}
